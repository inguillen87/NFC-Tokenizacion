import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { resolveSunReplayExecutionClass } from "../src/lib/sun-service.ts";

const migration = await readFile(new URL(
  "../db/migrations/20260802320000_0097_sun_demo_replay_isolation.sql",
  import.meta.url,
), "utf8");
const demoRoute = await readFile(new URL(
  "../src/app/internal/demo/scan/route.ts",
  import.meta.url,
), "utf8");
const service = await readFile(new URL("../src/lib/sun-service.ts", import.meta.url), "utf8");
const publicSunRoute = await readFile(new URL("../src/app/sun/route.ts", import.meta.url), "utf8");

test("SUN execution classes isolate demo from real/imported traffic", () => {
  assert.equal(resolveSunReplayExecutionClass("demo"), "demo");
  assert.equal(resolveSunReplayExecutionClass("real"), "operational");
  assert.equal(resolveSunReplayExecutionClass("imported"), "operational");
  assert.equal(resolveSunReplayExecutionClass(undefined), "operational");

  const filter = "CASE WHEN LOWER(COALESCE(e.source::text, 'real')) = 'demo' THEN 'demo' ELSE 'operational' END";
  assert.equal(migration.split(filter).length - 1, 2);
  assert.match(migration, /v_source := CASE LOWER\(COALESCE\(NULLIF\(p_input->>'source', ''\), 'real'\)\)/);
  assert.doesNotMatch(migration, /BTRIM\(p_input->>'source'\)/);
  assert.match(migration, /v_execution_class := CASE WHEN v_source = 'demo' THEN 'demo' ELSE 'operational' END/);
  assert.match(migration, /IF v_execution_class = 'operational'[\s\S]*v_ctr <= v_previous_last_seen_ctr/);
  assert.match(migration, /IF v_tag_id IS NOT NULL AND v_execution_class = 'operational' THEN[\s\S]*UPDATE tags t/);
  assert.match(migration, /ELSIF v_tag_id IS NOT NULL THEN[\s\S]*v_last_seen_ctr := v_previous_last_seen_ctr/);
  assert.match(migration, /'replay_execution_class', v_execution_class/);
});

test("dry-run replay inspection uses the same source boundary and never applies the real watermark to demo", () => {
  assert.equal(service.split("CASE WHEN source::text = 'demo' THEN 'demo' ELSE 'operational' END").length - 1, 2);
  assert.match(service, /replayExecutionClass === "operational"[\s\S]*resolvedCtr <= tag\.last_seen_ctr/);
});

test("0097 repairs only the physical watermark from verified non-demo evidence and keeps an immutable receipt", () => {
  const repairStart = migration.indexOf("DO $sun_demo_watermark_repair$");
  const repairEnd = migration.indexOf("REVOKE ALL ON TABLE", repairStart);
  const repair = migration.slice(repairStart, repairEnd);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.sun_replay_watermark_repairs/);
  assert.match(migration, /PRIMARY KEY \(repair_version, tag_id\)/);
  assert.match(migration, /trg_sun_replay_watermark_repairs_append_only/);
  assert.match(migration, /sun_replay_watermark_repair_is_append_only/);
  assert.match(repair, /pg_advisory_xact_lock\([\s\S]*hashtext\('uid:' \|\| UPPER\(v_tag\.uid_hex\)\)/);
  assert.match(repair, /MAX\(COALESCE\(event\.sdm_read_ctr, event\.read_counter\)\)[\s\S]*event\.cmac_ok IS TRUE[\s\S]*COALESCE\(event\.sdm_read_ctr, event\.read_counter\) IS NOT NULL/);
  assert.match(repair, /LOWER\(COALESCE\(event\.source::text, 'real'\)\) <> 'demo'/);
  assert.match(migration, /observed_scan_count[\s\S]*observed_first_seen_at[\s\S]*observed_last_seen_at/);
  assert.match(repair, /GET DIAGNOSTICS v_inserted = ROW_COUNT[\s\S]*IF v_inserted = 1 THEN[\s\S]*SET last_seen_ctr = v_repaired_last_seen_ctr/);
  assert.doesNotMatch(repair, /DELETE\s+FROM\s+(?:public\.)?events|UPDATE\s+(?:public\.)?events|TRUNCATE/i);
  assert.doesNotMatch(repair, /SET\s+(?:scan_count|first_seen_at|last_seen_at)\s*=/i);
});

test("Demo Lab derives its counter only from the demo event lane", () => {
  assert.match(demoRoute, /MAX\(COALESCE\(e\.sdm_read_ctr, e\.read_counter\)\)::integer/);
  assert.match(demoRoute, /e\.source::text = 'demo'/);
  assert.match(demoRoute, /AS last_demo_ctr/);
  assert.match(demoRoute, /Number\(batch\.last_demo_ctr \?\? 0\)/);
  assert.doesNotMatch(demoRoute, /t\.last_seen_ctr|batch\.last_seen_ctr/);
  assert.match(demoRoute, /source: 'demo'/);
});

test("the public SUN passport derives physical counters and timeline without the demo lane", () => {
  const operationalFilters = publicSunRoute.match(/AND LOWER\(COALESCE\(e\.source::text, 'real'\)\) <> 'demo'/g) || [];
  assert.equal(operationalFilters.length, 4);
  assert.match(publicSunRoute, /SELECT COUNT\(\*\)::integer AS scan_count[\s\S]*\) operational_scans ON TRUE/);
  assert.match(publicSunRoute, /operational_scans\.scan_count/);
  assert.doesNotMatch(publicSunRoute, /\n\s+t\.scan_count,/);
});

test("0097 remains forward-only and private", () => {
  assert.match(migration, /nexid_sun_demo_replay_isolation_v1_capability\(\)/);
  assert.match(migration, /sun-demo-replay-isolation\/v1/);
  assert.match(migration, /ALTER FUNCTION public\.nexid_persist_sun_scan_v1_base_pre_tt_0093\(jsonb\) SECURITY INVOKER/);
  assert.match(migration, /SET search_path TO pg_catalog, public, pg_temp/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.nexid_persist_sun_scan_v1_base_pre_tt_0093\(jsonb\) FROM PUBLIC/);
  assert.doesNotMatch(migration, /^\s*(BEGIN|START\s+TRANSACTION|COMMIT|ROLLBACK)\s*;/im);
  assert.doesNotMatch(migration, /DROP\s+(?:TABLE|SCHEMA|DATABASE)|TRUNCATE/i);
});

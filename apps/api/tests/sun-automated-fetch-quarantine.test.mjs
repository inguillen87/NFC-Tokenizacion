import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE } from "../src/lib/sun-automated-fetch.ts";

const migration = await readFile(new URL(
  "../db/migrations/20260802320000_0097_sun_demo_replay_isolation.sql",
  import.meta.url,
), "utf8");
const analyticsRoute = await readFile(new URL(
  "../src/app/admin/analytics/route.ts",
  import.meta.url,
), "utf8");
const publicSunRoute = await readFile(new URL(
  "../src/app/sun/route.ts",
  import.meta.url,
), "utf8");

test("0097 classifies historical automated SUN fetches dynamically and records append-only receipts", () => {
  const quarantineStart = migration.indexOf("CREATE OR REPLACE FUNCTION public.nexid_classify_sun_automated_fetch_user_agent_v1");
  const quarantineEnd = migration.indexOf("CREATE OR REPLACE FUNCTION public.nexid_sun_demo_replay_isolation_v1_capability", quarantineStart);
  const quarantine = migration.slice(quarantineStart, quarantineEnd);
  const backfillStart = quarantine.lastIndexOf("INSERT INTO public.sun_automated_fetch_quarantines");
  const backfill = quarantine.slice(backfillStart);

  assert.ok(quarantineStart >= 0 && quarantineEnd > quarantineStart && backfillStart >= 0);
  assert.match(quarantine, /CREATE TABLE IF NOT EXISTS public\.sun_automated_fetch_quarantines/);
  assert.match(quarantine, /PRIMARY KEY \(classification_version, event_id, event_created_at\)/);
  assert.match(quarantine, /FOREIGN KEY \(event_id, event_created_at\)[\s\S]*REFERENCES public\.events\(id, created_at\) ON DELETE RESTRICT/);
  assert.match(quarantine, /user_agent_digest ~ '\^sha256:\[0-9a-f\]\{64\}\$'/);
  assert.match(quarantine, /CREATE TRIGGER trg_sun_automated_fetch_quarantines_append_only[\s\S]*BEFORE UPDATE OR DELETE/);
  assert.match(quarantine, /sun_automated_fetch_quarantine_is_append_only/);
  assert.match(backfill, /FROM public\.events event/);
  assert.match(backfill, /nexid_classify_sun_automated_fetch_user_agent_v1\(event\.user_agent\) IS NOT NULL/);
  assert.match(backfill, /ON CONFLICT \(classification_version, event_id, event_created_at\) DO NOTHING/);
  assert.doesNotMatch(backfill, /\b(?:11|272|283)\b/);
  assert.doesNotMatch(quarantine, /DELETE\s+FROM\s+(?:public\.)?events|UPDATE\s+(?:public\.)?events|TRUNCATE/i);
});

test("the migration and runtime analytics share the same explicit user-agent signatures", () => {
  const tokens = SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE.split("|");
  assert.ok(tokens.length > 20);
  for (const token of tokens) {
    assert.match(migration.toLowerCase(), new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  const classifierStart = migration.indexOf("CREATE OR REPLACE FUNCTION public.nexid_classify_sun_automated_fetch_user_agent_v1");
  const classifierEnd = migration.indexOf("CREATE TABLE IF NOT EXISTS public.sun_automated_fetch_quarantines", classifierStart);
  const sqlTokens = Array.from(
    migration.slice(classifierStart, classifierEnd).matchAll(/'%([^%']+)%'/g),
    (match) => match[1],
  );
  sqlTokens.push("google-read-aloud");
  assert.deepEqual([...new Set(sqlTokens)].sort(), [...new Set(tokens)].sort());

  const sourceFilters = analyticsRoute.match(/AND \(\$\{source\} = '' OR e\.source::text = \$\{source\}\)/g) || [];
  const automatedFilters = analyticsRoute.match(/AND COALESCE\(e\.user_agent, ''\) !~\* \$\{SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE\}/g) || [];
  assert.ok(sourceFilters.length >= 28);
  assert.equal(automatedFilters.length, sourceFilters.length);
});

test("operational products exclude demo-only and automated-fetch-only tags", () => {
  const normalizedAnalyticsRoute = analyticsRoute.replace(/\r\n/g, "\n");
  const productStart = normalizedAnalyticsRoute.indexOf("          t.uid_hex,\n          b.bid,\n          COALESCE(pp.product_name");
  const productEnd = normalizedAnalyticsRoute.indexOf("  ]);", productStart);
  const productProjection = normalizedAnalyticsRoute.slice(productStart, productEnd);

  assert.ok(productStart >= 0 && productEnd > productStart);
  assert.doesNotMatch(productProjection, /\bt\.(?:scan_count|first_seen_at|last_seen_at)\b/);
  assert.equal((productProjection.match(/COUNT\(\*\)::integer AS scan_count/g) || []).length, 2);
  assert.equal((productProjection.match(/MIN\(e\.created_at\) AS first_seen_at/g) || []).length, 2);
  assert.equal((productProjection.match(/MAX\(e\.created_at\) AS last_seen_at/g) || []).length, 2);
  assert.equal((productProjection.match(/\) operational_evt ON operational_evt\.scan_count > 0/g) || []).length, 2);
  assert.equal((productProjection.match(/ORDER BY operational_evt\.last_seen_at DESC/g) || []).length, 2);
  assert.equal((productProjection.match(/AND \(\$\{source\} = '' OR e\.source::text = \$\{source\}\)/g) || []).length, 4);
  assert.equal((productProjection.match(/AND COALESCE\(e\.user_agent, ''\) !~\* \$\{SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE\}/g) || []).length, 4);
  assert.equal((productProjection.match(/AND e\.created_at >= now\(\) - \$\{rangeSql\}::interval/g) || []).length, 4);
});

test("0097 captures future bypasses without exposing raw user-agent data in the quarantine receipt", () => {
  const tableStart = migration.indexOf("CREATE TABLE IF NOT EXISTS public.sun_automated_fetch_quarantines");
  const tableEnd = migration.indexOf(");", tableStart);
  const tableDefinition = migration.slice(tableStart, tableEnd);

  assert.match(migration, /CREATE TRIGGER trg_events_capture_sun_automated_fetch_v1[\s\S]*AFTER INSERT ON public\.events/);
  assert.match(migration, /nexid_capture_sun_automated_fetch_quarantine_v1\(\)[\s\S]*SECURITY DEFINER[\s\S]*SET search_path TO pg_catalog, public, pg_temp/);
  assert.match(migration, /'sha256:' \|\| encode\(digest\(convert_to\(COALESCE\(NEW\.user_agent, ''\), 'UTF8'\), 'sha256'\), 'hex'\)/);
  assert.match(migration, /REVOKE ALL ON TABLE public\.sun_automated_fetch_quarantines FROM PUBLIC/);
  assert.doesNotMatch(tableDefinition, /\buser_agent\s+text\b/i);
  assert.match(migration, /LEFT JOIN public\.sun_automated_fetch_quarantines quarantine[\s\S]*quarantine\.event_id IS NULL/);
});

test("the public passport, timeline and map exclude quarantined automated dereferences", () => {
  const publicFilters = publicSunRoute.match(/AND COALESCE\(e\.user_agent, ''\) !~\* \$\{SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE\}/g) || [];
  assert.equal(publicFilters.length, 4);
  assert.doesNotMatch(publicSunRoute, /FROM public\.sun_automated_fetch_quarantines/);
});

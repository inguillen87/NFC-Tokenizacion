import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL(
  "../db/migrations/20260802290000_0094_sun_runtime_acl_boundary.sql",
  import.meta.url,
), "utf8");

test("0094 makes the SUN wrapper the only grantable entry and preserves a private base", () => {
  assert.match(migration, /ALTER FUNCTION public\.nexid_persist_sun_scan_v1\(jsonb\) SECURITY DEFINER/);
  assert.match(migration, /ALTER FUNCTION public\.nexid_persist_sun_scan_v1\(jsonb\)[\s\S]*SET search_path TO pg_catalog, public, pg_temp/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.nexid_persist_sun_scan_v1\(jsonb\) FROM PUBLIC/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.nexid_persist_sun_scan_v1_base_0062\(jsonb\) FROM PUBLIC/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.nexid_persist_sun_scan_v1_base_pre_tt_0093\(jsonb\) FROM PUBLIC/);
  assert.match(migration, /REVOKE CREATE ON SCHEMA public FROM PUBLIC/);
  assert.match(migration, /nexid_sun_runtime_acl_v1_capability/);
  assert.doesNotMatch(migration, /GRANT\s+EXECUTE[\s\S]*base_0062/i);
});

test("0094 explicitly preserves the physical trust path and makes no custody claim", () => {
  assert.match(migration, /changes no SUN\/SDM\/CMAC\/TTStatus semantics/i);
  assert.match(migration, /not KMS or HSM custody/i);
  assert.doesNotMatch(migration, /hsm[_ -]?backed\s*[:=]\s*true/i);
  assert.doesNotMatch(migration, /managed[_ -]?kms\s*[:=]\s*true/i);
});

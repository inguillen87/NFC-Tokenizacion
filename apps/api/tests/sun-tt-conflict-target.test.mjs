import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const priorMigration = await readFile(new URL(
  "../db/migrations/20260802280000_0093_sun_tt_durable_truth_binding.sql",
  import.meta.url,
), "utf8");
const migration = await readFile(new URL(
  "../db/migrations/20260802300000_0095_sun_tt_conflict_target.sql",
  import.meta.url,
), "utf8");

const ambiguousTarget = "ON CONFLICT (event_id, event_created_at) DO NOTHING";
const deterministicTarget = "ON CONFLICT ON CONSTRAINT sun_tt_truth_receipts_pkey DO NOTHING";

test("0095 targets the single ambiguous PL/pgSQL conflict clause introduced by 0093", () => {
  assert.equal(priorMigration.split(ambiguousTarget).length - 1, 1);
  assert.doesNotMatch(priorMigration, /ON CONFLICT ON CONSTRAINT sun_tt_truth_receipts_pkey DO NOTHING/);

  assert.match(migration, /pg_get_functiondef\(to_regprocedure\('public\.nexid_persist_sun_scan_v1_base_0062\(jsonb\)'\)\)/);
  assert.match(migration, /v_old_conflict_target constant text := 'ON CONFLICT \(event_id, event_created_at\) DO NOTHING'/);
  assert.match(migration, /v_new_conflict_target constant text := 'ON CONFLICT ON CONSTRAINT sun_tt_truth_receipts_pkey DO NOTHING'/);
  assert.match(migration, /v_old_target_count IS DISTINCT FROM 1/);
  assert.match(migration, /EXECUTE replace\(v_function_definition, v_old_conflict_target, v_new_conflict_target\)/);
  assert.match(migration, /v_old_target_count IS DISTINCT FROM 0[\s\S]*v_new_target_count IS DISTINCT FROM 1/);
});

test("0095 fails closed unless the named primary key has the exact durable receipt columns", () => {
  assert.match(migration, /constraint_row\.conname = 'sun_tt_truth_receipts_pkey'/);
  assert.match(migration, /constraint_row\.contype = 'p'/);
  assert.match(migration, /array_agg\(attribute_row\.attname::text ORDER BY key_column\.ordinality\)/);
  assert.match(migration, /ARRAY\['event_id', 'event_created_at'\]::text\[\]/);
  assert.match(migration, /sun_tt_conflict_target_primary_key_mismatch/);
  assert.match(migration, /sun_tt_conflict_target_source_occurrence_mismatch/);
  assert.match(migration, /sun_tt_conflict_target_postcondition_failed/);
});

test("0095 reasserts the 0094 execution boundary and exposes only a private capability", () => {
  assert.match(migration, /ALTER FUNCTION public\.nexid_persist_sun_scan_v1\(jsonb\) SECURITY DEFINER/);
  assert.match(migration, /ALTER FUNCTION public\.nexid_persist_sun_scan_v1_base_0062\(jsonb\) SECURITY DEFINER/);
  assert.match(migration, /SET search_path TO pg_catalog, public, pg_temp/g);
  assert.match(migration, /REVOKE CREATE ON SCHEMA public FROM PUBLIC/);
  for (const signature of [
    "nexid_persist_sun_scan_v1\\(jsonb\\)",
    "nexid_persist_sun_scan_v1_base_0062\\(jsonb\\)",
    "nexid_persist_sun_scan_v1_base_pre_tt_0093\\(jsonb\\)",
    "nexid_sun_runtime_acl_v1_capability\\(\\)",
    "nexid_sun_tt_conflict_target_v1_capability\\(\\)",
  ]) {
    assert.match(migration, new RegExp(`REVOKE ALL ON FUNCTION public\\.${signature} FROM PUBLIC`));
  }
  assert.match(migration, /sun-tt-conflict-target\/v1/);
  assert.doesNotMatch(migration, /GRANT\s+EXECUTE[\s\S]*base_0062/i);
});

test("0095 changes no physical SUN cryptography or custody classification", () => {
  assert.doesNotMatch(migration, /CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE|TRUNCATE/i);
  assert.doesNotMatch(migration, /UPDATE\s+public\.(tags|events|sun_counter_state)|DELETE\s+FROM|INSERT\s+INTO/i);
  assert.match(migration, /changes no CMAC,[\s\S]*SDM, TTStatus, replay, or counter semantics/i);
  assert.match(migration, /not KMS or HSM custody/i);
  assert.doesNotMatch(migration, /hsm[_ -]?backed\s*[:=]\s*true/i);
  assert.doesNotMatch(migration, /managed[_ -]?kms\s*[:=]\s*true/i);
});

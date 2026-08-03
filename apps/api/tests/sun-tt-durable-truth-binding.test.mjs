import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { normalizeSunPersistenceForceResult } from "../src/lib/sun-atomic-persistence.ts";

const migration = await readFile(
  new URL("../db/migrations/20260802280000_0093_sun_tt_durable_truth_binding.sql", import.meta.url),
  "utf8",
);
const persistence = await readFile(
  new URL("../src/lib/sun-atomic-persistence.ts", import.meta.url),
  "utf8",
);
const service = await readFile(new URL("../src/lib/sun-service.ts", import.meta.url), "utf8");

test("0093 exposes a versioned private capability and keeps the 0066 atomic wrapper contract", () => {
  assert.match(migration, /nexid_sun_tt_durable_truth_v1_capability\(\)/);
  assert.match(migration, /sun-tt-durable-truth-binding\/v1/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.nexid_sun_tt_durable_truth_v1_capability\(\) FROM PUBLIC/);
  const rename = migration.indexOf("RENAME TO nexid_persist_sun_scan_v1_base_pre_tt_0093");
  const replacement = migration.indexOf("CREATE OR REPLACE FUNCTION public.nexid_persist_sun_scan_v1_base_0062", rename);
  const legacyCall = migration.indexOf("nexid_persist_sun_scan_v1_base_pre_tt_0093(v_effective_input)", replacement);
  assert.ok(rename >= 0 && replacement > rename && legacyCall > replacement);
  assert.match(migration, /SECURITY DEFINER[\s\S]*SET search_path = public, pg_temp/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.nexid_persist_sun_scan_v1_base_pre_tt_0093\(jsonb\) FROM PUBLIC/);
});

test("the database maps only the three canonical two-byte TTStatus values", () => {
  const mappingStart = migration.indexOf("v_canonical_product_state := CASE v_tt_raw");
  const mappingEnd = migration.indexOf("END;", mappingStart);
  const mapping = migration.slice(mappingStart, mappingEnd);
  assert.match(mapping, /WHEN '4343' THEN 'VALID_CLOSED'/);
  assert.match(mapping, /WHEN '4F4F' THEN 'VALID_OPENED'/);
  assert.match(mapping, /WHEN '4F43' THEN 'VALID_OPENED_PREVIOUSLY'/);
  assert.doesNotMatch(mapping, /VALID_UNKNOWN_TAMPER|MANUAL_OPENED|TAMPER_RISK/);
  assert.match(migration, /tt_raw_missing_or_noncanonical/);
  assert.match(migration, /tt_product_state_contradiction/);
  assert.match(migration, /v_final_result := 'SUN_PROFILE_MISMATCH'/);
});

test("force_result is restricted to blocking states at both app and database boundaries", () => {
  for (const allowed of ["SUN_PROFILE_MISMATCH", "NOT_ACTIVE", "REVOKED", "BROKEN", "TAMPER_RISK"]) {
    assert.equal(normalizeSunPersistenceForceResult(allowed.toLowerCase()), allowed);
    assert.match(persistence, new RegExp(`\\"${allowed}\\"`));
    assert.match(migration, new RegExp(`'${allowed}'`));
  }
  for (const rejected of ["VALID", "VALID_CLOSED", "VALID_OPENED", "VALID_MANUAL_OPENED", "OPENED", "TAMPER", "garbage", null]) {
    assert.equal(normalizeSunPersistenceForceResult(rejected), null);
  }
  const appAllowlistStart = persistence.indexOf("const SUN_PERSISTENCE_DEGRADING_RESULTS");
  const appAllowlistEnd = persistence.indexOf("]);", appAllowlistStart);
  const appAllowlist = persistence.slice(appAllowlistStart, appAllowlistEnd);
  assert.doesNotMatch(appAllowlist, /VALID_CLOSED|VALID_OPENED|VALID_AUTHENTIC|MANUAL_OPENED/);
  assert.match(migration, /tt_force_result_contradiction/);
  assert.match(migration, /non_tt_tamper_promotion_rejected/);
  assert.match(migration, /non_tt_persisted_tamper_promotion/);
});

test("service sends reserved TT evidence and request metadata cannot overwrite it", () => {
  assert.match(service, /ttTruth:\s*\{[\s\S]*ttRaw: ttstatusParsed\?\.raw/);
  assert.match(service, /claimedProductState: preRegistryResult/);
  assert.match(service, /statusSource: tamperProfile\.ttstatus_source/);
  const envelopeStart = persistence.indexOf("const envelope = {");
  const metaIndex = persistence.indexOf("meta: input.meta || {}", envelopeStart);
  const truthIndex = persistence.indexOf("tt_truth: ttTruth", envelopeStart);
  assert.ok(truthIndex > envelopeStart && metaIndex > truthIndex);
  assert.match(persistence, /schema_version: "sun-tt-durable-truth-input\/v1"/);
});

test("durable receipts are append-only and exclude raw UID, secrets, and personal fields", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.sun_tt_truth_receipts/);
  assert.match(migration, /PRIMARY KEY \(event_id, event_created_at\)/);
  assert.match(migration, /trg_sun_tt_truth_receipts_append_only/);
  assert.match(migration, /sun_tt_truth_receipt_append_only/);
  assert.match(migration, /evidence_digest ~ '\^sha256:\[0-9a-f\]\{64\}\$'/);
  const tableStart = migration.indexOf("CREATE TABLE IF NOT EXISTS public.sun_tt_truth_receipts");
  const tableEnd = migration.indexOf(");", tableStart);
  const table = migration.slice(tableStart, tableEnd);
  assert.doesNotMatch(table, /uid_hex|raw_query|user_agent|\bip\b|latitude|longitude|key_ciphertext|meta_key|file_key/i);
  assert.match(migration, /picc_data_hash[\s\S]*cmac_hash/);
  assert.match(migration, /not KMS or HSM custody/);
});

test("event correction, receipt append, and legacy counter/replay work remain one transaction", () => {
  const baseCall = migration.indexOf("nexid_persist_sun_scan_v1_base_pre_tt_0093(v_effective_input)");
  const eventUpdate = migration.indexOf("UPDATE public.events event", baseCall);
  const receiptInsert = migration.indexOf("INSERT INTO public.sun_tt_truth_receipts", eventUpdate);
  const returned = migration.indexOf("RETURN NEXT", receiptInsert);
  assert.ok(baseCall >= 0 && eventUpdate > baseCall && receiptInsert > eventUpdate && returned > receiptInsert);
  assert.match(migration, /WHERE event\.id = v_receipt\.event_id[\s\S]*event\.created_at = v_receipt\.created_at/);
  assert.doesNotMatch(migration, /^\s*(BEGIN|START\s+TRANSACTION|COMMIT|ROLLBACK)\s*;/im);
});

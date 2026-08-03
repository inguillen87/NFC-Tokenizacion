import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const migration = readFileSync(
  `${repositoryRoot}/apps/api/db/migrations/20260802270000_0092_supplier_carrier_scope_integrity.sql`,
  "utf8",
);
const manifestHelper = readFileSync(
  `${repositoryRoot}/apps/api/src/lib/supplier-manifest-import.ts`,
  "utf8",
);
const importRoute = readFileSync(
  `${repositoryRoot}/apps/api/src/app/admin/batches/[bid]/import-manifest/route.ts`,
  "utf8",
);

test("0092 fails closed for incomplete or cross-scope supplier key rows", () => {
  assert.match(migration, /nexid_supplier_carrier_scope_integrity_v1_capability/);
  assert.match(migration, /supplier-carrier-scope-integrity\/v1/);
  assert.doesNotMatch(
    migration,
    /IF NEW\.supplier_order_id IS NULL THEN\s+RETURN NEW/i,
    "a NULL order must never bypass key scope validation",
  );
  for (const required of [
    "NEW.tenant_id IS NULL",
    "NEW.supplier_order_id IS NULL",
    "NEW.supplier_sub_batch_id IS NULL",
    "NEW.batch_id IS NULL",
    "NULLIF(btrim(NEW.bid), '') IS NULL",
  ]) {
    assert.ok(migration.includes(required), `${required} must fail closed`);
  }
  assert.match(migration, /supplier_batch_key_scope_incomplete/);
  assert.match(migration, /JOIN supplier_sub_batches sub_batch[\s\S]*sub_batch\.supplier_order_id = supplier_order\.id[\s\S]*sub_batch\.tenant_id = supplier_order\.tenant_id/);
  assert.match(migration, /JOIN batches batch[\s\S]*batch\.id = sub_batch\.batch_id[\s\S]*batch\.supplier_order_id = supplier_order\.id[\s\S]*batch\.supplier_sub_batch_id = sub_batch\.id/);
  assert.match(migration, /sub_batch\.id = NEW\.supplier_sub_batch_id[\s\S]*sub_batch\.batch_id = NEW\.batch_id[\s\S]*upper\(btrim\(sub_batch\.bid\)\) = upper\(btrim\(NEW\.bid\)\)/);
  assert.match(migration, /batch\.id = NEW\.batch_id[\s\S]*upper\(btrim\(batch\.bid\)\) = upper\(btrim\(NEW\.bid\)\)/);
  assert.match(migration, /lower\(btrim\(batch\.carrier_profile_code\)\) = lower\(btrim\(supplier_order\.carrier_profile_code\)\)/);
  assert.match(migration, /FOR SHARE OF supplier_order, sub_batch, batch/);
  assert.match(migration, /v_carrier_profile_code NOT IN \('ntag424_dna', 'ntag424_dna_tt'\)[\s\S]*supplier_batch_key_carrier_scope_forbidden/);
  assert.match(migration, /CREATE TRIGGER trg_batch_keys_supplier_carrier_scope_v1\s+BEFORE INSERT OR UPDATE ON batch_keys/);
  assert.match(migration, /CREATE TRIGGER trg_batch_key_material_supplier_carrier_scope_v1\s+BEFORE INSERT OR UPDATE ON batch_key_material/);
});

test("0092 makes the batch carrier authoritative for every manifest row", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.nexid_import_tag_manifest_v2\(p_input jsonb\)/);
  assert.match(migration, /SELECT[\s\S]*lower\(btrim\(batch\.carrier_profile_code\)\)[\s\S]*FROM batches batch[\s\S]*FOR SHARE OF batch/);
  assert.match(migration, /v_requested_carrier IS DISTINCT FROM v_batch_carrier[\s\S]*supplier_manifest_carrier_mismatch/);
  assert.match(migration, /\(manifest_row\.value->>'carrier_profile_code'\) IS DISTINCT FROM v_batch_carrier/);
  assert.match(migration, /v_order_carrier IS DISTINCT FROM v_batch_carrier[\s\S]*supplier_manifest_supplier_scope_mismatch/);

  const secureBranch = migration.slice(
    migration.indexOf("IF v_secure_sun THEN"),
    migration.indexOf("ELSE", migration.indexOf("IF v_secure_sun THEN")),
  );
  assert.match(secureBranch, /jsonb_typeof\(manifest_row\.value->'sun_payload'\) IS DISTINCT FROM 'object'/);
  for (const hash of ["raw_url_hash", "picc_data_hash", "enc_hash", "cmac_hash"]) {
    assert.match(secureBranch, new RegExp(`sun_payload,${hash}`));
  }
  assert.match(migration, /sun_key\.key NOT IN \('raw_url_hash', 'picc_data_hash', 'enc_hash', 'cmac_hash'\)/);

  assert.match(migration, /manifest_row\.value \? 'sun_payload'[\s\S]*manifest_row\.value->'sun_payload' <> 'null'::jsonb/);
  assert.match(migration, /FROM public\.nexid_import_tag_manifest_v2_core_0081\(p_input\) AS core/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.nexid_import_tag_manifest_v2_core_0081\(jsonb\) FROM PUBLIC/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.nexid_import_tag_manifest_v2\(jsonb\) FROM PUBLIC/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.nexid_supplier_carrier_scope_integrity_v1_capability\(\) FROM PUBLIC/);

  assert.doesNotMatch(migration, /hsm_backed'\s*,\s*true|managed_kms'\s*,\s*true/i);
  assert.doesNotMatch(migration, /k_meta_hex|k_file_hex|raw_key/i);
  assert.doesNotMatch(migration, /^\s*(?:BEGIN|COMMIT|ROLLBACK)\s*;/im);
});

test("manifest import remains rolling-safe until the 0092 capability is executable", () => {
  assert.match(manifestHelper, /SUPPLIER_MANIFEST_IMPORT_V2_MIGRATION\s*=\s*\n\s*"20260802270000_0092_supplier_carrier_scope_integrity\.sql"/);
  assert.match(manifestHelper, /to_regprocedure\('public\.nexid_supplier_carrier_scope_integrity_v1_capability\(\)'\) IS NOT NULL/);
  assert.match(manifestHelper, /has_function_privilege\([\s\S]*to_regprocedure\('public\.nexid_supplier_carrier_scope_integrity_v1_capability\(\)'\)[\s\S]*'EXECUTE'/);
  assert.match(manifestHelper, /message\.includes\("nexid_supplier_carrier_scope_integrity_v1_capability"\)/);
  assert.match(importRoute, /required_migration: SUPPLIER_MANIFEST_IMPORT_V2_MIGRATION/);
  assert.doesNotMatch(importRoute, /required_migration:\s*"20260802160000_0081_supplier_manifest_atomic_import\.sql"/);
});

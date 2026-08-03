import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("supplier atomic PostgreSQL QA is an explicit disposable-target command", async () => {
  const packageJson = JSON.parse(await readFile(path.join(apiRoot, "package.json"), "utf8"));
  assert.equal(
    packageJson.scripts["db:supplier-atomic:qa"],
    "node scripts/validate-supplier-atomic-postgres-qa.mjs",
  );

  const scriptPath = path.join(apiRoot, "scripts", "validate-supplier-atomic-postgres-qa.mjs");
  const syntax = spawnSync(process.execPath, ["--check", scriptPath], {
    cwd: apiRoot,
    encoding: "utf8",
  });
  assert.equal(syntax.status, 0, syntax.stderr);

  const source = await readFile(scriptPath, "utf8");
  assert.match(source, /readSunAtomicPostgresQaConfig\(env\)/);
  assert.match(source, /assertSunAtomicPostgresQaTarget\(observer, config\)/);
  assert.match(source, /nexid_create_supplier_order_v2\(\$1::jsonb\)/);
  assert.match(source, /nexid_import_tag_manifest_v2\(\$1::jsonb\)/);
  assert.match(source, /verifyMidFunctionRollback/);
  assert.match(source, /verifyConcurrentBidOwnership/);
  assert.match(source, /verifyConcurrentGlobalUid/);
  assert.match(source, /verifyKeylessManifestRules/);
  assert.match(source, /verifyCarrierKeyScope/);
  assert.match(source, /verifyTenantIsolation/);
  assert.match(source, /commitKeylessQa/);
  assert.match(source, /verifyConcurrentActivationArchive/);
  assert.match(source, /INSERT INTO carrier_profiles/);
  assert.match(source, /canonical_carrier_catalog_fixture/);
  assert.match(source, /"cryptographic_authentication":false/);
  assert.match(source, /"requires_batch_keys":false/);
  assert.match(source, /supplier_order_mid_function_rollback/);
  assert.match(source, /supplier_bid_global_serialization/);
  assert.match(source, /manifest_global_uid_serialization/);
  assert.match(source, /manifest_carrier_and_sun_contract/);
  assert.match(source, /supplier_carrier_key_scope_integrity/);
  assert.match(source, /keyless_production_qa_acceptance/);
  assert.match(source, /activation_archive_serialization/);
  assert.match(source, /tenant_isolation/);
  assert.match(source, /production_touched: false/);
  assert.match(source, /physical_nfc_cryptographic_path_touched: false/);
  assert.match(source, /physical_packaging_evidence_validated: false/);
  assert.match(source, /raw_nfc_keys_used: false/);
  assert.match(source, /managed_kms_validated: false/);
  assert.match(source, /hsm_validated: false/);
  assert.match(source, /rls_validated: false/);
  assert.match(source, /delete_disposable_neon_branch_after_validation/);
  assert.doesNotMatch(source, /DROP\s+(?:DATABASE|SCHEMA|TABLE)|TRUNCATE/i);
  assert.doesNotMatch(source, /managed_kms_validated: true|hsm_validated: true|production_touched: true/);
});

test("supplier atomic QA fixtures use envelopes and hashes rather than raw NFC keys", async () => {
  const source = await readFile(
    path.join(apiRoot, "scripts", "validate-supplier-atomic-postgres-qa.mjs"),
    "utf8",
  );
  assert.match(source, /nexid-app-envelope-v2\.qa-only-not-a-key/);
  assert.match(source, /raw_key_material_present: false/);
  assert.doesNotMatch(source, /\bkMetaHex\b|\bkFileHex\b|\brawNfcKey\b|\braw_key_hex\b/);
});

test("supplier atomic PostgreSQL QA exercises the 0091 keyless path without fake key or hardware claims", async () => {
  const source = await readFile(
    path.join(apiRoot, "scripts", "validate-supplier-atomic-postgres-qa.mjs"),
    "utf8",
  );
  assert.match(source, /20260802260000_0091_supplier_keyless_qa_activation\.sql/);
  assert.match(source, /nexid_commit_supplier_carrier_qa_v1\(\$1::jsonb\)/);
  assert.match(source, /nexid_supplier_keyless_production_activation_receipt_v1\(uuid\)/);
  assert.match(source, /nexid_activate_supplier_tags_v2\(\$1::jsonb\)/);
  assert.match(source, /acceptance_path:\s*"keyless_carrier_v1"/);
  assert.match(source, /key_material_mode: "none"/);
  assert.match(source, /software_envelope: false/);
  assert.match(source, /managed_kms: false/);
  assert.match(source, /hsm_backed: false/);
  assert.match(source, /production_session_id, null/);
  assert.match(source, /production_receipt_id, null/);
  assert.match(source, /packaging_lab_synthetic_gate_fixture/);
  assert.match(source, /physical_evidence_validated: false/);
  assert.doesNotMatch(source, /software_envelope:\s*true|managed_kms:\s*true|hsm_backed:\s*true/);
});

test("supplier atomic PostgreSQL QA exercises 0092 manifest, key-scope and tenant boundaries", async () => {
  const source = await readFile(
    path.join(apiRoot, "scripts", "validate-supplier-atomic-postgres-qa.mjs"),
    "utf8",
  );
  assert.match(source, /20260802270000_0092_supplier_carrier_scope_integrity\.sql/);
  assert.match(source, /supplier_manifest_carrier_mismatch/);
  assert.match(source, /supplier_manifest_row_invalid/);
  assert.match(source, /supplier_batch_key_carrier_scope_forbidden/);
  assert.match(source, /supplier_batch_key_scope_incomplete/);
  assert.match(source, /supplier_batch_key_scope_invalid/);
  assert.match(source, /supplier_carrier_qa_scope_not_found/);
  assert.match(source, /authenticated_tenant_principals: 2/);
  assert.match(source, /cross_tenant_mutations: 0/);
  assert.match(source, /rls_claimed: false/);
  assert.match(source, /packaging_lab_archive_committed: true/);
  assert.match(source, /partial_or_unreceipted_activation: false/);
  assert.match(source, /'manifest_template_sha256', \$3::text/);
  assert.match(source, /'imported_manifest_sha256', \$4::text/);
});

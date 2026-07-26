import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd(), "apps/api/db/migrations");
const ids = [
  "20260723193000_0050_evidence_anchor_reconciling_status.sql",
  "20260723193500_0051_iota_evidence_anchor_v2_writer.sql",
  "20260723194500_0052_webhook_delivery_outbox.sql",
  "20260723200500_0053_admin_login_abuse_guard.sql",
  "20260723213000_0054_iota_executor_publications.sql",
  "20260724213000_0055_iota_executor_durable_broadcast.sql",
  "20260725014500_0056_iota_evidence_constraints_validate.sql",
  "20260725230000_0057_sun_rate_limit_atomic_buckets.sql",
  "20260726103000_0058_webhook_signature_v2.sql",
  "20260726135000_0059_marketplace_claim_truth_cleanup.sql",
  "20260726173000_0060_sdk_idempotency_operations.sql",
  "20260726190000_0061_supplier_export_artifact_delivery.sql",
];
const checks = [];
for (const id of ids) {
  const sql = await fs.readFile(path.join(root, id), "utf8");
  checks.push({
    id,
    bytes: Buffer.byteLength(sql),
    hasExplicitTransactionControl: /^\s*(?:BEGIN(?:\s+(?:WORK|TRANSACTION))?|START\s+TRANSACTION|COMMIT(?:\s+(?:WORK|TRANSACTION))?|ROLLBACK(?:\s+(?:WORK|TRANSACTION))?)\s*;\s*$/im.test(sql),
  });
}
const sql55 = await fs.readFile(path.join(root, "20260724213000_0055_iota_executor_durable_broadcast.sql"), "utf8");
const sql56 = await fs.readFile(path.join(root, "20260725014500_0056_iota_evidence_constraints_validate.sql"), "utf8");
const sql58 = await fs.readFile(path.join(root, "20260726103000_0058_webhook_signature_v2.sql"), "utf8");
const sql60 = await fs.readFile(path.join(root, "20260726173000_0060_sdk_idempotency_operations.sql"), "utf8");
const sql61 = await fs.readFile(path.join(root, "20260726190000_0061_supplier_export_artifact_delivery.sql"), "utf8");
const executor = await fs.readFile(path.resolve(process.cwd(), "apps/executor/src/iota-idempotency.mjs"), "utf8");
const runner = await fs.readFile(path.resolve(process.cwd(), "apps/api/scripts/db-apply.mjs"), "utf8");
const legacyRunner = await fs.readFile(path.resolve(process.cwd(), "apps/api/scripts/db-apply-file.mjs"), "utf8");
const drop = sql55.indexOf("DROP CONSTRAINT IF EXISTS iota_executor_publications_status_check");
const rewrite = sql55.indexOf("SET status = 'reserved'");
const hasProtocolCheck = sql55.includes("iota_executor_publications_protocol_v2_required_check");
const hasSignerNonceGuard = sql55.includes("uq_iota_executor_publications_signer_nonce")
  && /\(chain_id,\s*lower\(signer_address\),\s*nonce\)/m.test(sql55);
const validatesEvidenceConstraints = sql56.includes("VALIDATE CONSTRAINT evidence_anchors_iota_v2_proof_id_format")
  && sql56.includes("VALIDATE CONSTRAINT evidence_anchors_iota_v2_memo_hash_format");
const webhookV2MigrationPreservesLegacy = sql58.indexOf("SET signature_version = 'v1'") >= 0
  && sql58.indexOf("SET DEFAULT 'v2'") > sql58.indexOf("SET signature_version = 'v1'")
  && sql58.includes("CHECK (signature_version IN ('v1', 'v2'))");
const sdkIdempotencySchemaIsDurable = sql60.includes("CREATE TABLE IF NOT EXISTS sdk_idempotency_operations")
  && /\(tenant_id,\s*route,\s*idempotency_key\)/m.test(sql60)
  && sql60.includes("response_body_ciphertext text")
  && sql60.includes("idempotency_operation_id");
const supplierExportEnvelopeIsDurable = sql61.includes("encrypted_payload_base64")
  && sql61.includes("delivery_status")
  && sql61.includes("delivery_attempt_count");

const allMigrationFiles = (await fs.readdir(root)).filter((file) => file.endsWith(".sql")).sort();
let tenantApiKeysMaterialized = false;
let tenantApiKeysCanonicalCreateFound = false;
let tenantApiKeysCleanOrderSafe = true;
for (const file of allMigrationFiles) {
  const source = await fs.readFile(path.join(root, file), "utf8");
  const statements = [...source.matchAll(/CREATE TABLE IF NOT EXISTS tenant_api_keys|ALTER TABLE(?: IF EXISTS)? tenant_api_keys/g)];
  for (const statement of statements) {
    if (statement[0].startsWith("CREATE TABLE")) {
      tenantApiKeysMaterialized = true;
      tenantApiKeysCanonicalCreateFound = true;
    } else if (!tenantApiKeysMaterialized && statement[0] !== "ALTER TABLE IF EXISTS tenant_api_keys") {
      tenantApiKeysCleanOrderSafe = false;
    }
  }
}
tenantApiKeysCleanOrderSafe = tenantApiKeysCleanOrderSafe && tenantApiKeysCanonicalCreateFound;
const executorMatchesDurableStateMachine = /VALUES\s*\([^)]*'reserved'/s.test(executor)
  && /SET status = 'signed'/m.test(executor)
  && /SET status = 'broadcast'/m.test(executor)
  && /SET status = 'submitted'/m.test(executor)
  && !/VALUES\s*\([^)]*'processing'/s.test(executor)
  && !/status\s*=\s*'processing'/m.test(executor);
const runnerIsAtomic = runner.includes("containsExplicitTransactionControl")
  && runner.includes("historicalGaps")
  && runner.includes("SET LOCAL lock_timeout")
  && runner.includes("INSERT INTO schema_migrations");
const legacyBypassBlocked = legacyRunner.includes("IOTA V2 migrations require the allowlisted transactional staging runner");
const ok = checks.every((item) => item.bytes > 0)
  && drop >= 0 && rewrite > drop && hasProtocolCheck && hasSignerNonceGuard && validatesEvidenceConstraints
  && executorMatchesDurableStateMachine && webhookV2MigrationPreservesLegacy
  && sdkIdempotencySchemaIsDurable && supplierExportEnvelopeIsDurable && tenantApiKeysCleanOrderSafe
  && runnerIsAtomic && legacyBypassBlocked
  && checks.every((item) => !item.hasExplicitTransactionControl);
console.log(JSON.stringify({
  ok,
  gate: "migration_safety",
  migrations: checks,
  assertions: {
    status_constraint_dropped_before_rewrite: rewrite > drop,
    protocol_v2_check: hasProtocolCheck,
    signer_nonce_guard: hasSignerNonceGuard,
    evidence_constraints_validated: validatesEvidenceConstraints,
    webhook_v2_preserves_existing_v1: webhookV2MigrationPreservesLegacy,
    sdk_idempotency_schema_is_durable: sdkIdempotencySchemaIsDurable,
    supplier_export_envelope_is_durable: supplierExportEnvelopeIsDurable,
    tenant_api_keys_clean_order_safe: tenantApiKeysCleanOrderSafe,
    executor_matches_durable_state_machine: executorMatchesDurableStateMachine,
    runner_owns_transaction_boundary: checks.every((item) => !item.hasExplicitTransactionControl),
    runner_is_atomic_and_sparse_ledger_safe: runnerIsAtomic,
    legacy_v2_bypass_blocked: legacyBypassBlocked,
  },
}));
process.exitCode = ok ? 0 : 1;

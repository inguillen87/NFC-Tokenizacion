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
  && executorMatchesDurableStateMachine && runnerIsAtomic && legacyBypassBlocked
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
    executor_matches_durable_state_machine: executorMatchesDurableStateMachine,
    runner_owns_transaction_boundary: checks.every((item) => !item.hasExplicitTransactionControl),
    runner_is_atomic_and_sparse_ledger_safe: runnerIsAtomic,
    legacy_v2_bypass_blocked: legacyBypassBlocked,
  },
}));
process.exitCode = ok ? 0 : 1;

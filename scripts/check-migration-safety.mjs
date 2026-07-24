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
];
const checks = [];
for (const id of ids) {
  const sql = await fs.readFile(path.join(root, id), "utf8");
  checks.push({ id, bytes: Buffer.byteLength(sql), hasBegin: /^\s*BEGIN\s*;/im.test(sql), hasCommit: /COMMIT\s*;\s*$/im.test(sql) });
}
const sql55 = await fs.readFile(path.join(root, ids.at(-1)), "utf8");
const drop = sql55.indexOf("DROP CONSTRAINT IF EXISTS iota_executor_publications_status_check");
const rewrite = sql55.indexOf("SET status = 'reserved'");
const hasProtocolCheck = sql55.includes("iota_executor_publications_protocol_v2_required_check");
const ok = checks.every((item) => item.bytes > 0)
  && drop >= 0 && rewrite > drop && hasProtocolCheck
  && checks.at(-1).hasBegin && checks.at(-1).hasCommit;
console.log(JSON.stringify({ ok, gate: "migration_safety", migrations: checks, assertions: { status_constraint_dropped_before_rewrite: rewrite > drop, protocol_v2_check: hasProtocolCheck, durable_migration_transactional: checks.at(-1).hasBegin && checks.at(-1).hasCommit } }));
process.exitCode = ok ? 0 : 1;

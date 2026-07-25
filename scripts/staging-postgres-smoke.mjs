import {
  assertAllowedTarget,
  compareExactLedger,
  createStagingClient,
  expectedBaselineLedger,
  expectedLedgerForPhase,
  identifyTarget,
  readLedger,
  relevantSchemaFingerprint,
  safeFailure,
} from "./lib/staging-migration-gate.mjs";

const requiredTables = [
  "admin_login_attempt_buckets",
  "evidence_anchor_attempts",
  "evidence_anchor_members",
  "evidence_anchors",
  "iota_executor_publications",
];
const requiredColumns = {
  evidence_anchors: [
    "proof_id", "memo_hash", "public_resource_id", "contract_version", "chain_id",
    "contract_address", "publisher_address", "tenant_id_hash", "idempotency_key",
    "block_number", "confirmations", "attempt_count", "next_attempt_at", "updated_at",
  ],
  evidence_anchor_attempts: ["anchor_id", "attempt_no", "tx_hash", "nonce", "status"],
  evidence_anchor_members: ["anchor_id", "event_id", "event_hash", "leaf_index"],
  iota_executor_publications: [
    "proof_id", "request_id", "status", "payload_json", "response_json", "tx_hash",
    "nonce", "protocol_version", "payload_hash", "lease_token", "raw_transaction",
    "signer_address", "chain_id", "signed_at", "broadcast_at", "submitted_at",
  ],
  admin_login_attempt_buckets: ["bucket_kind", "bucket_key", "attempt_count", "blocked_until"],
};
const requiredIndexes = [
  "idx_evidence_anchors_reconciliation",
  "idx_iota_executor_publications_lease",
  "uq_evidence_anchor_attempts_signer_nonce",
  "uq_evidence_anchors_iota_proof_id",
  "uq_iota_executor_publications_request",
  "uq_iota_executor_publications_signer_nonce",
  "uq_iota_executor_publications_tx_hash",
];
const requiredConstraints = [
  "evidence_anchors_iota_v2_memo_hash_format",
  "evidence_anchors_iota_v2_proof_id_format",
  "iota_executor_publications_payload_hash_check",
  "iota_executor_publications_protocol_v2_required_check",
  "iota_executor_publications_protocol_version_check",
  "iota_executor_publications_raw_transaction_check",
  "iota_executor_publications_status_check",
  "iota_executor_publications_tx_hash_check",
];

let client;
let target;
try {
  const connection = createStagingClient();
  client = connection.client;
  await client.connect();
  await client.query("BEGIN TRANSACTION READ ONLY");
  await client.query("SET LOCAL statement_timeout = '15s'");
  target = await identifyTarget(client, connection.endpointFromHost);
  assertAllowedTarget(target);

  const tables = (await client.query(`SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ANY($1::text[])`, [requiredTables])).rows;
  const presentTables = new Set(tables.map((row) => row.table_name));
  const missingTables = requiredTables.filter((name) => !presentTables.has(name));
  const columns = (await client.query(`SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ANY($1::text[])`, [requiredTables])).rows;
  const columnSet = new Set(columns.map((row) => `${row.table_name}.${row.column_name}`));
  const missingColumns = Object.entries(requiredColumns).flatMap(([table, names]) => (
    names.filter((name) => !columnSet.has(`${table}.${name}`)).map((name) => `${table}.${name}`)
  ));
  const indexes = (await client.query(`SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = ANY($1::text[])`, [requiredIndexes])).rows;
  const presentIndexes = new Set(indexes.map((row) => row.indexname));
  const missingIndexes = requiredIndexes.filter((name) => !presentIndexes.has(name));
  const constraints = (await client.query(`SELECT conname, convalidated, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace AND conname = ANY($1::text[])`, [requiredConstraints])).rows;
  const constraintByName = new Map(constraints.map((row) => [row.conname, row]));
  const missingConstraints = requiredConstraints.filter((name) => !constraintByName.has(name));
  const unvalidatedConstraints = constraints.filter((row) => !row.convalidated).map((row) => row.conname).sort();
  const statusDefinition = String(constraintByName.get("iota_executor_publications_status_check")?.definition || "");
  const expectedStatuses = ["reserved", "signed", "broadcast", "submitted", "confirmed", "failed"];
  const statusConstraintValid = expectedStatuses.every((status) => statusDefinition.includes(`'${status}'`))
    && !statusDefinition.includes("'processing'");
  const enumReconciling = (await client.query(`SELECT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'evidence_anchor_status' AND e.enumlabel = 'reconciling'
  ) AS present`)).rows[0]?.present;
  const incompatibleRows = presentTables.has("iota_executor_publications")
    ? Number((await client.query(`SELECT count(*)::int AS n FROM iota_executor_publications
        WHERE status = 'processing' OR protocol_version NOT IN (1, 2)`)).rows[0]?.n || 0)
    : null;
  const ledger = compareExactLedger(
    await readLedger(client),
    expectedLedgerForPhase(expectedBaselineLedger(), "postcheck"),
  );
  const schemaFingerprint = await relevantSchemaFingerprint(client);
  await client.query("ROLLBACK");

  const ok = Boolean(
    missingTables.length === 0
    && missingColumns.length === 0
    && missingIndexes.length === 0
    && missingConstraints.length === 0
    && unvalidatedConstraints.length === 0
    && statusConstraintValid
    && enumReconciling
    && incompatibleRows === 0
    && ledger.ok
  );
  console.log(JSON.stringify({
    ok,
    gate: "postgres_staging_postcheck",
    target,
    schema_fingerprint: schemaFingerprint,
    ledger,
    missing_tables: missingTables,
    missing_columns: missingColumns,
    missing_indexes: missingIndexes,
    missing_constraints: missingConstraints,
    unvalidated_constraints: unvalidatedConstraints,
    production_ready: ok,
    status_constraint_valid: statusConstraintValid,
    enum_reconciling_present: Boolean(enumReconciling),
    incompatible_iota_publication_rows: incompatibleRows,
  }));
  process.exitCode = ok ? 0 : 1;
} catch (error) {
  await client?.query("ROLLBACK").catch(() => {});
  console.error(JSON.stringify({
    ok: false,
    gate: "postgres_staging_postcheck",
    ...safeFailure(error, "POSTGRES_STAGING_POSTCHECK_FAILED"),
    ...(target ? { target } : {}),
  }));
  process.exitCode = 1;
} finally {
  await client?.end().catch(() => {});
}

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import pg from "pg";

const RELEASE_MIGRATIONS = Object.freeze([
  "20260726173000_0060_sdk_idempotency_operations.sql",
  "20260726190000_0061_supplier_export_artifact_delivery.sql",
  "20260728120000_0062_sun_atomic_persistence.sql",
  "20260728143000_0063_supplier_packaging_governance.sql",
  "20260728160000_0064_webhook_lifecycle_governance.sql",
  "20260728173000_0065_event_incident_workflow.sql",
  "20260728180000_0066_tag_lifecycle_governance.sql",
  "20260728183000_0067_canonical_event_outbox.sql",
  "20260729110000_0068_epcis_event_type.sql",
  "20260729110500_0069_gs1_epcis_foundation.sql",
  "20260729130000_0070_supplier_qa_atomic_receipts.sql",
  "20260729143000_0071_supplier_pack_purpose_governance.sql",
  "20260729160000_0072_tokenization_marketplace_execution_governance.sql",
  "20260730110000_0073_supplier_qa_verification_context_v2.sql",
  "20260730150000_0074_supplier_key_rotation_atomic.sql",
]);
const REQUIRED_APPLIED = Object.freeze([
  "20260725230000_0057_sun_rate_limit_atomic_buckets.sql",
  "20260726103000_0058_webhook_signature_v2.sql",
  "20260726120000_0058_marketplace_runtime_baseline.sql",
  "20260726135000_0059_marketplace_claim_truth_cleanup.sql",
]);

const databaseUrl = String(process.env.DATABASE_URL || "").trim();
const expectedFingerprint = String(process.env.NEXID_APPROVED_DATABASE_FINGERPRINT || "").trim().toLowerCase();
if (!databaseUrl) throw new Error("DATABASE_URL is required");
if (!/^sha256:[0-9a-f]{64}$/.test(expectedFingerprint)) {
  throw new Error("NEXID_APPROVED_DATABASE_FINGERPRINT is required");
}

const migrationsDir = path.resolve(process.cwd(), "db", "migrations");
const migrationBodies = await Promise.all(RELEASE_MIGRATIONS.map(async (id) => {
  const body = await fs.readFile(path.join(migrationsDir, id), "utf8");
  return { id, body, sha256: createHash("sha256").update(body).digest("hex") };
}));

const client = new pg.Client({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 5_000,
  query_timeout: 90_000,
});
await client.connect();

try {
  const target = (await client.query(`SELECT
    current_database() AS database,
    current_user AS database_role,
    current_setting('neon.endpoint_id', true) AS endpoint_id`)).rows[0];
  const identity = [target.endpoint_id, target.database, target.database_role].join("|");
  const actualFingerprint = `sha256:${createHash("sha256").update(identity).digest("hex")}`;
  if (actualFingerprint !== expectedFingerprint) throw new Error("approved_database_fingerprint_mismatch");

  const ledger = await client.query(
    "SELECT id FROM schema_migrations WHERE id = ANY($1::text[])",
    [[...REQUIRED_APPLIED, ...RELEASE_MIGRATIONS]],
  );
  const applied = new Set(ledger.rows.map((row) => String(row.id)));
  const missingPrerequisites = REQUIRED_APPLIED.filter((id) => !applied.has(id));
  const alreadyApplied = RELEASE_MIGRATIONS.filter((id) => applied.has(id));
  if (missingPrerequisites.length) throw new Error(`release_prerequisites_missing:${missingPrerequisites.join(",")}`);
  if (alreadyApplied.length) throw new Error(`release_migration_already_applied:${alreadyApplied.join(",")}`);
  const baseline = (await client.query(`SELECT
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'marketplace_offers'
        AND column_name = 'seller_consumer_id'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'marketplace_offers'
        AND column_name = 'resale_uid_hex'
    ) AS ready`)).rows[0];
  if (!baseline?.ready) throw new Error("marketplace_runtime_baseline_missing");

  await client.query("BEGIN");
  await client.query("SET LOCAL lock_timeout = '5s'");
  await client.query("SET LOCAL statement_timeout = '90s'");
  await client.query("SELECT pg_advisory_xact_lock(487421337)");
  for (const migration of migrationBodies) {
    await client.query(migration.body);
    await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [migration.id]);
  }

  const postcheck = (await client.query(`SELECT
    to_regclass('public.sdk_idempotency_operations') IS NOT NULL AS sdk_idempotency_operations,
    to_regclass('public.vault_artifacts') IS NOT NULL AS vault_artifacts,
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'vault_artifacts'
        AND column_name = 'encrypted_payload_base64'
    ) AS supplier_export_envelope,
    to_regprocedure('public.nexid_persist_sun_scan_v1(jsonb)') IS NOT NULL AS sun_atomic_persistence,
    to_regclass('public.uq_tags_batch_uid_upper') IS NOT NULL AS sun_casefold_uid_guard,
    to_regclass('public.supplier_packaging_governance_decisions') IS NOT NULL AS supplier_packaging_governance,
    to_regprocedure('public.nexid_record_supplier_packaging_decision_v1(jsonb)') IS NOT NULL AS supplier_packaging_governance_writer,
    to_regclass('public.webhook_endpoint_audit_events') IS NOT NULL AS webhook_lifecycle_audit,
    to_regclass('public.event_incidents') IS NOT NULL AS event_incidents,
    to_regclass('public.event_incident_history') IS NOT NULL AS event_incident_history,
    to_regprocedure('public.nexid_open_event_incident(bigint,text,text,text,text,uuid,text,text,text)') IS NOT NULL AS event_incident_open_writer,
    to_regprocedure('public.nexid_transition_event_incident(uuid,text,text,text,uuid,text,text,text,text)') IS NOT NULL AS event_incident_transition_writer,
    to_regclass('public.tag_lifecycle_events') IS NOT NULL AS tag_lifecycle_events,
    to_regprocedure('public.nexid_transition_tag_lifecycle_v1(jsonb)') IS NOT NULL AS tag_lifecycle_writer,
    to_regclass('public.canonical_event_operations') IS NOT NULL AS canonical_event_operations,
    to_regprocedure('public.nexid_write_canonical_event_v1(jsonb)') IS NOT NULL AS canonical_event_writer,
    to_regclass('public.gs1_digital_link_identities') IS NOT NULL AS gs1_digital_link_identities,
    to_regclass('public.epcis_capture_operations') IS NOT NULL AS epcis_capture_operations,
    to_regclass('public.epcis_events') IS NOT NULL AS epcis_events,
    to_regprocedure('public.nexid_capture_epcis_document_v1(jsonb)') IS NOT NULL AS epcis_capture_writer,
    to_regclass('public.supplier_qa_diagnostic_consumptions') IS NOT NULL AS supplier_qa_diagnostic_consumptions,
    to_regprocedure('public.nexid_commit_supplier_qa_v1(jsonb)') IS NOT NULL AS supplier_qa_atomic_writer,
    to_regclass('public.supplier_qa_verification_context_receipts') IS NOT NULL AS supplier_qa_verification_context_receipts,
    to_regprocedure('public.nexid_commit_supplier_qa_v2(jsonb)') IS NOT NULL AS supplier_qa_verification_context_writer,
    to_regprocedure('public.nexid_supplier_qa_verification_context_v2_capability()') IS NOT NULL AS supplier_qa_verification_context_capability,
    COALESCE(has_function_privilege(current_user,
      to_regprocedure('public.nexid_commit_supplier_qa_v2(jsonb)'), 'EXECUTE'), false)
      AS can_commit_supplier_qa_v2,
    COALESCE(has_function_privilege(current_user,
      to_regprocedure('public.nexid_supplier_qa_canonical_json_v2(jsonb)'), 'EXECUTE'), false)
      AS can_canonicalize_supplier_qa_v2,
    COALESCE(has_table_privilege(current_user,
      to_regclass('public.supplier_qa_verification_context_receipts'), 'SELECT,INSERT'), false)
      AS can_write_supplier_qa_verification_context_receipts,
    to_regprocedure('public.nexid_rotate_supplier_batch_keys_v2(jsonb)') IS NOT NULL AS supplier_key_rotation_v2_writer,
    to_regprocedure('public.nexid_supplier_key_rotation_v2_capability()') IS NOT NULL AS supplier_key_rotation_v2_capability,
    COALESCE(has_function_privilege(current_user,
      to_regprocedure('public.nexid_rotate_supplier_batch_keys_v2(jsonb)'), 'EXECUTE'), false)
      AS can_rotate_supplier_batch_keys_v2,
    COALESCE(has_function_privilege(current_user,
      to_regprocedure('public.nexid_supplier_key_rotation_v2_capability()'), 'EXECUTE'), false)
      AS can_probe_supplier_key_rotation_v2,
    to_regclass('public.supplier_pack_purpose_decisions') IS NOT NULL AS supplier_pack_purpose_decisions,
    to_regclass('public.supplier_pack_purpose_decision_items') IS NOT NULL AS supplier_pack_purpose_decision_items,
    to_regprocedure('public.nexid_assert_supplier_commercial_release_v1(uuid)') IS NOT NULL AS supplier_commercial_release_guard,
    to_regprocedure('public.nexid_supplier_commercial_sink_guard_v1()') IS NOT NULL AS supplier_commercial_sink_guard,
    to_regprocedure('public.nexid_prepare_tokenization_execution_v1(uuid,uuid,uuid,text,integer)') IS NOT NULL AS tokenization_execution_prepare,
    to_regclass('public.uq_tokenization_request_asset_execution') IS NOT NULL AS tokenization_asset_dedupe,
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tokenization_requests'
        AND column_name = 'source_event_created_at'
    ) AS tokenization_partition_event_identity,
    (
        SELECT count(*) = 6
      FROM pg_trigger trigger_row
      WHERE NOT trigger_row.tgisinternal
        AND trigger_row.tgenabled <> 'D'
        AND (
          (trigger_row.tgname = 'trg_nexid_tokenization_execution_scope_v1'
            AND trigger_row.tgrelid = to_regclass('public.tokenization_requests'))
          OR (trigger_row.tgname = 'trg_nexid_marketplace_request_asset_scope_v1'
            AND trigger_row.tgrelid = to_regclass('public.marketplace_order_requests'))
          OR (trigger_row.tgname = 'trg_nexid_marketplace_offer_asset_scope_v1'
            AND trigger_row.tgrelid = to_regclass('public.marketplace_offers'))
          OR (trigger_row.tgname = 'trg_nexid_marketplace_ownership_offer_invalidation_v1'
            AND trigger_row.tgrelid = to_regclass('public.consumer_product_ownerships'))
          OR (trigger_row.tgname = 'trg_nexid_marketplace_tag_offer_invalidation_v1'
            AND trigger_row.tgrelid = to_regclass('public.tags'))
          OR (trigger_row.tgname = 'trg_nexid_marketplace_batch_offer_invalidation_v1'
            AND trigger_row.tgrelid = to_regclass('public.batches'))
        )
    ) AS tokenization_marketplace_scope_triggers,
    (
      SELECT count(*) = 5
      FROM pg_trigger trigger_row
      WHERE NOT trigger_row.tgisinternal
        AND trigger_row.tgname IN (
          'trg_supplier_batch_commercial_transition_guard',
          'trg_supplier_tag_commercial_transition_guard',
          'trg_supplier_sdk_pos_commercial_guard',
          'trg_supplier_sdk_claim_commercial_guard',
          'trg_supplier_consumer_ownership_commercial_guard'
        )
    ) AS supplier_commercial_guard_triggers,
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'canonical_event_operations'
        AND column_name = 'source_event_created_at'
    ) AS canonical_source_partition_identity,
    (SELECT count(*)::int FROM schema_migrations WHERE id = ANY($1::text[])) AS release_ledger_count`,
    [RELEASE_MIGRATIONS])).rows[0];
  if (
    !postcheck.sdk_idempotency_operations
    || !postcheck.vault_artifacts
    || !postcheck.supplier_export_envelope
    || !postcheck.sun_atomic_persistence
    || !postcheck.sun_casefold_uid_guard
    || !postcheck.supplier_packaging_governance
    || !postcheck.supplier_packaging_governance_writer
    || !postcheck.webhook_lifecycle_audit
    || !postcheck.event_incidents
    || !postcheck.event_incident_history
    || !postcheck.event_incident_open_writer
    || !postcheck.event_incident_transition_writer
    || !postcheck.tag_lifecycle_events
    || !postcheck.tag_lifecycle_writer
    || !postcheck.canonical_event_operations
    || !postcheck.canonical_event_writer
    || !postcheck.gs1_digital_link_identities
    || !postcheck.epcis_capture_operations
    || !postcheck.epcis_events
    || !postcheck.epcis_capture_writer
    || !postcheck.supplier_qa_diagnostic_consumptions
    || !postcheck.supplier_qa_atomic_writer
    || !postcheck.supplier_qa_verification_context_receipts
    || !postcheck.supplier_qa_verification_context_writer
    || !postcheck.supplier_qa_verification_context_capability
    || !postcheck.can_commit_supplier_qa_v2
    || !postcheck.can_canonicalize_supplier_qa_v2
    || !postcheck.can_write_supplier_qa_verification_context_receipts
    || !postcheck.supplier_key_rotation_v2_writer
    || !postcheck.supplier_key_rotation_v2_capability
    || !postcheck.can_rotate_supplier_batch_keys_v2
    || !postcheck.can_probe_supplier_key_rotation_v2
    || !postcheck.supplier_pack_purpose_decisions
    || !postcheck.supplier_pack_purpose_decision_items
    || !postcheck.supplier_commercial_release_guard
    || !postcheck.supplier_commercial_sink_guard
    || !postcheck.supplier_commercial_guard_triggers
    || !postcheck.tokenization_execution_prepare
    || !postcheck.tokenization_asset_dedupe
    || !postcheck.tokenization_partition_event_identity
    || !postcheck.tokenization_marketplace_scope_triggers
    || !postcheck.canonical_source_partition_identity
    || postcheck.release_ledger_count !== RELEASE_MIGRATIONS.length
  ) throw new Error("release_dry_run_postcheck_failed");

  await client.query("ROLLBACK");
  console.log(JSON.stringify({
    ok: true,
    gate: "enterprise_release_dry_run",
    target_fingerprint: actualFingerprint,
    migrations: migrationBodies.map(({ id, sha256 }) => ({ id, sha256: `sha256:${sha256}` })),
    postcheck,
    committed: false,
  }));
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(JSON.stringify({
    ok: false,
    gate: "enterprise_release_dry_run",
    reason: error instanceof Error ? error.message : "release_dry_run_failed",
  }));
  process.exitCode = 1;
} finally {
  await client.end();
}

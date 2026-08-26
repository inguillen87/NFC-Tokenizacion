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
  "20260801090000_0075_supplier_production_qa_acceptance.sql",
  "20260802090000_0076_supplier_production_activation_v2.sql",
  "20260802113000_0077_tenant_api_key_lifecycle.sql",
  "20260802130000_0078_webhook_destination_cutover.sql",
  "20260802150000_0079_supplier_order_atomic_create.sql",
  "20260802153000_0080_offline_scan_history_index.sql",
  "20260802160000_0081_supplier_manifest_atomic_import.sql",
  "20260802170000_0082_consumer_session_revocation.sql",
  "20260802180000_0083_sdk_event_webhook_atomic_outbox.sql",
  "20260802185000_0083b_vault_artifact_status_bridge.sql",
  "20260802190000_0084_tenant_vault_audited_download.sql",
  "20260802200000_0085_supplier_non_sun_qa_evidence.sql",
  "20260802210000_0086_supplier_order_lifecycle.sql",
  "20260802220000_0087_packaging_lab_foundation.sql",
  "20260802225000_0087b_webhook_delivery_identity_bridge.sql",
  "20260802230000_0088_enterprise_event_profile.sql",
  "20260802240000_0089_sun_carrier_trust_state.sql",
  "20260802250000_0090_supplier_carrier_key_scope.sql",
  "20260802255000_0090b_vault_artifact_canonical_bridge.sql",
  "20260802260000_0091_supplier_keyless_qa_activation.sql",
  "20260802270000_0092_supplier_carrier_scope_integrity.sql",
  "20260802280000_0093_sun_tt_durable_truth_binding.sql",
  "20260802290000_0094_sun_runtime_acl_boundary.sql",
  "20260802300000_0095_sun_tt_conflict_target.sql",
  "20260802310000_0096_enterprise_rbac_risk_truth.sql",
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
    to_regclass('public.tenant_api_key_lifecycle_receipts') IS NOT NULL AS tenant_api_key_lifecycle_receipts,
    to_regprocedure('public.nexid_tenant_api_key_lifecycle_v1_capability()') IS NOT NULL AS tenant_api_key_lifecycle_capability,
    to_regprocedure('public.nexid_create_tenant_api_key_v1(jsonb)') IS NOT NULL AS tenant_api_key_create_writer,
    to_regprocedure('public.nexid_mutate_tenant_api_key_v1(jsonb)') IS NOT NULL AS tenant_api_key_mutation_writer,
    EXISTS (
      SELECT 1 FROM pg_trigger trigger_row
      WHERE NOT trigger_row.tgisinternal
        AND trigger_row.tgenabled <> 'D'
        AND trigger_row.tgname = 'trg_tenant_api_key_lifecycle_guard_v1'
        AND trigger_row.tgrelid = to_regclass('public.tenant_api_keys')
    ) AS tenant_api_key_lifecycle_guard,
    EXISTS (
      SELECT 1 FROM pg_trigger trigger_row
      WHERE NOT trigger_row.tgisinternal
        AND trigger_row.tgenabled <> 'D'
        AND trigger_row.tgname = 'trg_tenant_api_key_lifecycle_receipts_append_only'
        AND trigger_row.tgrelid = to_regclass('public.tenant_api_key_lifecycle_receipts')
    ) AS tenant_api_key_receipts_append_only,
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
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'webhook_endpoints'
        AND column_name = 'destination_version'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'webhook_deliveries'
        AND column_name = 'destination_version'
    ) AS webhook_destination_versions,
    to_regprocedure('public.nexid_webhook_destination_version_v1()') IS NOT NULL
      AND to_regprocedure('public.nexid_webhook_delivery_destination_snapshot_v1()') IS NOT NULL
      AND to_regprocedure('public.nexid_webhook_delivery_identity_immutable_v1()') IS NOT NULL
      AS webhook_destination_cutover_functions,
    to_regprocedure('public.nexid_enqueue_tenant_webhook_outbox_v1(uuid,text,text,jsonb,timestamp with time zone)') IS NOT NULL
      AND to_regprocedure('public.nexid_write_sdk_external_event_v1(jsonb)') IS NOT NULL
      AS sdk_event_atomic_outbox_functions,
    COALESCE(has_function_privilege(current_user,
      to_regprocedure('public.nexid_enqueue_tenant_webhook_outbox_v1(uuid,text,text,jsonb,timestamp with time zone)'), 'EXECUTE'), false)
      AND COALESCE(has_function_privilege(current_user,
      to_regprocedure('public.nexid_write_sdk_external_event_v1(jsonb)'), 'EXECUTE'), false)
      AS can_use_sdk_event_atomic_outbox,
    to_regprocedure('public.nexid_supplier_order_create_v2_capability()') IS NOT NULL
      AND to_regprocedure('public.nexid_create_supplier_order_v2(jsonb)') IS NOT NULL
      AS supplier_order_atomic_create_functions,
    COALESCE(has_function_privilege(current_user,
      to_regprocedure('public.nexid_supplier_order_create_v2_capability()'), 'EXECUTE'), false)
      AND COALESCE(has_function_privilege(current_user,
      to_regprocedure('public.nexid_create_supplier_order_v2(jsonb)'), 'EXECUTE'), false)
      AS can_create_supplier_order_v2,
    to_regclass('public.idx_offline_scan_events_tenant_history') IS NOT NULL
      AS offline_scan_history_index,
    to_regclass('public.tag_sun_payloads') IS NOT NULL
      AND to_regclass('public.uq_tags_uid_hex_global') IS NOT NULL
      AND to_regprocedure('public.nexid_supplier_manifest_import_v2_capability()') IS NOT NULL
      AND to_regprocedure('public.nexid_import_tag_manifest_v2(jsonb)') IS NOT NULL
      AND COALESCE((
        SELECT routine.prosecdef
          AND routine.proowner = core_routine.proowner
          AND routine.proconfig @> ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
        FROM pg_proc routine
        JOIN pg_proc core_routine
          ON core_routine.oid = to_regprocedure('public.nexid_import_tag_manifest_v2_core_0081(jsonb)')
        WHERE routine.oid = to_regprocedure('public.nexid_import_tag_manifest_v2(jsonb)')
      ), false)
      AND NOT COALESCE((
        SELECT routine.prosecdef
        FROM pg_proc routine
        WHERE routine.oid = to_regprocedure('public.nexid_import_tag_manifest_v2_core_0081(jsonb)')
      ), true)
      AS supplier_manifest_atomic_import,
    to_regprocedure('public.nexid_jsonb_contains_secret_key_v1(jsonb)') IS NOT NULL
      AND to_regprocedure('public.nexid_jsonb_contains_secret_key_v1(jsonb,integer)') IS NOT NULL
      AS supplier_manifest_secret_scanners,
    COALESCE(has_function_privilege(current_user,
      to_regprocedure('public.nexid_supplier_manifest_import_v2_capability()'), 'EXECUTE'), false)
      AND COALESCE(has_function_privilege(current_user,
      to_regprocedure('public.nexid_import_tag_manifest_v2(jsonb)'), 'EXECUTE'), false)
      AS can_import_supplier_manifest_v2,
    COALESCE(has_function_privilege(current_user,
      to_regprocedure('public.nexid_jsonb_contains_secret_key_v1(jsonb)'), 'EXECUTE'), false)
      AND COALESCE(has_function_privilege(current_user,
      to_regprocedure('public.nexid_jsonb_contains_secret_key_v1(jsonb,integer)'), 'EXECUTE'), false)
      AS can_scan_supplier_manifest_secrets,
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
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'consumer_sessions'
        AND column_name = 'revoked_at'
    ) AND to_regclass('public.idx_consumer_sessions_active') IS NOT NULL
      AS consumer_session_revocation,
    to_regprocedure('public.nexid_sun_runtime_acl_v1_capability()') IS NOT NULL
      AND COALESCE((
        SELECT wrapper_routine.prosecdef
          AND base_routine.prosecdef
          AND NOT historical_routine.prosecdef
          AND wrapper_routine.proowner = base_routine.proowner
          AND wrapper_routine.proowner = historical_routine.proowner
          AND wrapper_routine.proconfig = ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
          AND base_routine.proconfig = ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
          AND historical_routine.proconfig = ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
        FROM pg_proc wrapper_routine
        JOIN pg_proc base_routine
          ON base_routine.oid = to_regprocedure('public.nexid_persist_sun_scan_v1_base_0062(jsonb)')
        JOIN pg_proc historical_routine
          ON historical_routine.oid = to_regprocedure('public.nexid_persist_sun_scan_v1_base_pre_tt_0093(jsonb)')
        WHERE wrapper_routine.oid = to_regprocedure('public.nexid_persist_sun_scan_v1(jsonb)')
      ), false)
      AND NOT has_schema_privilege('public', 'public', 'CREATE')
      AND NOT COALESCE(EXISTS (
        SELECT 1
        FROM pg_proc routine
        CROSS JOIN LATERAL aclexplode(COALESCE(routine.proacl, acldefault('f', routine.proowner))) acl
        WHERE routine.oid IN (
          to_regprocedure('public.nexid_persist_sun_scan_v1(jsonb)'),
          to_regprocedure('public.nexid_persist_sun_scan_v1_base_0062(jsonb)'),
          to_regprocedure('public.nexid_persist_sun_scan_v1_base_pre_tt_0093(jsonb)')
        )
          AND acl.grantee = 0
          AND acl.privilege_type = 'EXECUTE'
      ), false) AS sun_runtime_acl_boundary,
    to_regprocedure('public.nexid_sun_tt_conflict_target_v1_capability()') IS NOT NULL
      AND COALESCE(position(
        'ON CONFLICT ON CONSTRAINT sun_tt_truth_receipts_pkey DO NOTHING'
        IN pg_get_functiondef(to_regprocedure('public.nexid_persist_sun_scan_v1_base_0062(jsonb)'))
      ) > 0, false)
      AND COALESCE(position(
        'ON CONFLICT (event_id, event_created_at) DO NOTHING'
        IN pg_get_functiondef(to_regprocedure('public.nexid_persist_sun_scan_v1_base_0062(jsonb)'))
      ) = 0, false)
      AND EXISTS (
        SELECT 1
        FROM pg_constraint constraint_row
        WHERE constraint_row.conrelid = to_regclass('public.sun_tt_truth_receipts')
          AND constraint_row.conname = 'sun_tt_truth_receipts_pkey'
          AND constraint_row.contype = 'p'
          AND (
            SELECT array_agg(attribute_row.attname::text ORDER BY key_column.ordinality)
            FROM unnest(constraint_row.conkey) WITH ORDINALITY key_column(attnum, ordinality)
            JOIN pg_attribute attribute_row
              ON attribute_row.attrelid = constraint_row.conrelid
             AND attribute_row.attnum = key_column.attnum
          ) = ARRAY['event_id', 'event_created_at']::text[]
      )
      AND NOT COALESCE(EXISTS (
        SELECT 1
        FROM pg_proc routine
        CROSS JOIN LATERAL aclexplode(COALESCE(routine.proacl, acldefault('f', routine.proowner))) acl
        WHERE routine.oid IN (
          to_regprocedure('public.nexid_persist_sun_scan_v1(jsonb)'),
          to_regprocedure('public.nexid_persist_sun_scan_v1_base_0062(jsonb)'),
          to_regprocedure('public.nexid_persist_sun_scan_v1_base_pre_tt_0093(jsonb)'),
          to_regprocedure('public.nexid_sun_tt_conflict_target_v1_capability()')
        )
          AND acl.grantee = 0
          AND acl.privilege_type = 'EXECUTE'
      ), false) AS sun_tt_conflict_target,
    to_regprocedure('public.nexid_enterprise_rbac_risk_truth_v1_capability()') IS NOT NULL
      AND to_regprocedure('public.nexid_compute_event_risk_v1(uuid,uuid,text,text,text,text,jsonb)') IS NOT NULL
      AND to_regprocedure('public.nexid_backfill_event_risk_v1(integer)') IS NOT NULL
      AND to_regprocedure('public.nexid_actor_has_enterprise_capability_v1(uuid,uuid,text,text)') IS NOT NULL
      AND to_regprocedure('public.nexid_validate_supplier_qa_plan_dual_control_v1()') IS NOT NULL
      AND to_regclass('public.event_risk_projections') IS NOT NULL
      AND to_regclass('public.enterprise_authority_scope_locks') IS NOT NULL
      AND (
        SELECT count(*)
        FROM pg_attribute attribute_row
        WHERE attribute_row.attrelid = to_regclass('public.enterprise_authority_scope_locks')
          AND attribute_row.attnum > 0
          AND NOT attribute_row.attisdropped
      ) = 3
      AND NOT EXISTS (
        SELECT 1
        FROM (VALUES
          ('user_id', 'pg_catalog.uuid'::regtype, true, false),
          ('scope_key', 'pg_catalog.text'::regtype, true, false),
          ('lock_version', 'pg_catalog.int8'::regtype, true, true)
        ) AS expected(column_name, type_oid, is_not_null, has_zero_default)
        WHERE NOT EXISTS (
          SELECT 1
          FROM pg_attribute attribute_row
          LEFT JOIN pg_attrdef default_row
            ON default_row.adrelid = attribute_row.attrelid
           AND default_row.adnum = attribute_row.attnum
          WHERE attribute_row.attrelid = to_regclass('public.enterprise_authority_scope_locks')
            AND attribute_row.attname = expected.column_name
            AND attribute_row.atttypid = expected.type_oid
            AND attribute_row.atttypmod = -1
            AND attribute_row.attnotnull = expected.is_not_null
            AND attribute_row.attidentity = ''
            AND attribute_row.attgenerated = ''
            AND NOT attribute_row.attisdropped
            AND (
              (NOT expected.has_zero_default AND default_row.oid IS NULL)
              OR (
                expected.has_zero_default
                AND regexp_replace(
                  lower(pg_get_expr(default_row.adbin, default_row.adrelid)),
                  '[[:space:]()]', '', 'g'
                ) = ANY (ARRAY['0', '0::bigint', '''0''::bigint']::text[])
              )
            )
        )
      )
      AND EXISTS (
        SELECT 1
        FROM pg_constraint constraint_row
        WHERE constraint_row.conrelid = to_regclass('public.enterprise_authority_scope_locks')
          AND constraint_row.conname = 'enterprise_authority_scope_locks_pkey'
          AND constraint_row.contype = 'p'
          AND constraint_row.convalidated
          AND (
            SELECT array_agg(attribute_row.attname::text ORDER BY key_column.ordinality)
            FROM unnest(constraint_row.conkey) WITH ORDINALITY key_column(attnum, ordinality)
            JOIN pg_attribute attribute_row
              ON attribute_row.attrelid = constraint_row.conrelid
             AND attribute_row.attnum = key_column.attnum
          ) = ARRAY['user_id', 'scope_key']::text[]
      )
      AND EXISTS (
        SELECT 1
        FROM pg_constraint constraint_row
        WHERE constraint_row.conrelid = to_regclass('public.enterprise_authority_scope_locks')
          AND constraint_row.conname = 'enterprise_authority_scope_locks_scope_check'
          AND constraint_row.contype = 'c'
          AND constraint_row.convalidated
          AND regexp_replace(
            lower(pg_get_expr(constraint_row.conbin, constraint_row.conrelid)),
            '[[:space:]()]', '', 'g'
          ) = 'scope_key=''global''::textorscope_key~''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''::text'
      )
      AND to_regprocedure('public.nexid_touch_authority_scope_lock_v1(uuid,uuid)') IS NOT NULL
      AND to_regprocedure('public.nexid_serialize_authority_scope_v1()') IS NOT NULL
      AND COALESCE((
        SELECT touch_routine.prosecdef
          AND serializer_routine.prosecdef
          AND touch_routine.proowner = serializer_routine.proowner
          AND touch_routine.proowner = lock_relation.relowner
          AND touch_routine.proconfig @> ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
          AND serializer_routine.proconfig @> ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
        FROM pg_proc touch_routine
        JOIN pg_proc serializer_routine
          ON serializer_routine.oid = to_regprocedure('public.nexid_serialize_authority_scope_v1()')
        JOIN pg_class lock_relation
          ON lock_relation.oid = to_regclass('public.enterprise_authority_scope_locks')
         AND lock_relation.relkind = 'r'
        WHERE touch_routine.oid = to_regprocedure('public.nexid_touch_authority_scope_lock_v1(uuid,uuid)')
      ), false)
      AND COALESCE(pg_get_functiondef(
        to_regprocedure('public.nexid_touch_authority_scope_lock_v1(uuid,uuid)')
      ) LIKE '%pg_advisory_xact_lock%INSERT INTO public.enterprise_authority_scope_locks%ON CONFLICT (user_id, scope_key) DO UPDATE%lock_version + 1%', false)
      AND COALESCE(pg_get_functiondef(
        to_regprocedure('public.nexid_serialize_authority_scope_v1()')
      ) LIKE '%ELSIF v_old_identity < v_new_identity THEN%nexid_touch_authority_scope_lock_v1(OLD.user_id, OLD.tenant_id)%nexid_touch_authority_scope_lock_v1(NEW.user_id, NEW.tenant_id)%ELSE%nexid_touch_authority_scope_lock_v1(NEW.user_id, NEW.tenant_id)%nexid_touch_authority_scope_lock_v1(OLD.user_id, OLD.tenant_id)%', false)
      AND EXISTS (
        SELECT 1 FROM pg_trigger trigger_row
        WHERE trigger_row.tgrelid = to_regclass('public.resource_permissions')
          AND trigger_row.tgname = 'trg_resource_permissions_scope_serialize'
          AND trigger_row.tgfoid = to_regprocedure('public.nexid_serialize_authority_scope_v1()')
          AND trigger_row.tgtype = 23
          AND NOT trigger_row.tgisinternal
          AND trigger_row.tgenabled <> 'D'
          AND NOT trigger_row.tgdeferrable
          AND NOT trigger_row.tginitdeferred
      )
      AND EXISTS (
        SELECT 1 FROM pg_trigger trigger_row
        WHERE trigger_row.tgrelid = to_regclass('public.memberships')
          AND trigger_row.tgname = 'trg_memberships_permission_scope_serialize'
          AND trigger_row.tgfoid = to_regprocedure('public.nexid_serialize_authority_scope_v1()')
          AND trigger_row.tgtype = 27
          AND NOT trigger_row.tgisinternal
          AND trigger_row.tgenabled <> 'D'
          AND NOT trigger_row.tgdeferrable
          AND NOT trigger_row.tginitdeferred
      )
      AND (
        SELECT count(*)
        FROM pg_attribute attribute_row
        WHERE attribute_row.attrelid = to_regclass('public.event_risk_projections')
          AND attribute_row.attnum > 0
          AND NOT attribute_row.attisdropped
      ) = 9
      AND NOT EXISTS (
        SELECT 1
        FROM (VALUES
          ('event_id', 'pg_catalog.int8'::regtype, true, NULL::text),
          ('event_created_at', 'pg_catalog.timestamptz'::regtype, true, NULL::text),
          ('tenant_id', 'pg_catalog.uuid'::regtype, true, NULL::text),
          ('risk_profile_version', 'pg_catalog.text'::regtype, true, NULL::text),
          ('risk_score', 'pg_catalog.int4'::regtype, true, NULL::text),
          ('risk_level', 'public.risk_level'::regtype, true, NULL::text),
          ('triggered_rules', 'pg_catalog.jsonb'::regtype, true, NULL::text),
          ('recommended_action', 'pg_catalog.text'::regtype, true, NULL::text),
          ('projected_at', 'pg_catalog.timestamptz'::regtype, true, 'now()'::text)
        ) AS expected(column_name, type_oid, is_not_null, default_expression)
        WHERE NOT EXISTS (
          SELECT 1
          FROM pg_attribute attribute_row
          LEFT JOIN pg_attrdef default_row
            ON default_row.adrelid = attribute_row.attrelid
           AND default_row.adnum = attribute_row.attnum
          WHERE attribute_row.attrelid = to_regclass('public.event_risk_projections')
            AND attribute_row.attname = expected.column_name
            AND attribute_row.atttypid = expected.type_oid
            AND attribute_row.atttypmod = -1
            AND attribute_row.attnotnull = expected.is_not_null
            AND NOT attribute_row.attisdropped
            AND (
              (expected.default_expression IS NULL AND default_row.oid IS NULL)
              OR pg_get_expr(default_row.adbin, default_row.adrelid)
                = expected.default_expression
            )
        )
      )
      AND EXISTS (
        SELECT 1 FROM pg_constraint constraint_row
        WHERE constraint_row.conrelid = to_regclass('public.event_risk_projections')
          AND constraint_row.conname = 'event_risk_projections_pkey'
          AND constraint_row.contype = 'p'
          AND constraint_row.convalidated
          AND (
            SELECT array_agg(attribute_row.attname::text ORDER BY key_column.ordinality)
            FROM unnest(constraint_row.conkey) WITH ORDINALITY key_column(attnum, ordinality)
            JOIN pg_attribute attribute_row
              ON attribute_row.attrelid = constraint_row.conrelid
             AND attribute_row.attnum = key_column.attnum
          ) = ARRAY['event_id', 'event_created_at', 'risk_profile_version']::text[]
      )
      AND (
        SELECT count(*)
        FROM pg_constraint constraint_row
        WHERE constraint_row.conrelid = to_regclass('public.event_risk_projections')
          AND constraint_row.contype = 'c'
          AND constraint_row.convalidated
          AND (
            (constraint_row.conname = 'event_risk_projections_version_check'
              AND regexp_replace(lower(pg_get_expr(constraint_row.conbin, constraint_row.conrelid)), '[[:space:]()]', '', 'g') = 'risk_profile_version=''nexid-risk-v1''::text')
            OR (constraint_row.conname = 'event_risk_projections_score_check'
              AND regexp_replace(lower(pg_get_expr(constraint_row.conbin, constraint_row.conrelid)), '[[:space:]()]', '', 'g') = 'risk_score>=0andrisk_score<=100')
            OR (constraint_row.conname = 'event_risk_projections_rules_check'
              AND regexp_replace(lower(pg_get_expr(constraint_row.conbin, constraint_row.conrelid)), '[[:space:]()]', '', 'g') = 'jsonb_typeoftriggered_rules=''array''::text')
          )
      ) = 3
      AND EXISTS (
        SELECT 1 FROM pg_index index_row
        WHERE index_row.indexrelid = to_regclass('public.idx_event_risk_projections_tenant_created')
          AND index_row.indrelid = to_regclass('public.event_risk_projections')
          AND index_row.indisvalid
          AND index_row.indisready
          AND index_row.indislive
          AND NOT index_row.indisunique
          AND index_row.indnkeyatts = 4
          AND index_row.indnatts = 4
          AND index_row.indpred IS NULL
          AND ARRAY[
            pg_get_indexdef(index_row.indexrelid, 1, false),
            pg_get_indexdef(index_row.indexrelid, 2, false),
            pg_get_indexdef(index_row.indexrelid, 3, false),
            pg_get_indexdef(index_row.indexrelid, 4, false)
          ] = ARRAY['tenant_id', 'risk_profile_version', 'event_created_at', 'event_id']::text[]
          AND pg_index_column_has_property(index_row.indexrelid, 1, 'asc') IS TRUE
          AND pg_index_column_has_property(index_row.indexrelid, 2, 'asc') IS TRUE
          AND pg_index_column_has_property(index_row.indexrelid, 3, 'desc') IS TRUE
          AND pg_index_column_has_property(index_row.indexrelid, 4, 'desc') IS TRUE
      )
      AND COALESCE(position(
        'NEW.risk_profile_version := v_projection.risk_profile_version'
        IN pg_get_functiondef(to_regprocedure('public.nexid_explain_event_risk_v1()'))
      ) > 0, false)
      AND COALESCE(position('batch_quarantined'
        IN pg_get_functiondef(to_regprocedure('public.nexid_explain_event_risk_v1()'))) > 0, false)
      AND COALESCE(position('OLD.triggered_rules'
        IN pg_get_functiondef(to_regprocedure('public.nexid_explain_event_risk_v1()'))) > 0, false)
      AND COALESCE(position(
        'FOR UPDATE OF event_row SKIP LOCKED'
        IN pg_get_functiondef(to_regprocedure('public.nexid_backfill_event_risk_v1(integer)'))
      ) > 0, false)
      AND COALESCE(position('event_row.triggered_rules'
        IN pg_get_functiondef(to_regprocedure('public.nexid_backfill_event_risk_v1(integer)'))) > 0, false)
      AND COALESCE(position('supplier_orders:write'
        IN pg_get_functiondef(to_regprocedure('public.nexid_actor_has_enterprise_capability_v1(uuid,uuid,text,text)'))) > 0, false)
      AND COALESCE(position('batch:lifecycle'
        IN pg_get_functiondef(to_regprocedure('public.nexid_actor_has_enterprise_capability_v1(uuid,uuid,text,text)'))) > 0, false)
      AND COALESCE(position('supplier:qa'
        IN pg_get_functiondef(to_regprocedure('public.nexid_actor_has_enterprise_capability_v1(uuid,uuid,text,text)'))) > 0, false)
      AND COALESCE((
        SELECT routine.prosecdef
          AND routine.proowner = core_routine.proowner
          AND routine.proconfig @> ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
        FROM pg_proc routine
        JOIN pg_proc core_routine
          ON core_routine.oid = to_regprocedure('public.nexid_import_tag_manifest_v2_core_0081(jsonb)')
        WHERE routine.oid = to_regprocedure('public.nexid_import_tag_manifest_v2(jsonb)')
      ), false)
      AND NOT COALESCE((
        SELECT routine.prosecdef
        FROM pg_proc routine
        WHERE routine.oid = to_regprocedure('public.nexid_import_tag_manifest_v2_core_0081(jsonb)')
      ), true)
      AND NOT COALESCE(EXISTS (
        SELECT 1
        FROM pg_proc internal_routine
        CROSS JOIN LATERAL aclexplode(
          COALESCE(internal_routine.proacl, acldefault('f', internal_routine.proowner))
        ) acl
        WHERE internal_routine.oid IN (
          to_regprocedure('public.nexid_import_tag_manifest_v2_core_0081(jsonb)'),
          to_regprocedure('public.nexid_persist_sun_scan_v1_base_0062(jsonb)'),
          to_regprocedure('public.nexid_persist_sun_scan_v1_base_pre_tt_0093(jsonb)')
        )
          AND acl.privilege_type = 'EXECUTE'
          AND acl.grantee <> internal_routine.proowner
      ), false)
      AND NOT COALESCE((
        SELECT routine.prosecdef
        FROM pg_proc routine
        WHERE routine.oid = to_regprocedure('public.nexid_backfill_event_risk_v1(integer)')
      ), true)
      AND NOT COALESCE((
        SELECT routine.prosecdef
        FROM pg_proc routine
        WHERE routine.oid = to_regprocedure('public.nexid_validate_supplier_qa_plan_dual_control_v1()')
      ), true)
      AND COALESCE(position(
        '''qa_approve'', ''qa'', ''*'''
        IN pg_get_functiondef(to_regprocedure('public.nexid_packaging_lab_permission_denied_v2(uuid,uuid,text)'))
      ) > 0, false)
      AND COALESCE(position(
        'effective-capability-policy:enterprise-rbac-risk-truth/v1:'
        IN pg_get_functiondef(to_regprocedure('public.nexid_decide_supplier_production_qa_plan_v1(jsonb)'))
      ) > 0, false)
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'events'
          AND column_name = 'risk_profile_version' AND is_nullable = 'YES'
      )
      AND EXISTS (
        SELECT 1 FROM pg_constraint constraint_row
        WHERE constraint_row.conrelid = to_regclass('public.events')
          AND constraint_row.conname = 'events_risk_profile_version_check'
          AND constraint_row.convalidated
      )
      AND EXISTS (
        SELECT 1 FROM pg_constraint constraint_row
        WHERE constraint_row.conrelid = to_regclass('public.resource_permissions')
          AND constraint_row.conname = 'resource_permissions_effect_check'
          AND constraint_row.contype = 'c'
          AND constraint_row.convalidated
          AND pg_get_constraintdef(constraint_row.oid) LIKE '%effect = ANY%'
          AND pg_get_constraintdef(constraint_row.oid) LIKE '%allow%'
          AND pg_get_constraintdef(constraint_row.oid) LIKE '%deny%'
      )
      AND EXISTS (
        SELECT 1 FROM pg_trigger trigger_row
        WHERE trigger_row.tgrelid = to_regclass('public.events')
          AND trigger_row.tgname = 'trg_events_explainable_risk_v1'
          AND NOT trigger_row.tgisinternal
          AND trigger_row.tgenabled <> 'D'
          AND pg_get_triggerdef(trigger_row.oid) LIKE '%tenant_id%'
          AND pg_get_triggerdef(trigger_row.oid) LIKE '%risk_profile_version%'
      )
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'resource_permissions'
          AND column_name = 'tenant_id' AND data_type = 'uuid'
      )
      AND EXISTS (
        SELECT 1 FROM pg_constraint constraint_row
        WHERE constraint_row.conrelid = to_regclass('public.resource_permissions')
          AND constraint_row.conname = 'resource_permissions_tenant_id_fkey'
          AND constraint_row.contype = 'f'
          AND constraint_row.convalidated
      )
      AND EXISTS (
        SELECT 1 FROM pg_trigger trigger_row
        WHERE trigger_row.tgrelid = to_regclass('public.resource_permissions')
          AND trigger_row.tgname = 'trg_resource_permissions_tenant_scope'
          AND NOT trigger_row.tgisinternal
          AND trigger_row.tgenabled <> 'D'
          AND trigger_row.tgdeferrable
          AND trigger_row.tginitdeferred
      )
      AND EXISTS (
        SELECT 1 FROM pg_trigger trigger_row
        WHERE trigger_row.tgrelid = to_regclass('public.memberships')
          AND trigger_row.tgname = 'trg_memberships_permission_scope'
          AND NOT trigger_row.tgisinternal
          AND trigger_row.tgenabled <> 'D'
          AND trigger_row.tgdeferrable
          AND trigger_row.tginitdeferred
      )
      AND EXISTS (
        SELECT 1 FROM pg_index index_row
        WHERE index_row.indexrelid = to_regclass('public.ux_resource_permissions_tenant_scope')
          AND index_row.indrelid = to_regclass('public.resource_permissions')
          AND index_row.indisvalid AND index_row.indisready AND index_row.indislive
          AND index_row.indisunique
          AND index_row.indnkeyatts = 5 AND index_row.indnatts = 5
          AND ARRAY[
            pg_get_indexdef(index_row.indexrelid, 1, false),
            pg_get_indexdef(index_row.indexrelid, 2, false),
            pg_get_indexdef(index_row.indexrelid, 3, false),
            pg_get_indexdef(index_row.indexrelid, 4, false),
            pg_get_indexdef(index_row.indexrelid, 5, false)
          ] = ARRAY['user_id', 'tenant_id', 'resource', 'action', 'effect']::text[]
          AND pg_get_expr(index_row.indpred, index_row.indrelid) = '(tenant_id IS NOT NULL)'
      )
      AND EXISTS (
        SELECT 1 FROM pg_index index_row
        WHERE index_row.indexrelid = to_regclass('public.ux_resource_permissions_global_scope')
          AND index_row.indrelid = to_regclass('public.resource_permissions')
          AND index_row.indisvalid AND index_row.indisready AND index_row.indislive
          AND index_row.indisunique
          AND index_row.indnkeyatts = 4 AND index_row.indnatts = 4
          AND ARRAY[
            pg_get_indexdef(index_row.indexrelid, 1, false),
            pg_get_indexdef(index_row.indexrelid, 2, false),
            pg_get_indexdef(index_row.indexrelid, 3, false),
            pg_get_indexdef(index_row.indexrelid, 4, false)
          ] = ARRAY['user_id', 'resource', 'action', 'effect']::text[]
          AND pg_get_expr(index_row.indpred, index_row.indrelid) = '(tenant_id IS NULL)'
      )
      AND EXISTS (
        SELECT 1 FROM pg_index index_row
        WHERE index_row.indexrelid = to_regclass('public.idx_resource_permissions_tenant_user')
          AND index_row.indrelid = to_regclass('public.resource_permissions')
          AND index_row.indisvalid AND index_row.indisready AND index_row.indislive
          AND NOT index_row.indisunique
          AND index_row.indnkeyatts = 5 AND index_row.indnatts = 5
          AND index_row.indpred IS NULL
          AND ARRAY[
            pg_get_indexdef(index_row.indexrelid, 1, false),
            pg_get_indexdef(index_row.indexrelid, 2, false),
            pg_get_indexdef(index_row.indexrelid, 3, false),
            pg_get_indexdef(index_row.indexrelid, 4, false),
            pg_get_indexdef(index_row.indexrelid, 5, false)
          ] = ARRAY['tenant_id', 'user_id', 'resource', 'action', 'effect']::text[]
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.resource_permissions permission
        WHERE permission.effect NOT IN ('allow', 'deny')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.resource_permissions permission
        WHERE (permission.tenant_id IS NULL AND NOT EXISTS (
          SELECT 1 FROM public.memberships membership
          WHERE membership.user_id = permission.user_id
            AND membership.role::text = 'super_admin'
            AND membership.tenant_id IS NULL
        )) OR (permission.tenant_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM public.memberships membership
          WHERE membership.user_id = permission.user_id
            AND membership.tenant_id = permission.tenant_id
            AND membership.role::text <> 'super_admin'
        ))
      )
      AND EXISTS (
        SELECT 1 FROM pg_constraint constraint_row
        WHERE constraint_row.conrelid = to_regclass('public.memberships')
          AND constraint_row.conname = 'memberships_enterprise_tenant_binding_check'
          AND constraint_row.convalidated
      )
      AND EXISTS (
        SELECT 1 FROM pg_constraint constraint_row
        WHERE constraint_row.conrelid = to_regclass('public.auth_sessions')
          AND constraint_row.conname = 'auth_sessions_enterprise_tenant_binding_check'
          AND constraint_row.convalidated
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.memberships membership
        WHERE (membership.role::text = 'super_admin' AND membership.tenant_id IS NOT NULL)
           OR (membership.role::text <> 'super_admin' AND membership.tenant_id IS NULL)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.auth_sessions session_row
        WHERE session_row.revoked_at IS NULL
          AND (
            (session_row.role::text = 'super_admin' AND session_row.tenant_id IS NOT NULL)
            OR (session_row.role::text <> 'super_admin' AND session_row.tenant_id IS NULL)
          )
      )
      AND EXISTS (
        SELECT 1 FROM pg_trigger trigger_row
        WHERE trigger_row.tgrelid = to_regclass('public.supplier_production_qa_plan_decisions')
          AND trigger_row.tgname = 'trg_supplier_qa_plan_dual_control'
          AND NOT trigger_row.tgisinternal
          AND trigger_row.tgenabled <> 'D'
          AND trigger_row.tgdeferrable
          AND trigger_row.tginitdeferred
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.supplier_production_qa_plan_decisions decision_row
        JOIN public.supplier_production_qa_plans plan
          ON plan.id = decision_row.plan_id
         AND plan.tenant_id = decision_row.tenant_id
        WHERE decision_row.decided_by = plan.submitted_by
           OR decision_row.decided_session_id = plan.submitted_session_id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM (VALUES
          ('tenant_owner', true, true, '["users:manage","supplier_order.create","batch.keys.generate","supplier_pack.export","manifest.import","packaging_lab.manage","qa.approve","qa.plan.approve","batch.activate","batch.lifecycle","batch.revoke","batch.tamper.configure","tag.tamper.override","batch.product.configure","ownership.claim_policy.manage","risk_rules.write","alerts.ack","webhooks.manage","api_keys.read","api_keys.manage","proofs.read","proofs.anchor","audit.read","events.read_sensitive","consumer_experiences.read_pii","consumer_experiences.moderate","consumers.read_pii","leads.manage","reports.export"]'::jsonb),
          ('tenant_admin', true, true, '["users:manage","supplier_order.create","manifest.import","packaging_lab.manage","qa.approve","qa.plan.approve","batch.activate","batch.lifecycle","batch.revoke","batch.tamper.configure","tag.tamper.override","batch.product.configure","ownership.claim_policy.manage","alerts.ack","webhooks.manage","api_keys.read","api_keys.manage","proofs.read","audit.read","events.read_sensitive","consumer_experiences.read_pii","consumer_experiences.moderate","consumers.read_pii","leads.manage","reports.export"]'::jsonb),
          ('security_analyst', true, true, '["proofs.read","audit.read","events.read_sensitive","reports.export"]'::jsonb),
          ('operations_manager', true, true, '["supplier_order.create","manifest.import","packaging_lab.manage","qa.approve","batch.activate","batch.lifecycle","alerts.ack","events.read_sensitive","reports.export"]'::jsonb),
          ('packaging_operator', true, true, '["packaging_lab.manage","manifest.import","reports.export"]'::jsonb),
          ('marketing_manager', true, true, '["batch.product.configure","consumer_experiences.read_pii","consumer_experiences.moderate","consumers.read_pii","leads.manage","reports.export"]'::jsonb),
          ('viewer', true, true, '[]'::jsonb),
          ('reseller_admin', true, true, '["supplier_order.create","manifest.import","leads.manage","reports.export"]'::jsonb),
          ('api_integration', true, false, '[]'::jsonb),
          ('super_admin', false, true, '["users:manage","supplier_order.create","batch.keys.generate","supplier_pack.export","manifest.import","packaging_lab.manage","qa.approve","batch.activate","batch.lifecycle","batch.revoke","batch.tamper.configure","tag.tamper.override","batch.product.configure","ownership.claim_policy.manage","risk_rules.write","alerts.ack","webhooks.manage","api_keys.read","api_keys.manage","proofs.read","proofs.anchor","audit.read","events.read_sensitive","consumer_experiences.read_pii","consumer_experiences.moderate","consumers.read_pii","leads.manage","reports.export"]'::jsonb),
          ('security_operator', true, true, '["risk_rules.write","batch.tamper.configure","tag.tamper.override","alerts.ack","webhooks.manage","proofs.read","proofs.anchor","audit.read","events.read_sensitive","reports.export"]'::jsonb),
          ('reseller', true, true, '[]'::jsonb)
        ) AS expected(code, tenant_bound, human_session_allowed, default_permissions)
        WHERE NOT EXISTS (
          SELECT 1 FROM public.enterprise_role_profiles profile
          WHERE profile.code = expected.code
            AND profile.active IS TRUE
            AND profile.tenant_bound = expected.tenant_bound
            AND profile.human_session_allowed = expected.human_session_allowed
            AND profile.default_permissions = expected.default_permissions
        )
      )
      AND NOT COALESCE(EXISTS (
        SELECT 1
        FROM pg_proc routine
        CROSS JOIN LATERAL aclexplode(COALESCE(routine.proacl, acldefault('f', routine.proowner))) acl
        WHERE routine.oid IN (
          to_regprocedure('public.nexid_backfill_event_risk_v1(integer)'),
          to_regprocedure('public.nexid_validate_supplier_qa_plan_dual_control_v1()'),
          to_regprocedure('public.nexid_touch_authority_scope_lock_v1(uuid,uuid)'),
          to_regprocedure('public.nexid_serialize_authority_scope_v1()')
        )
          AND acl.grantee = 0
          AND acl.privilege_type = 'EXECUTE'
      ), false)
      AND NOT COALESCE(EXISTS (
        SELECT 1
        FROM pg_class relation_row
        CROSS JOIN LATERAL aclexplode(
          COALESCE(relation_row.relacl, acldefault('r', relation_row.relowner))
        ) acl
        WHERE relation_row.oid IN (
          to_regclass('public.resource_permissions'),
          to_regclass('public.enterprise_authority_scope_locks'),
          to_regclass('public.event_risk_projections')
        )
          AND acl.grantee = 0
      ), false) AS enterprise_rbac_risk_truth,
    (SELECT count(*)::int FROM schema_migrations WHERE id = ANY($1::text[])) AS release_ledger_count`,
    [RELEASE_MIGRATIONS])).rows[0];
  if (
    !postcheck.sdk_idempotency_operations
    || !postcheck.tenant_api_key_lifecycle_receipts
    || !postcheck.tenant_api_key_lifecycle_capability
    || !postcheck.tenant_api_key_create_writer
    || !postcheck.tenant_api_key_mutation_writer
    || !postcheck.tenant_api_key_lifecycle_guard
    || !postcheck.tenant_api_key_receipts_append_only
    || !postcheck.vault_artifacts
    || !postcheck.supplier_export_envelope
    || !postcheck.sun_atomic_persistence
    || !postcheck.sun_casefold_uid_guard
    || !postcheck.supplier_packaging_governance
    || !postcheck.supplier_packaging_governance_writer
    || !postcheck.webhook_lifecycle_audit
    || !postcheck.webhook_destination_versions
    || !postcheck.webhook_destination_cutover_functions
    || !postcheck.sdk_event_atomic_outbox_functions
    || !postcheck.can_use_sdk_event_atomic_outbox
    || !postcheck.supplier_order_atomic_create_functions
    || !postcheck.can_create_supplier_order_v2
    || !postcheck.offline_scan_history_index
    || !postcheck.supplier_manifest_atomic_import
    || !postcheck.supplier_manifest_secret_scanners
    || !postcheck.can_import_supplier_manifest_v2
    || !postcheck.can_scan_supplier_manifest_secrets
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
    || !postcheck.consumer_session_revocation
    || !postcheck.sun_runtime_acl_boundary
    || !postcheck.sun_tt_conflict_target
    || !postcheck.enterprise_rbac_risk_truth
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

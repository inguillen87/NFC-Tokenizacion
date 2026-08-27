import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import pg from 'pg';

const MASTER_KEY_PATTERN = /^[0-9a-fA-F]{64}$/;
const MASTER_KEY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export const expectedMigrations = Object.freeze([
  '20260725230000_0057_sun_rate_limit_atomic_buckets.sql',
  '20260726103000_0058_webhook_signature_v2.sql',
  '20260726120000_0058_marketplace_runtime_baseline.sql',
  '20260726135000_0059_marketplace_claim_truth_cleanup.sql',
  '20260726173000_0060_sdk_idempotency_operations.sql',
  '20260726190000_0061_supplier_export_artifact_delivery.sql',
  '20260728120000_0062_sun_atomic_persistence.sql',
  '20260728143000_0063_supplier_packaging_governance.sql',
  '20260728160000_0064_webhook_lifecycle_governance.sql',
  '20260728173000_0065_event_incident_workflow.sql',
  '20260728180000_0066_tag_lifecycle_governance.sql',
  '20260728183000_0067_canonical_event_outbox.sql',
  '20260729110000_0068_epcis_event_type.sql',
  '20260729110500_0069_gs1_epcis_foundation.sql',
  '20260729130000_0070_supplier_qa_atomic_receipts.sql',
  '20260729143000_0071_supplier_pack_purpose_governance.sql',
  '20260729160000_0072_tokenization_marketplace_execution_governance.sql',
  '20260730110000_0073_supplier_qa_verification_context_v2.sql',
  '20260730150000_0074_supplier_key_rotation_atomic.sql',
  '20260801090000_0075_supplier_production_qa_acceptance.sql',
  '20260802090000_0076_supplier_production_activation_v2.sql',
  '20260802113000_0077_tenant_api_key_lifecycle.sql',
  '20260802130000_0078_webhook_destination_cutover.sql',
  '20260802150000_0079_supplier_order_atomic_create.sql',
  '20260802153000_0080_offline_scan_history_index.sql',
  '20260802160000_0081_supplier_manifest_atomic_import.sql',
  '20260802170000_0082_consumer_session_revocation.sql',
  '20260802180000_0083_sdk_event_webhook_atomic_outbox.sql',
  '20260802185000_0083b_vault_artifact_status_bridge.sql',
  '20260802190000_0084_tenant_vault_audited_download.sql',
  '20260802200000_0085_supplier_non_sun_qa_evidence.sql',
  '20260802210000_0086_supplier_order_lifecycle.sql',
  '20260802220000_0087_packaging_lab_foundation.sql',
  '20260802225000_0087b_webhook_delivery_identity_bridge.sql',
  '20260802230000_0088_enterprise_event_profile.sql',
  '20260802240000_0089_sun_carrier_trust_state.sql',
  '20260802250000_0090_supplier_carrier_key_scope.sql',
  '20260802255000_0090b_vault_artifact_canonical_bridge.sql',
  '20260802260000_0091_supplier_keyless_qa_activation.sql',
  '20260802270000_0092_supplier_carrier_scope_integrity.sql',
  '20260802280000_0093_sun_tt_durable_truth_binding.sql',
  '20260802290000_0094_sun_runtime_acl_boundary.sql',
  '20260802300000_0095_sun_tt_conflict_target.sql',
  '20260802310000_0096_enterprise_rbac_risk_truth.sql',
  '20260802320000_0097_sun_demo_replay_isolation.sql',
  '20260827010000_0098_sun_ticket_tenant_routing.sql',
]);

export class EnterpriseReleasePreflightError extends Error {
  constructor(reason, details = {}) {
    super(reason);
    this.name = 'EnterpriseReleasePreflightError';
    this.reason = reason;
    this.details = details;
  }
}

function derivedKeyId(keyHex) {
  return `key_${createHash('sha256').update(Buffer.from(keyHex, 'hex')).digest('hex').slice(0, 16)}`;
}

export function validateSdkIdempotencyKeyring(env = process.env) {
  const activeKeyHex = String(env.SDK_IDEMPOTENCY_MASTER_KEY_HEX || '').trim();
  if (!MASTER_KEY_PATTERN.test(activeKeyHex)) {
    throw new EnterpriseReleasePreflightError('sdk_idempotency_master_key_invalid', {
      key_configured: false,
    });
  }

  const configuredKeyId = String(env.SDK_IDEMPOTENCY_MASTER_KEY_ID || '').trim();
  if (configuredKeyId && !MASTER_KEY_ID_PATTERN.test(configuredKeyId)) {
    throw new EnterpriseReleasePreflightError('sdk_idempotency_master_key_id_invalid');
  }
  const activeKeyId = configuredKeyId || derivedKeyId(activeKeyHex);

  const previousRaw = String(env.SDK_IDEMPOTENCY_PREVIOUS_KEYS_JSON || '').trim();
  let previousKeys = {};
  if (previousRaw) {
    try {
      previousKeys = JSON.parse(previousRaw);
    } catch {
      throw new EnterpriseReleasePreflightError('sdk_idempotency_previous_keys_invalid');
    }
    if (!previousKeys || typeof previousKeys !== 'object' || Array.isArray(previousKeys)) {
      throw new EnterpriseReleasePreflightError('sdk_idempotency_previous_keys_invalid');
    }
  }

  for (const [keyId, keyHexValue] of Object.entries(previousKeys)) {
    const keyHex = String(keyHexValue || '').trim();
    if (!MASTER_KEY_ID_PATTERN.test(keyId) || !MASTER_KEY_PATTERN.test(keyHex)) {
      throw new EnterpriseReleasePreflightError('sdk_idempotency_previous_keys_invalid');
    }
    if (keyId === activeKeyId && keyHex.toLowerCase() !== activeKeyHex.toLowerCase()) {
      throw new EnterpriseReleasePreflightError('sdk_idempotency_key_id_collision');
    }
  }

  return {
    key_configured: true,
    active_key_id_explicit: Boolean(configuredKeyId),
    previous_key_count: Object.keys(previousKeys).length,
  };
}

export function validateExpectedRuntimeDatabaseRole(env = process.env) {
  const role = String(env.NEXID_RUNTIME_DB_ROLE || '').trim();
  if (!role) throw new EnterpriseReleasePreflightError('runtime_database_role_required');
  if (role.includes('\0') || Buffer.byteLength(role, 'utf8') > 63) {
    throw new EnterpriseReleasePreflightError('runtime_database_role_invalid');
  }
  return role;
}

export async function runEnterpriseReleasePreflight(options = {}) {
  const env = options.env || process.env;
  const Client = options.Client || pg.Client;
  const databaseUrl = String(env.DATABASE_URL || '').trim();
  if (!databaseUrl) throw new EnterpriseReleasePreflightError('database_url_required');

  // Validate all identity and replay-custody inputs before opening a production connection.
  const expectedRuntimeRole = validateExpectedRuntimeDatabaseRole(env);
  const keyring = validateSdkIdempotencyKeyring(env);
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const result = await client.query(
       `SELECT
         current_database() AS database_name,
         current_user::text AS database_role,
         session_user::text AS session_database_role,
         COALESCE((
           SELECT NOT role_row.rolsuper
             AND NOT role_row.rolbypassrls
             AND NOT role_row.rolcreaterole
             AND NOT role_row.rolcreatedb
             AND NOT role_row.rolreplication
           FROM pg_roles role_row
           WHERE role_row.rolname = current_user
         ), false) AS runtime_role_restricted,
         NOT has_schema_privilege(current_user, 'public', 'CREATE')
           AS runtime_role_no_public_create,
         NOT EXISTS (
           SELECT 1
           FROM pg_roles reachable_sensitive_role
           WHERE (
             reachable_sensitive_role.rolsuper
             OR reachable_sensitive_role.rolbypassrls
             OR reachable_sensitive_role.rolcreaterole
             OR reachable_sensitive_role.rolcreatedb
             OR reachable_sensitive_role.rolreplication
             OR reachable_sensitive_role.oid IN (
               SELECT private_routine.proowner
               FROM pg_proc private_routine
               WHERE private_routine.oid IN (
                 to_regprocedure('public.nexid_import_tag_manifest_v2_core_0081(jsonb)'),
                 to_regprocedure('public.nexid_persist_sun_scan_v1_base_0062(jsonb)'),
                 to_regprocedure('public.nexid_persist_sun_scan_v1_base_pre_tt_0093(jsonb)'),
                 to_regprocedure('public.nexid_backfill_event_risk_v1(integer)'),
                 to_regprocedure('public.nexid_touch_authority_scope_lock_v1(uuid,uuid)'),
                 to_regprocedure('public.nexid_serialize_authority_scope_v1()')
               )
               UNION
               SELECT private_relation.relowner
               FROM pg_class private_relation
               WHERE private_relation.oid IN (
                 to_regclass('public.batch_keys'),
                 to_regclass('public.batch_key_material'),
                 to_regclass('public.enterprise_authority_scope_locks'),
                 to_regclass('public.sun_replay_watermark_repairs')
               )
             )
           )
             AND CASE
               -- PostgreSQL 16 introduced per-membership SET OPTION. On 14/15,
               -- membership itself is the authority to SET ROLE, including
               -- NOINHERIT memberships that USAGE intentionally misses.
               WHEN current_setting('server_version_num')::integer >= 160000
                 THEN pg_has_role(current_user, reachable_sensitive_role.oid, 'SET')
               ELSE pg_has_role(current_user, reachable_sensitive_role.oid, 'MEMBER')
             END
          ) AS runtime_role_isolated_from_sensitive_roles,
          to_regclass('public.schema_migrations') IS NOT NULL AS has_migration_ledger,
          to_regclass('public.tag_manual_tamper_overrides') IS NOT NULL
            AS has_tag_manual_tamper_overrides,
          COALESCE(has_table_privilege(
            current_user,
            to_regclass('public.tag_manual_tamper_overrides'),
            'SELECT'
          ), false)
            AND COALESCE(has_table_privilege(
              current_user,
              to_regclass('public.tag_manual_tamper_overrides'),
              'INSERT'
            ), false)
            AND COALESCE(has_table_privilege(
              current_user,
              to_regclass('public.tag_manual_tamper_overrides'),
              'UPDATE'
            ), false)
            AND NOT COALESCE(has_table_privilege(
              current_user,
              to_regclass('public.tag_manual_tamper_overrides'),
              'DELETE'
            ), false)
            AS can_manage_tag_manual_tamper_overrides,
          COALESCE(has_sequence_privilege(
            current_user,
            to_regclass('public.tag_manual_tamper_overrides_id_seq'),
            'USAGE'
          ), false) AS can_use_tag_manual_tamper_overrides_sequence,
          to_regclass('public.webhook_endpoints') IS NOT NULL AS has_webhook_endpoints,
         to_regclass('public.marketplace_products') IS NOT NULL AS has_marketplace_products,
         to_regclass('public.marketplace_brand_profiles') IS NOT NULL AS has_marketplace_brand_profiles,
         EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'marketplace_offers'
             AND column_name = 'seller_consumer_id'
         ) AND EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'marketplace_offers'
             AND column_name = 'resale_uid_hex'
         ) AS has_marketplace_runtime_baseline,
         to_regclass('public.sdk_idempotency_operations') IS NOT NULL AS has_sdk_idempotency_operations,
         to_regclass('public.tenant_api_key_lifecycle_receipts') IS NOT NULL AS has_tenant_api_key_lifecycle_receipts,
         to_regprocedure('public.nexid_tenant_api_key_lifecycle_v1_capability()') IS NOT NULL AS has_tenant_api_key_lifecycle_capability,
         to_regprocedure('public.nexid_create_tenant_api_key_v1(jsonb)') IS NOT NULL AS has_tenant_api_key_create_writer,
         to_regprocedure('public.nexid_mutate_tenant_api_key_v1(jsonb)') IS NOT NULL AS has_tenant_api_key_mutation_writer,
         COALESCE(has_function_privilege(current_user,
           to_regprocedure('public.nexid_create_tenant_api_key_v1(jsonb)'), 'EXECUTE'), false)
           AS can_create_tenant_api_key,
         COALESCE(has_function_privilege(current_user,
           to_regprocedure('public.nexid_mutate_tenant_api_key_v1(jsonb)'), 'EXECUTE'), false)
           AS can_mutate_tenant_api_key,
         EXISTS (
           SELECT 1 FROM pg_trigger trigger_row
           WHERE NOT trigger_row.tgisinternal
             AND trigger_row.tgenabled <> 'D'
             AND trigger_row.tgname = 'trg_tenant_api_key_lifecycle_guard_v1'
             AND trigger_row.tgrelid = to_regclass('public.tenant_api_keys')
         ) AS has_tenant_api_key_lifecycle_guard,
         EXISTS (
           SELECT 1 FROM pg_trigger trigger_row
           WHERE NOT trigger_row.tgisinternal
             AND trigger_row.tgenabled <> 'D'
             AND trigger_row.tgname = 'trg_tenant_api_key_lifecycle_receipts_append_only'
             AND trigger_row.tgrelid = to_regclass('public.tenant_api_key_lifecycle_receipts')
         ) AS has_tenant_api_key_receipt_append_only_trigger,
         EXISTS (
           SELECT 1 FROM pg_constraint constraint_row
           WHERE constraint_row.conrelid = to_regclass('public.tenant_api_keys')
             AND constraint_row.conname = 'tenant_api_keys_status_check'
             AND constraint_row.convalidated
         ) AS has_tenant_api_key_status_constraint,
         to_regclass('public.vault_artifacts') IS NOT NULL AS has_vault_artifacts,
         to_regclass('public.vault_artifact_downloads') IS NOT NULL
           AND EXISTS (
             SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'vault_artifacts'
               AND column_name = 'download_count'
           )
           AND EXISTS (
             SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'vault_artifacts'
               AND column_name = 'last_downloaded_at'
           )
           AND EXISTS (
             SELECT 1 FROM pg_trigger trigger_row
             WHERE NOT trigger_row.tgisinternal
               AND trigger_row.tgenabled <> 'D'
               AND trigger_row.tgname = 'trg_vault_artifact_downloads_immutable'
               AND trigger_row.tgrelid = to_regclass('public.vault_artifact_downloads')
           ) AS has_tenant_vault_audited_download,
         COALESCE(has_table_privilege(
           current_user,
           to_regclass('public.vault_artifact_downloads'),
           'SELECT,INSERT'
         ), false)
           AND COALESCE(has_table_privilege(
             current_user,
             to_regclass('public.vault_artifacts'),
             'SELECT,UPDATE'
           ), false)
           AND COALESCE(has_table_privilege(
             current_user,
             to_regclass('public.audit_logs'),
             'INSERT'
           ), false) AS can_record_tenant_vault_download,
         to_regprocedure('public.nexid_persist_sun_scan_v1(jsonb)') IS NOT NULL AS has_sun_atomic_persistence,
         to_regclass('public.uq_tags_batch_uid_upper') IS NOT NULL AS has_sun_casefold_uid_guard,
         to_regclass('public.supplier_packaging_governance_decisions') IS NOT NULL AS has_supplier_packaging_governance,
         to_regprocedure('public.nexid_record_supplier_packaging_decision_v1(jsonb)') IS NOT NULL AS has_supplier_packaging_governance_writer,
         to_regclass('public.webhook_endpoint_audit_events') IS NOT NULL AS has_webhook_lifecycle_audit,
         EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'webhook_endpoints'
             AND column_name = 'destination_version'
         ) AND EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'webhook_deliveries'
             AND column_name = 'destination_version'
         ) AS has_webhook_destination_versions,
         to_regprocedure('public.nexid_webhook_destination_version_v1()') IS NOT NULL
           AND to_regprocedure('public.nexid_webhook_delivery_destination_snapshot_v1()') IS NOT NULL
           AND to_regprocedure('public.nexid_webhook_delivery_identity_immutable_v1()') IS NOT NULL
           AS has_webhook_destination_cutover_functions,
         to_regprocedure('public.nexid_enqueue_tenant_webhook_outbox_v1(uuid,text,text,jsonb,timestamp with time zone)') IS NOT NULL
           AND to_regprocedure('public.nexid_write_sdk_external_event_v1(jsonb)') IS NOT NULL
           AS has_sdk_event_atomic_outbox_functions,
         COALESCE(has_function_privilege(current_user,
           to_regprocedure('public.nexid_enqueue_tenant_webhook_outbox_v1(uuid,text,text,jsonb,timestamp with time zone)'), 'EXECUTE'), false)
           AND COALESCE(has_function_privilege(current_user,
           to_regprocedure('public.nexid_write_sdk_external_event_v1(jsonb)'), 'EXECUTE'), false)
           AS can_use_sdk_event_atomic_outbox,
         to_regprocedure('public.nexid_supplier_order_create_v2_capability()') IS NOT NULL
           AND to_regprocedure('public.nexid_create_supplier_order_v2(jsonb)') IS NOT NULL
           AS has_supplier_order_atomic_create_functions,
         to_regprocedure('public.nexid_supplier_order_create_keyless_v1_capability()') IS NOT NULL
           AND EXISTS (
             SELECT 1 FROM pg_constraint constraint_row
             WHERE constraint_row.conname = 'batches_supplier_carrier_key_scope_v1'
               AND constraint_row.conrelid = to_regclass('public.batches')
           )
           AND (
             SELECT count(*) = 2
             FROM pg_trigger trigger_row
             WHERE NOT trigger_row.tgisinternal
               AND trigger_row.tgenabled <> 'D'
               AND (
                 (trigger_row.tgname = 'trg_batch_keys_supplier_carrier_scope_v1'
                   AND trigger_row.tgrelid = to_regclass('public.batch_keys'))
                 OR (trigger_row.tgname = 'trg_batch_key_material_supplier_carrier_scope_v1'
                   AND trigger_row.tgrelid = to_regclass('public.batch_key_material'))
               )
           ) AS has_supplier_carrier_key_scope,
         COALESCE(has_function_privilege(current_user,
           to_regprocedure('public.nexid_supplier_order_create_v2_capability()'), 'EXECUTE'), false)
           AND COALESCE(has_function_privilege(current_user,
           to_regprocedure('public.nexid_create_supplier_order_v2(jsonb)'), 'EXECUTE'), false)
           AS can_create_supplier_order_v2,
          COALESCE(has_function_privilege(current_user,
            to_regprocedure('public.nexid_supplier_order_create_keyless_v1_capability()'), 'EXECUTE'), false)
            AS can_probe_supplier_order_keyless_v1,
          to_regclass('public.supplier_keyless_production_qa_acceptance_receipts') IS NOT NULL
            AND to_regprocedure('public.nexid_supplier_keyless_qa_activation_v1_capability()') IS NOT NULL
            AND to_regprocedure('public.nexid_supplier_keyless_production_activation_receipt_v1(uuid)') IS NOT NULL
            AND to_regprocedure('public.nexid_supplier_production_activation_receipt_v2(uuid)') IS NOT NULL
            AS has_supplier_keyless_qa_activation,
          COALESCE(has_function_privilege(current_user,
            to_regprocedure('public.nexid_supplier_keyless_qa_activation_v1_capability()'), 'EXECUTE'), false)
            AND COALESCE(has_function_privilege(current_user,
            to_regprocedure('public.nexid_supplier_keyless_production_activation_receipt_v1(uuid)'), 'EXECUTE'), false)
            AND COALESCE(has_table_privilege(current_user,
            to_regclass('public.supplier_keyless_production_qa_acceptance_receipts'), 'SELECT,INSERT'), false)
            AS can_use_supplier_keyless_qa_activation,
          to_regprocedure('public.nexid_supplier_carrier_scope_integrity_v1_capability()') IS NOT NULL
            AND to_regprocedure('public.nexid_import_tag_manifest_v2(jsonb)') IS NOT NULL
            AND to_regprocedure('public.nexid_import_tag_manifest_v2_core_0081(jsonb)') IS NOT NULL
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
            AND (
              SELECT count(*) = 2
              FROM pg_trigger trigger_row
              WHERE NOT trigger_row.tgisinternal
                AND trigger_row.tgenabled <> 'D'
                AND trigger_row.tgname IN (
                  'trg_batch_keys_supplier_carrier_scope_v1',
                  'trg_batch_key_material_supplier_carrier_scope_v1'
                )
            ) AS has_supplier_carrier_scope_integrity,
          COALESCE(has_function_privilege(current_user,
            to_regprocedure('public.nexid_supplier_carrier_scope_integrity_v1_capability()'), 'EXECUTE'), false)
            AND COALESCE(has_function_privilege(current_user,
            to_regprocedure('public.nexid_import_tag_manifest_v2(jsonb)'), 'EXECUTE'), false)
            AS can_use_supplier_carrier_scope_integrity,
          to_regclass('public.sun_tt_truth_receipts') IS NOT NULL
            AND to_regprocedure('public.nexid_sun_tt_durable_truth_v1_capability()') IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM pg_trigger trigger_row
              WHERE NOT trigger_row.tgisinternal
                AND trigger_row.tgenabled <> 'D'
                AND trigger_row.tgname = 'trg_sun_tt_truth_receipts_append_only'
                AND trigger_row.tgrelid = to_regclass('public.sun_tt_truth_receipts')
            ) AS has_sun_tt_durable_truth,
          COALESCE(has_function_privilege(current_user,
            to_regprocedure('public.nexid_sun_tt_durable_truth_v1_capability()'), 'EXECUTE'), false)
            AND COALESCE(has_function_privilege(current_user,
            to_regprocedure('public.nexid_persist_sun_scan_v1(jsonb)'), 'EXECUTE'), false)
            AND COALESCE(has_table_privilege(current_user,
            to_regclass('public.sun_tt_truth_receipts'), 'SELECT,INSERT'), false)
            AS can_use_sun_tt_durable_truth,
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
            ), false) AS has_sun_runtime_acl_boundary,
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
             ), false) AS has_sun_tt_conflict_target,
           to_regprocedure('public.nexid_sun_demo_replay_isolation_v1_capability()') IS NOT NULL
             AND to_regclass('public.sun_replay_watermark_repairs') IS NOT NULL
             AND EXISTS (
               SELECT 1
               FROM pg_trigger trigger_row
               WHERE NOT trigger_row.tgisinternal
                 AND trigger_row.tgenabled <> 'D'
                 AND trigger_row.tgname = 'trg_sun_replay_watermark_repairs_append_only'
                 AND trigger_row.tgrelid = to_regclass('public.sun_replay_watermark_repairs')
             )
             AND COALESCE((
               SELECT NOT historical_routine.prosecdef
                 AND historical_routine.proconfig = ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
                 AND position(
                   'v_execution_class := CASE WHEN v_source = ''demo'' THEN ''demo'' ELSE ''operational'' END'
                   IN pg_get_functiondef(historical_routine.oid)
                 ) > 0
                 AND position(
                   'IF v_execution_class = ''operational'''
                   IN pg_get_functiondef(historical_routine.oid)
                 ) > 0
                 AND position(
                   'IF v_tag_id IS NOT NULL AND v_execution_class = ''operational'''
                   IN pg_get_functiondef(historical_routine.oid)
                 ) > 0
                 AND position(
                   '''replay_execution_class'', v_execution_class'
                   IN pg_get_functiondef(historical_routine.oid)
                 ) > 0
               FROM pg_proc historical_routine
               WHERE historical_routine.oid = to_regprocedure(
                 'public.nexid_persist_sun_scan_v1_base_pre_tt_0093(jsonb)'
               )
             ), false)
             AND NOT COALESCE(has_table_privilege(
               current_user,
               to_regclass('public.sun_replay_watermark_repairs'),
               'INSERT,UPDATE,DELETE,TRUNCATE'
             ), false)
             AND NOT COALESCE(EXISTS (
               SELECT 1
               FROM pg_proc routine
               CROSS JOIN LATERAL aclexplode(
                 COALESCE(routine.proacl, acldefault('f', routine.proowner))
               ) acl
               WHERE routine.oid IN (
                 to_regprocedure('public.nexid_sun_demo_replay_isolation_v1_capability()'),
                 to_regprocedure('public.nexid_sun_replay_watermark_repair_immutable_v1()')
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
               WHERE relation_row.oid = to_regclass('public.sun_replay_watermark_repairs')
                 AND acl.grantee = 0
             ), false) AS has_sun_demo_replay_isolation,
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
            AND COALESCE(position(
              'batch_quarantined'
              IN pg_get_functiondef(to_regprocedure('public.nexid_explain_event_risk_v1()'))
            ) > 0, false)
            AND COALESCE(position(
              'OLD.triggered_rules'
              IN pg_get_functiondef(to_regprocedure('public.nexid_explain_event_risk_v1()'))
            ) > 0, false)
            AND COALESCE(position(
              'FOR UPDATE OF event_row SKIP LOCKED'
              IN pg_get_functiondef(to_regprocedure('public.nexid_backfill_event_risk_v1(integer)'))
            ) > 0, false)
            AND COALESCE(position(
              'event_row.triggered_rules'
              IN pg_get_functiondef(to_regprocedure('public.nexid_backfill_event_risk_v1(integer)'))
            ) > 0, false)
            AND COALESCE(position(
              'supplier_orders:write'
              IN pg_get_functiondef(to_regprocedure('public.nexid_actor_has_enterprise_capability_v1(uuid,uuid,text,text)'))
            ) > 0, false)
            AND COALESCE(position(
              'batch:lifecycle'
              IN pg_get_functiondef(to_regprocedure('public.nexid_actor_has_enterprise_capability_v1(uuid,uuid,text,text)'))
            ) > 0, false)
            AND COALESCE(position(
              'supplier:qa'
              IN pg_get_functiondef(to_regprocedure('public.nexid_actor_has_enterprise_capability_v1(uuid,uuid,text,text)'))
            ) > 0, false)
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
            ), false) AS has_enterprise_rbac_risk_truth,
          to_regclass('public.supplier_order_lifecycle_receipts') IS NOT NULL
           AND to_regprocedure('public.nexid_supplier_order_lifecycle_v1_capability()') IS NOT NULL
           AND to_regprocedure('public.nexid_transition_supplier_order_v1(jsonb)') IS NOT NULL
           AND EXISTS (
             SELECT 1 FROM pg_trigger trigger_row
             WHERE NOT trigger_row.tgisinternal
               AND trigger_row.tgenabled <> 'D'
               AND trigger_row.tgname = 'trg_supplier_order_lifecycle_append_only'
               AND trigger_row.tgrelid = to_regclass('public.supplier_order_lifecycle_receipts')
           ) AS has_supplier_order_lifecycle,
         COALESCE(has_function_privilege(current_user,
           to_regprocedure('public.nexid_supplier_order_lifecycle_v1_capability()'), 'EXECUTE'), false)
           AND COALESCE(has_function_privilege(current_user,
           to_regprocedure('public.nexid_transition_supplier_order_v1(jsonb)'), 'EXECUTE'), false)
           AS can_use_supplier_order_lifecycle,
         to_regclass('public.idx_offline_scan_events_tenant_history') IS NOT NULL
           AS has_offline_scan_history_index,
         EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'consumer_sessions'
             AND column_name = 'revoked_at'
         ) AND to_regclass('public.idx_consumer_sessions_active') IS NOT NULL
           AS has_consumer_session_revocation,
         to_regclass('public.tag_sun_payloads') IS NOT NULL
           AND to_regclass('public.uq_tags_uid_hex_global') IS NOT NULL
           AND to_regprocedure('public.nexid_supplier_manifest_import_v2_capability()') IS NOT NULL
           AND to_regprocedure('public.nexid_import_tag_manifest_v2(jsonb)') IS NOT NULL
           AS has_supplier_manifest_atomic_import,
         to_regprocedure('public.nexid_jsonb_contains_secret_key_v1(jsonb)') IS NOT NULL
           AND to_regprocedure('public.nexid_jsonb_contains_secret_key_v1(jsonb,integer)') IS NOT NULL
           AS has_supplier_manifest_secret_scanners,
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
         to_regclass('public.event_incidents') IS NOT NULL AS has_event_incidents,
         to_regclass('public.event_incident_history') IS NOT NULL AS has_event_incident_history,
         to_regprocedure('public.nexid_open_event_incident(bigint,text,text,text,text,uuid,text,text,text)') IS NOT NULL AS has_event_incident_open_writer,
         to_regprocedure('public.nexid_transition_event_incident(uuid,text,text,text,uuid,text,text,text,text)') IS NOT NULL AS has_event_incident_transition_writer,
         to_regclass('public.tag_lifecycle_events') IS NOT NULL AS has_tag_lifecycle_events,
         to_regprocedure('public.nexid_transition_tag_lifecycle_v1(jsonb)') IS NOT NULL AS has_tag_lifecycle_writer,
         to_regclass('public.canonical_event_operations') IS NOT NULL AS has_canonical_event_operations,
         to_regprocedure('public.nexid_write_canonical_event_v1(jsonb)') IS NOT NULL AS has_canonical_event_writer,
         to_regclass('public.gs1_digital_link_identities') IS NOT NULL AS has_gs1_digital_link_identities,
         to_regclass('public.epcis_capture_operations') IS NOT NULL AS has_epcis_capture_operations,
         to_regclass('public.epcis_events') IS NOT NULL AS has_epcis_events,
         to_regprocedure('public.nexid_capture_epcis_document_v1(jsonb)') IS NOT NULL AS has_epcis_capture_writer,
         to_regclass('public.supplier_qa_diagnostic_consumptions') IS NOT NULL AS has_supplier_qa_diagnostic_consumptions,
         to_regprocedure('public.nexid_commit_supplier_qa_v1(jsonb)') IS NOT NULL AS has_supplier_qa_atomic_writer,
         to_regclass('public.supplier_qa_verification_context_receipts') IS NOT NULL AS has_supplier_qa_verification_context_receipts,
         to_regprocedure('public.nexid_commit_supplier_qa_v2(jsonb)') IS NOT NULL AS has_supplier_qa_verification_context_writer,
         to_regprocedure('public.nexid_supplier_qa_verification_context_v2_capability()') IS NOT NULL AS has_supplier_qa_verification_context_capability,
         COALESCE(has_function_privilege(
           current_user,
           to_regprocedure('public.nexid_commit_supplier_qa_v2(jsonb)'),
           'EXECUTE'
         ), false) AS can_commit_supplier_qa_v2,
         COALESCE(has_function_privilege(
           current_user,
           to_regprocedure('public.nexid_supplier_qa_canonical_json_v2(jsonb)'),
           'EXECUTE'
         ), false) AS can_canonicalize_supplier_qa_v2,
         COALESCE(has_table_privilege(
           current_user,
           to_regclass('public.supplier_qa_verification_context_receipts'),
           'SELECT,INSERT'
         ), false) AS can_write_supplier_qa_verification_context_receipts,
         to_regclass('public.supplier_qa_carrier_evidence_receipts') IS NOT NULL
           AND to_regprocedure('public.nexid_supplier_carrier_qa_v1_capability()') IS NOT NULL
           AND to_regprocedure('public.nexid_commit_supplier_carrier_qa_v1(jsonb)') IS NOT NULL
           AND EXISTS (
             SELECT 1 FROM pg_trigger trigger_row
             WHERE NOT trigger_row.tgisinternal
               AND trigger_row.tgenabled <> 'D'
               AND trigger_row.tgname = 'trg_supplier_qa_carrier_receipts_append_only'
               AND trigger_row.tgrelid = to_regclass('public.supplier_qa_carrier_evidence_receipts')
           ) AS has_supplier_carrier_qa,
         COALESCE(has_function_privilege(
           current_user,
           to_regprocedure('public.nexid_supplier_carrier_qa_v1_capability()'),
           'EXECUTE'
         ), false)
           AND COALESCE(has_function_privilege(
             current_user,
             to_regprocedure('public.nexid_commit_supplier_carrier_qa_v1(jsonb)'),
             'EXECUTE'
           ), false)
           AND COALESCE(has_table_privilege(
             current_user,
             to_regclass('public.supplier_qa_carrier_evidence_receipts'),
             'SELECT,INSERT'
           ), false) AS can_use_supplier_carrier_qa,
         to_regprocedure('public.nexid_rotate_supplier_batch_keys_v2(jsonb)') IS NOT NULL AS has_supplier_key_rotation_v2_writer,
         to_regprocedure('public.nexid_supplier_key_rotation_v2_capability()') IS NOT NULL AS has_supplier_key_rotation_v2_capability,
         COALESCE(has_function_privilege(
           current_user,
           to_regprocedure('public.nexid_rotate_supplier_batch_keys_v2(jsonb)'),
           'EXECUTE'
         ), false) AS can_rotate_supplier_batch_keys_v2,
         COALESCE(has_function_privilege(
           current_user,
           to_regprocedure('public.nexid_supplier_key_rotation_v2_capability()'),
           'EXECUTE'
         ), false) AS can_probe_supplier_key_rotation_v2,
         EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'supplier_sub_batches'
             AND column_name = 'manufacturing_state'
         ) AS has_supplier_production_qa_manufacturing_state,
         (
           to_regclass('public.supplier_production_qa_plans') IS NOT NULL
           AND to_regclass('public.supplier_production_qa_plan_decisions') IS NOT NULL
           AND to_regclass('public.supplier_production_qa_sessions') IS NOT NULL
           AND to_regclass('public.supplier_production_qa_session_samples') IS NOT NULL
           AND to_regclass('public.supplier_production_qa_decisions') IS NOT NULL
           AND to_regclass('public.supplier_production_qa_observations') IS NOT NULL
         ) AS has_supplier_production_qa_acceptance_tables,
         (
           to_regprocedure('public.nexid_submit_supplier_production_qa_plan_v1(jsonb)') IS NOT NULL
           AND to_regprocedure('public.nexid_decide_supplier_production_qa_plan_v1(jsonb)') IS NOT NULL
           AND to_regprocedure('public.nexid_supplier_production_qa_v1_capability()') IS NOT NULL
           AND to_regprocedure('public.nexid_create_supplier_production_qa_session_v1(jsonb)') IS NOT NULL
           AND to_regprocedure('public.nexid_commit_supplier_production_qa_v1(jsonb)') IS NOT NULL
         ) AS has_supplier_production_qa_acceptance_functions,
         (
           COALESCE(has_function_privilege(
             current_user,
             to_regprocedure('public.nexid_submit_supplier_production_qa_plan_v1(jsonb)'),
             'EXECUTE'
           ), false)
           AND COALESCE(has_function_privilege(
             current_user,
             to_regprocedure('public.nexid_decide_supplier_production_qa_plan_v1(jsonb)'),
             'EXECUTE'
           ), false)
           AND COALESCE(has_function_privilege(
             current_user,
             to_regprocedure('public.nexid_supplier_production_qa_v1_capability()'),
             'EXECUTE'
           ), false)
           AND COALESCE(has_function_privilege(
             current_user,
             to_regprocedure('public.nexid_create_supplier_production_qa_session_v1(jsonb)'),
             'EXECUTE'
           ), false)
           AND COALESCE(has_function_privilege(
             current_user,
             to_regprocedure('public.nexid_commit_supplier_production_qa_v1(jsonb)'),
             'EXECUTE'
           ), false)
         ) AS can_use_supplier_production_qa_acceptance,
         to_regclass('public.supplier_production_activation_receipts') IS NOT NULL
           AS has_supplier_production_activation_receipts,
         to_regprocedure('public.nexid_supplier_production_activation_receipt_v2(uuid)') IS NOT NULL
           AS has_supplier_production_activation_receipt_function,
         to_regprocedure('public.nexid_assert_supplier_production_activation_v2(uuid)') IS NOT NULL
           AS has_supplier_production_activation_assert,
         to_regprocedure('public.nexid_assert_supplier_order_commercial_release_v1(uuid)') IS NOT NULL
           AS has_supplier_order_commercial_release_guard,
         to_regprocedure('public.nexid_activate_supplier_tags_v2(jsonb)') IS NOT NULL
           AS has_supplier_production_activation_writer,
         COALESCE(has_table_privilege(
           current_user,
           to_regclass('public.supplier_production_activation_receipts'),
           'SELECT,INSERT'
         ), false) AS can_write_supplier_production_activation_receipts,
         COALESCE(has_function_privilege(
           current_user,
           to_regprocedure('public.nexid_supplier_production_activation_receipt_v2(uuid)'),
           'EXECUTE'
         ), false) AS can_resolve_supplier_production_activation_receipt,
         COALESCE(has_function_privilege(
           current_user,
           to_regprocedure('public.nexid_assert_supplier_production_activation_v2(uuid)'),
           'EXECUTE'
         ), false) AS can_assert_supplier_production_activation,
         COALESCE(has_function_privilege(
           current_user,
           to_regprocedure('public.nexid_assert_supplier_order_commercial_release_v1(uuid)'),
           'EXECUTE'
         ), false) AS can_assert_supplier_order_commercial_release,
         COALESCE(has_function_privilege(
           current_user,
           to_regprocedure('public.nexid_activate_supplier_tags_v2(jsonb)'),
           'EXECUTE'
         ), false) AS can_activate_supplier_production_tags,
         EXISTS (
           SELECT 1
           FROM pg_trigger trigger_row
           WHERE NOT trigger_row.tgisinternal
             AND trigger_row.tgenabled <> 'D'
             AND trigger_row.tgname = 'trg_supplier_production_activation_receipts_append_only'
             AND trigger_row.tgrelid = to_regclass('public.supplier_production_activation_receipts')
         ) AS has_supplier_production_activation_receipt_append_only_trigger,
         to_regclass('public.supplier_pack_purpose_decisions') IS NOT NULL AS has_supplier_pack_purpose_decisions,
         to_regclass('public.supplier_pack_purpose_decision_items') IS NOT NULL AS has_supplier_pack_purpose_decision_items,
         to_regprocedure('public.nexid_assert_supplier_commercial_release_v1(uuid)') IS NOT NULL AS has_supplier_commercial_release_guard,
         to_regprocedure('public.nexid_supplier_commercial_sink_guard_v1()') IS NOT NULL AS has_supplier_commercial_sink_guard,
         to_regprocedure('public.nexid_prepare_tokenization_execution_v1(uuid,uuid,uuid,text,integer)') IS NOT NULL AS has_tokenization_execution_prepare,
         to_regclass('public.uq_tokenization_request_asset_execution') IS NOT NULL AS has_tokenization_asset_dedupe,
         EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'tokenization_requests'
             AND column_name = 'source_event_created_at'
         ) AS has_tokenization_partition_event_identity,
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
         ) AS has_tokenization_marketplace_scope_triggers,
         COALESCE(has_function_privilege(
           current_user,
           to_regprocedure('public.nexid_prepare_tokenization_execution_v1(uuid,uuid,uuid,text,integer)'),
           'EXECUTE'
         ), false) AS can_prepare_tokenization_execution,
         COALESCE(has_function_privilege(
           current_user,
           to_regprocedure('public.nexid_assert_supplier_commercial_release_v1(uuid)'),
           'EXECUTE'
         ), false) AS can_assert_supplier_commercial_release,
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
         ) AS has_supplier_commercial_guard_triggers,
         EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'canonical_event_operations'
             AND column_name = 'source_event_created_at'
         ) AS has_canonical_source_partition_identity,
         EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'vault_artifacts'
             AND column_name = 'encrypted_payload_base64'
         ) AS has_supplier_export_envelope`,
    );
    const state = result.rows[0] || {};

    if (
      state.database_role !== expectedRuntimeRole
      || state.session_database_role !== expectedRuntimeRole
      || state.session_database_role !== state.database_role
    ) {
      throw new EnterpriseReleasePreflightError('runtime_database_role_mismatch', {
        expected_role: expectedRuntimeRole,
        connected_role: state.database_role || null,
        session_role: state.session_database_role || null,
      });
    }

    if (!state.has_migration_ledger) {
      throw new EnterpriseReleasePreflightError('migration_ledger_missing');
    }
    const requiredSchema = [
      ['runtime role has no superuser, BYPASSRLS, CREATEROLE, CREATEDB or REPLICATION', state.runtime_role_restricted],
      ['runtime role cannot CREATE in schema public', state.runtime_role_no_public_create],
      ['runtime role cannot SET ROLE into dangerous or private-owner roles', state.runtime_role_isolated_from_sensitive_roles],
      ['tag_manual_tamper_overrides', state.has_tag_manual_tamper_overrides],
      ['runtime role SELECT,INSERT,UPDATE without DELETE on tag_manual_tamper_overrides', state.can_manage_tag_manual_tamper_overrides],
      ['runtime role USAGE on tag_manual_tamper_overrides_id_seq', state.can_use_tag_manual_tamper_overrides_sequence],
      ['webhook_endpoints', state.has_webhook_endpoints],
      ['marketplace_products', state.has_marketplace_products],
      ['marketplace_brand_profiles', state.has_marketplace_brand_profiles],
      ['marketplace runtime baseline columns', state.has_marketplace_runtime_baseline],
      ['sdk_idempotency_operations', state.has_sdk_idempotency_operations],
      ['tenant_api_key_lifecycle_receipts', state.has_tenant_api_key_lifecycle_receipts],
      ['nexid_tenant_api_key_lifecycle_v1_capability()', state.has_tenant_api_key_lifecycle_capability],
      ['nexid_create_tenant_api_key_v1(jsonb)', state.has_tenant_api_key_create_writer],
      ['nexid_mutate_tenant_api_key_v1(jsonb)', state.has_tenant_api_key_mutation_writer],
      ['EXECUTE nexid_create_tenant_api_key_v1(jsonb)', state.can_create_tenant_api_key],
      ['EXECUTE nexid_mutate_tenant_api_key_v1(jsonb)', state.can_mutate_tenant_api_key],
      ['tenant API-key lifecycle guard', state.has_tenant_api_key_lifecycle_guard],
      ['tenant API-key receipt append-only trigger', state.has_tenant_api_key_receipt_append_only_trigger],
      ['tenant API-key status constraint', state.has_tenant_api_key_status_constraint],
      ['vault_artifacts', state.has_vault_artifacts],
      ['vault_artifacts.encrypted_payload_base64', state.has_supplier_export_envelope],
      ['tenant vault audited download schema', state.has_tenant_vault_audited_download],
      ['tenant vault audited download table privileges', state.can_record_tenant_vault_download],
      ['nexid_persist_sun_scan_v1(jsonb)', state.has_sun_atomic_persistence],
      ['uq_tags_batch_uid_upper', state.has_sun_casefold_uid_guard],
      ['supplier_packaging_governance_decisions', state.has_supplier_packaging_governance],
      ['nexid_record_supplier_packaging_decision_v1(jsonb)', state.has_supplier_packaging_governance_writer],
      ['webhook_endpoint_audit_events', state.has_webhook_lifecycle_audit],
      ['webhook destination version columns', state.has_webhook_destination_versions],
      ['webhook destination cutover functions', state.has_webhook_destination_cutover_functions],
      ['SDK event atomic outbox functions', state.has_sdk_event_atomic_outbox_functions],
      ['EXECUTE SDK event atomic outbox functions', state.can_use_sdk_event_atomic_outbox],
      ['supplier order atomic create functions', state.has_supplier_order_atomic_create_functions],
      ['EXECUTE supplier order atomic create functions', state.can_create_supplier_order_v2],
      ['supplier carrier key-scope guard', state.has_supplier_carrier_key_scope],
      ['EXECUTE supplier keyless carrier capability', state.can_probe_supplier_order_keyless_v1],
      ['supplier keyless QA and activation schema', state.has_supplier_keyless_qa_activation],
      ['supplier keyless QA and activation privileges', state.can_use_supplier_keyless_qa_activation],
      ['supplier carrier scope integrity schema', state.has_supplier_carrier_scope_integrity],
      ['supplier carrier scope integrity privileges', state.can_use_supplier_carrier_scope_integrity],
      ['SUN TT durable truth schema', state.has_sun_tt_durable_truth],
      ['SUN TT durable truth privileges', state.can_use_sun_tt_durable_truth],
       ['SUN runtime ACL boundary', state.has_sun_runtime_acl_boundary],
       ['SUN TT deterministic receipt conflict target', state.has_sun_tt_conflict_target],
       ['SUN demo versus operational replay isolation', state.has_sun_demo_replay_isolation],
       ['enterprise RBAC and deterministic risk truth', state.has_enterprise_rbac_risk_truth],
      ['supplier order lifecycle schema', state.has_supplier_order_lifecycle],
      ['EXECUTE supplier order lifecycle functions', state.can_use_supplier_order_lifecycle],
      ['idx_offline_scan_events_tenant_history', state.has_offline_scan_history_index],
      ['consumer session server-side revocation', state.has_consumer_session_revocation],
      ['supplier manifest atomic import schema', state.has_supplier_manifest_atomic_import],
      ['supplier manifest recursive secret scanners', state.has_supplier_manifest_secret_scanners],
      ['EXECUTE supplier manifest atomic import functions', state.can_import_supplier_manifest_v2],
      ['EXECUTE supplier manifest recursive secret scanners', state.can_scan_supplier_manifest_secrets],
      ['event_incidents', state.has_event_incidents],
      ['event_incident_history', state.has_event_incident_history],
      ['nexid_open_event_incident(bigint,text,text,text,text,uuid,text,text,text)', state.has_event_incident_open_writer],
      ['nexid_transition_event_incident(uuid,text,text,text,uuid,text,text,text,text)', state.has_event_incident_transition_writer],
      ['tag_lifecycle_events', state.has_tag_lifecycle_events],
      ['nexid_transition_tag_lifecycle_v1(jsonb)', state.has_tag_lifecycle_writer],
      ['canonical_event_operations', state.has_canonical_event_operations],
      ['canonical_event_operations.source_event_created_at', state.has_canonical_source_partition_identity],
      ['nexid_write_canonical_event_v1(jsonb)', state.has_canonical_event_writer],
      ['gs1_digital_link_identities', state.has_gs1_digital_link_identities],
      ['epcis_capture_operations', state.has_epcis_capture_operations],
      ['epcis_events', state.has_epcis_events],
      ['nexid_capture_epcis_document_v1(jsonb)', state.has_epcis_capture_writer],
      ['supplier_qa_diagnostic_consumptions', state.has_supplier_qa_diagnostic_consumptions],
      ['nexid_commit_supplier_qa_v1(jsonb)', state.has_supplier_qa_atomic_writer],
      ['supplier_qa_verification_context_receipts', state.has_supplier_qa_verification_context_receipts],
      ['nexid_commit_supplier_qa_v2(jsonb)', state.has_supplier_qa_verification_context_writer],
      ['nexid_supplier_qa_verification_context_v2_capability()', state.has_supplier_qa_verification_context_capability],
      ['EXECUTE nexid_commit_supplier_qa_v2(jsonb)', state.can_commit_supplier_qa_v2],
      ['EXECUTE nexid_supplier_qa_canonical_json_v2(jsonb)', state.can_canonicalize_supplier_qa_v2],
      ['SELECT,INSERT supplier_qa_verification_context_receipts', state.can_write_supplier_qa_verification_context_receipts],
      ['supplier carrier QA schema', state.has_supplier_carrier_qa],
      ['EXECUTE supplier carrier QA functions', state.can_use_supplier_carrier_qa],
      ['nexid_rotate_supplier_batch_keys_v2(jsonb)', state.has_supplier_key_rotation_v2_writer],
      ['nexid_supplier_key_rotation_v2_capability()', state.has_supplier_key_rotation_v2_capability],
      ['EXECUTE nexid_rotate_supplier_batch_keys_v2(jsonb)', state.can_rotate_supplier_batch_keys_v2],
      ['EXECUTE nexid_supplier_key_rotation_v2_capability()', state.can_probe_supplier_key_rotation_v2],
      ['supplier_sub_batches.manufacturing_state', state.has_supplier_production_qa_manufacturing_state],
      ['supplier production QA acceptance tables', state.has_supplier_production_qa_acceptance_tables],
      ['supplier production QA acceptance functions', state.has_supplier_production_qa_acceptance_functions],
      ['EXECUTE supplier production QA acceptance functions', state.can_use_supplier_production_qa_acceptance],
      ['supplier_production_activation_receipts', state.has_supplier_production_activation_receipts],
      ['nexid_supplier_production_activation_receipt_v2(uuid)', state.has_supplier_production_activation_receipt_function],
      ['nexid_assert_supplier_production_activation_v2(uuid)', state.has_supplier_production_activation_assert],
      ['nexid_assert_supplier_order_commercial_release_v1(uuid)', state.has_supplier_order_commercial_release_guard],
      ['nexid_activate_supplier_tags_v2(jsonb)', state.has_supplier_production_activation_writer],
      ['SELECT,INSERT supplier_production_activation_receipts', state.can_write_supplier_production_activation_receipts],
      ['EXECUTE nexid_supplier_production_activation_receipt_v2(uuid)', state.can_resolve_supplier_production_activation_receipt],
      ['EXECUTE nexid_assert_supplier_production_activation_v2(uuid)', state.can_assert_supplier_production_activation],
      ['EXECUTE nexid_assert_supplier_order_commercial_release_v1(uuid)', state.can_assert_supplier_order_commercial_release],
      ['EXECUTE nexid_activate_supplier_tags_v2(jsonb)', state.can_activate_supplier_production_tags],
      ['supplier production activation receipt append-only trigger', state.has_supplier_production_activation_receipt_append_only_trigger],
      ['supplier_pack_purpose_decisions', state.has_supplier_pack_purpose_decisions],
      ['supplier_pack_purpose_decision_items', state.has_supplier_pack_purpose_decision_items],
      ['nexid_assert_supplier_commercial_release_v1(uuid)', state.has_supplier_commercial_release_guard],
      ['nexid_supplier_commercial_sink_guard_v1()', state.has_supplier_commercial_sink_guard],
      ['supplier commercial guard triggers', state.has_supplier_commercial_guard_triggers],
      ['nexid_prepare_tokenization_execution_v1(uuid,uuid,uuid,text,integer)', state.has_tokenization_execution_prepare],
      ['uq_tokenization_request_asset_execution', state.has_tokenization_asset_dedupe],
      ['tokenization_requests.source_event_created_at', state.has_tokenization_partition_event_identity],
      ['tokenization and marketplace scope triggers', state.has_tokenization_marketplace_scope_triggers],
      ['EXECUTE nexid_prepare_tokenization_execution_v1', state.can_prepare_tokenization_execution],
      ['EXECUTE nexid_assert_supplier_commercial_release_v1', state.can_assert_supplier_commercial_release],
    ];
    const missingSchema = requiredSchema.filter(([, present]) => !present).map(([name]) => name);
    if (missingSchema.length) {
      throw new EnterpriseReleasePreflightError('required_schema_missing', {
        missing_schema: missingSchema,
      });
    }

    const appliedResult = await client.query(
      'SELECT id FROM schema_migrations WHERE id = ANY($1::text[]) ORDER BY id',
      [expectedMigrations],
    );
    const applied = new Set(appliedResult.rows.map((row) => String(row.id)));
    const missingMigrations = expectedMigrations.filter((id) => !applied.has(id));
    if (missingMigrations.length) {
      throw new EnterpriseReleasePreflightError('required_migrations_missing', {
        message: 'Required enterprise migrations are missing.',
        missing_migrations: missingMigrations,
        ...(missingMigrations.includes('20260726120000_0058_marketplace_runtime_baseline.sql') ? {
          historical_gap_remediation: {
            command: 'node scripts/db-apply.mjs --only 20260726120000_0058_marketplace_runtime_baseline.sql',
            required_before_release: true,
          },
        } : {}),
      });
    }

    return {
      ok: true,
      database: state.database_name,
      database_role: state.database_role,
      migrations: expectedMigrations.map((id) => ({ id, applied: true })),
      sdk_idempotency_keyring: keyring,
    };
  } finally {
    await client.end();
  }
}

async function runCli() {
  try {
    const result = await runEnterpriseReleasePreflight();
    console.log(JSON.stringify(result));
  } catch (error) {
    const known = error instanceof EnterpriseReleasePreflightError;
    console.error(JSON.stringify({
      ok: false,
      reason: known ? error.reason : 'enterprise_release_preflight_failed',
      ...(known ? error.details : {}),
    }));
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) await runCli();

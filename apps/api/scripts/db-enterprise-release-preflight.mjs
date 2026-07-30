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

export async function runEnterpriseReleasePreflight(options = {}) {
  const env = options.env || process.env;
  const Client = options.Client || pg.Client;
  const databaseUrl = String(env.DATABASE_URL || '').trim();
  if (!databaseUrl) throw new EnterpriseReleasePreflightError('database_url_required');

  // Validate all replay-custody inputs before opening a production connection.
  const keyring = validateSdkIdempotencyKeyring(env);
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const result = await client.query(
      `SELECT
         current_database() AS database_name,
         to_regclass('public.schema_migrations') IS NOT NULL AS has_migration_ledger,
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
         to_regclass('public.vault_artifacts') IS NOT NULL AS has_vault_artifacts,
         to_regprocedure('public.nexid_persist_sun_scan_v1(jsonb)') IS NOT NULL AS has_sun_atomic_persistence,
         to_regclass('public.uq_tags_batch_uid_upper') IS NOT NULL AS has_sun_casefold_uid_guard,
         to_regclass('public.supplier_packaging_governance_decisions') IS NOT NULL AS has_supplier_packaging_governance,
         to_regprocedure('public.nexid_record_supplier_packaging_decision_v1(jsonb)') IS NOT NULL AS has_supplier_packaging_governance_writer,
         to_regclass('public.webhook_endpoint_audit_events') IS NOT NULL AS has_webhook_lifecycle_audit,
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

    if (!state.has_migration_ledger) {
      throw new EnterpriseReleasePreflightError('migration_ledger_missing');
    }
    const requiredSchema = [
      ['webhook_endpoints', state.has_webhook_endpoints],
      ['marketplace_products', state.has_marketplace_products],
      ['marketplace_brand_profiles', state.has_marketplace_brand_profiles],
      ['marketplace runtime baseline columns', state.has_marketplace_runtime_baseline],
      ['sdk_idempotency_operations', state.has_sdk_idempotency_operations],
      ['vault_artifacts', state.has_vault_artifacts],
      ['vault_artifacts.encrypted_payload_base64', state.has_supplier_export_envelope],
      ['nexid_persist_sun_scan_v1(jsonb)', state.has_sun_atomic_persistence],
      ['uq_tags_batch_uid_upper', state.has_sun_casefold_uid_guard],
      ['supplier_packaging_governance_decisions', state.has_supplier_packaging_governance],
      ['nexid_record_supplier_packaging_decision_v1(jsonb)', state.has_supplier_packaging_governance_writer],
      ['webhook_endpoint_audit_events', state.has_webhook_lifecycle_audit],
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
      ['nexid_rotate_supplier_batch_keys_v2(jsonb)', state.has_supplier_key_rotation_v2_writer],
      ['nexid_supplier_key_rotation_v2_capability()', state.has_supplier_key_rotation_v2_capability],
      ['EXECUTE nexid_rotate_supplier_batch_keys_v2(jsonb)', state.can_rotate_supplier_batch_keys_v2],
      ['EXECUTE nexid_supplier_key_rotation_v2_capability()', state.can_probe_supplier_key_rotation_v2],
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

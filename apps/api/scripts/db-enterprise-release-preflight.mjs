import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import pg from 'pg';

const MASTER_KEY_PATTERN = /^[0-9a-fA-F]{64}$/;
const MASTER_KEY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export const expectedMigrations = Object.freeze([
  '20260725230000_0057_sun_rate_limit_atomic_buckets.sql',
  '20260726103000_0058_webhook_signature_v2.sql',
  '20260726135000_0059_marketplace_claim_truth_cleanup.sql',
  '20260726173000_0060_sdk_idempotency_operations.sql',
  '20260726190000_0061_supplier_export_artifact_delivery.sql',
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
         to_regclass('public.sdk_idempotency_operations') IS NOT NULL AS has_sdk_idempotency_operations,
         to_regclass('public.vault_artifacts') IS NOT NULL AS has_vault_artifacts,
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
      ['sdk_idempotency_operations', state.has_sdk_idempotency_operations],
      ['vault_artifacts', state.has_vault_artifacts],
      ['vault_artifacts.encrypted_payload_base64', state.has_supplier_export_envelope],
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

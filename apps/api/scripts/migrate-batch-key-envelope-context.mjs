import pg from "pg";

import {
  assertBatchKeyEnvelopeContext,
  inspectBatchKeyEnvelopeBinding,
  rewrapUnscopedBatchKeyEnvelope,
} from "../src/lib/batch-keys.ts";

const ENVELOPE_PREFIX = "nexid-app-envelope-v2.";
const APPLY_CONFIRMATION = "REWRAP_UNSCOPED_V2";
const apply = process.argv.includes("--apply");
const unknownArguments = process.argv.slice(2).filter((argument) => argument !== "--apply");

function fail(code, exitCode = 1) {
  console.error(JSON.stringify({ ok: false, code }));
  process.exit(exitCode);
}

if (unknownArguments.length) fail("unsupported_argument", 2);

const databaseUrl = String(process.env.DATABASE_URL || "").trim();
const activeKekHex = String(process.env.KMS_MASTER_KEY_HEX || "").trim();
if (!databaseUrl) fail("database_url_required");
if (!/^[0-9a-f]{64}$/i.test(activeKekHex)) fail("kms_master_key_hex_invalid");
if (apply && String(process.env.NEXID_BATCH_KEY_MIGRATION_CONFIRM || "") !== APPLY_CONFIRMATION) {
  fail("apply_confirmation_required");
}

function createTableSummary() {
  return { rows: 0, legacy: 0, context_bound: 0, unscoped: 0, updated: 0 };
}

const summary = {
  ok: true,
  mode: apply ? "apply" : "dry_run",
  tables: {
    batches: createTableSummary(),
    batch_keys: createTableSummary(),
    batch_key_material: createTableSummary(),
  },
};

function rewrapIfRequired(value, context, tableSummary) {
  const binding = inspectBatchKeyEnvelopeBinding(String(value || ""));
  if (binding.format === "legacy") {
    tableSummary.legacy += 1;
    return { changed: false, value };
  }
  if (binding.scope === "partial") throw new Error("partial_envelope_context");
  if (binding.scope === "context_bound") {
    assertBatchKeyEnvelopeContext(String(value), context);
    tableSummary.context_bound += 1;
    return { changed: false, value };
  }
  if (binding.scope !== "unscoped") throw new Error("unsupported_envelope_scope");
  tableSummary.unscoped += 1;
  return {
    changed: true,
    value: rewrapUnscopedBatchKeyEnvelope(String(value), context),
  };
}

const client = new pg.Client({ connectionString: databaseUrl });
let transactionOpen = false;

try {
  await client.connect();
  await client.query("BEGIN");
  transactionOpen = true;
  await client.query("SET LOCAL lock_timeout = '5s'");
  await client.query("SET LOCAL statement_timeout = '120s'");
  await client.query("SELECT pg_advisory_xact_lock(487421352)");

  const batches = await client.query(
    `SELECT
       id::text AS id,
       tenant_id::text AS tenant_id,
       bid,
       meta_key_ct,
       file_key_ct,
       CASE
         WHEN COALESCE(sdm_config->>'key_version', '') ~ '^[1-9][0-9]*$'
           THEN (sdm_config->>'key_version')::integer
         ELSE 1
       END AS key_version
     FROM batches
     WHERE meta_key_ct LIKE $1 OR file_key_ct LIKE $1
     ORDER BY id
     FOR UPDATE`,
    [`${ENVELOPE_PREFIX}%`],
  );
  summary.tables.batches.rows = batches.rowCount;
  for (const row of batches.rows) {
    const keyVersion = Number(row.key_version || 1);
    const meta = rewrapIfRequired(row.meta_key_ct, {
      tenantId: String(row.tenant_id),
      bid: String(row.bid),
      role: "K_META_BATCH",
      keyVersion,
    }, summary.tables.batches);
    const file = rewrapIfRequired(row.file_key_ct, {
      tenantId: String(row.tenant_id),
      bid: String(row.bid),
      role: "K_FILE_BATCH",
      keyVersion,
    }, summary.tables.batches);
    if (!meta.changed && !file.changed) continue;
    if (apply) {
      const write = await client.query(
        `UPDATE batches
         SET meta_key_ct = $1,
             file_key_ct = $2,
             sdm_config = jsonb_set(COALESCE(sdm_config, '{}'::jsonb), '{key_version}', to_jsonb($3::integer), true),
             updated_at = now()
         WHERE id = $4
           AND meta_key_ct IS NOT DISTINCT FROM $5
           AND file_key_ct IS NOT DISTINCT FROM $6`,
        [meta.value, file.value, keyVersion, row.id, row.meta_key_ct, row.file_key_ct],
      );
      if (write.rowCount !== 1) throw new Error("concurrent_batch_update");
      summary.tables.batches.updated += 1;
    }
  }

  const batchKeys = await client.query(
    `SELECT
       id::text AS id,
       tenant_id::text AS tenant_id,
       bid,
       meta_key_ct,
       file_key_ct,
       COALESCE(key_version, 1)::integer AS key_version
     FROM batch_keys
     WHERE meta_key_ct LIKE $1 OR file_key_ct LIKE $1
     ORDER BY id
     FOR UPDATE`,
    [`${ENVELOPE_PREFIX}%`],
  );
  summary.tables.batch_keys.rows = batchKeys.rowCount;
  for (const row of batchKeys.rows) {
    const keyVersion = Number(row.key_version || 1);
    const meta = rewrapIfRequired(row.meta_key_ct, {
      tenantId: String(row.tenant_id),
      bid: String(row.bid),
      role: "K_META_BATCH",
      keyVersion,
    }, summary.tables.batch_keys);
    const file = rewrapIfRequired(row.file_key_ct, {
      tenantId: String(row.tenant_id),
      bid: String(row.bid),
      role: "K_FILE_BATCH",
      keyVersion,
    }, summary.tables.batch_keys);
    if (!meta.changed && !file.changed) continue;
    if (apply) {
      const write = await client.query(
        `UPDATE batch_keys
         SET meta_key_ct = $1,
             file_key_ct = $2,
             key_version = $3
         WHERE id = $4
           AND meta_key_ct IS NOT DISTINCT FROM $5
           AND file_key_ct IS NOT DISTINCT FROM $6`,
        [meta.value, file.value, keyVersion, row.id, row.meta_key_ct, row.file_key_ct],
      );
      if (write.rowCount !== 1) throw new Error("concurrent_batch_key_update");
      summary.tables.batch_keys.updated += 1;
    }
  }

  const keyMaterial = await client.query(
    `SELECT
       id::text AS id,
       tenant_id::text AS tenant_id,
       bid,
       key_role,
       key_version,
       encrypted_key_ct
     FROM batch_key_material
     WHERE encrypted_key_ct LIKE $1
     ORDER BY id
     FOR UPDATE`,
    [`${ENVELOPE_PREFIX}%`],
  );
  summary.tables.batch_key_material.rows = keyMaterial.rowCount;
  for (const row of keyMaterial.rows) {
    const migrated = rewrapIfRequired(row.encrypted_key_ct, {
      tenantId: String(row.tenant_id),
      bid: String(row.bid),
      role: String(row.key_role),
      keyVersion: Number(row.key_version || 1),
    }, summary.tables.batch_key_material);
    if (!migrated.changed) continue;
    if (apply) {
      const write = await client.query(
        `UPDATE batch_key_material
         SET encrypted_key_ct = $1,
             updated_at = now()
         WHERE id = $2
           AND encrypted_key_ct IS NOT DISTINCT FROM $3`,
        [migrated.value, row.id, row.encrypted_key_ct],
      );
      if (write.rowCount !== 1) throw new Error("concurrent_batch_key_material_update");
      summary.tables.batch_key_material.updated += 1;
    }
  }

  if (apply) {
    await client.query("COMMIT");
  } else {
    await client.query("ROLLBACK");
  }
  transactionOpen = false;
  console.log(JSON.stringify(summary));
} catch (error) {
  if (transactionOpen) await client.query("ROLLBACK").catch(() => undefined);
  const message = String(error?.message || "");
  const code = message.startsWith("concurrent_")
    ? message
    : message === "partial_envelope_context"
      ? "partial_envelope_context"
      : message.includes("KEK version")
        ? "historical_kek_unavailable"
        : message.includes("AAD") || message.includes("envelope")
          ? "batch_key_envelope_invalid"
          : "batch_key_envelope_migration_failed";
  console.error(JSON.stringify({ ok: false, code }));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}

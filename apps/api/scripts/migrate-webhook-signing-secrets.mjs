import pg from "pg";

import {
  assertWebhookSigningMasterKeyConfigured,
  decryptWebhookSigningSecret,
  encryptWebhookSigningSecret,
  isEncryptedWebhookSigningSecret,
  WebhookSecretCipherError,
} from "../src/lib/webhook-secret-cipher.ts";

const apply = process.argv.includes("--apply");
const unknownArguments = process.argv.slice(2).filter((argument) => argument !== "--apply");
if (unknownArguments.length) {
  console.error(JSON.stringify({ ok: false, code: "unsupported_argument" }));
  process.exit(2);
}

const databaseUrl = String(process.env.DATABASE_URL || "").trim();
const masterKeyHex = String(process.env.WEBHOOK_SIGNING_MASTER_KEY_HEX || "").trim();
if (!databaseUrl) {
  console.error(JSON.stringify({ ok: false, code: "database_url_required" }));
  process.exit(1);
}
try {
  assertWebhookSigningMasterKeyConfigured({ masterKeyHex, production: true });
} catch (error) {
  const code = error instanceof WebhookSecretCipherError
    ? error.code
    : "webhook_signing_master_key_invalid";
  console.error(JSON.stringify({ ok: false, code }));
  process.exit(1);
}

const client = new pg.Client({ connectionString: databaseUrl });
let transactionOpen = false;

try {
  await client.connect();
  await client.query("BEGIN");
  transactionOpen = true;
  await client.query("SET LOCAL lock_timeout = '5s'");
  await client.query("SET LOCAL statement_timeout = '60s'");
  await client.query("SELECT pg_advisory_xact_lock(487421351)");

  const result = await client.query(`
    SELECT id::text AS id, tenant_id::text AS tenant_id, signing_secret
    FROM webhook_endpoints
    WHERE signing_secret IS NOT NULL
      AND signing_secret <> ''
    ORDER BY id
    FOR UPDATE
  `);

  let encrypted = 0;
  let plaintext = 0;
  let updated = 0;
  for (const row of result.rows) {
    const storedValue = String(row.signing_secret || "");
    const tenantId = String(row.tenant_id || "");
    if (isEncryptedWebhookSigningSecret(storedValue)) {
      decryptWebhookSigningSecret(
        storedValue,
        { tenantId },
        { masterKeyHex, production: true, allowLegacyPlaintext: false },
      );
      encrypted += 1;
      continue;
    }

    plaintext += 1;
    const envelope = encryptWebhookSigningSecret(
      storedValue,
      { tenantId },
      { masterKeyHex, production: true, allowLegacyPlaintext: false },
    );
    if (apply) {
      const write = await client.query(
        `UPDATE webhook_endpoints
         SET signing_secret = $1, updated_at = now()
         WHERE id = $2`,
        [envelope, row.id],
      );
      if (write.rowCount !== 1) throw new Error("concurrent_webhook_secret_update");
      updated += 1;
    }
  }

  if (apply) {
    await client.query("COMMIT");
  } else {
    await client.query("ROLLBACK");
  }
  transactionOpen = false;
  console.log(JSON.stringify({
    ok: true,
    mode: apply ? "apply" : "dry_run",
    rows: result.rowCount,
    encrypted,
    plaintext,
    updated,
  }));
} catch (error) {
  if (transactionOpen) await client.query("ROLLBACK").catch(() => undefined);
  const code = error instanceof WebhookSecretCipherError
    ? error.code
    : String(error?.message || "") === "concurrent_webhook_secret_update"
      ? "concurrent_webhook_secret_update"
      : "webhook_secret_migration_failed";
  console.error(JSON.stringify({ ok: false, code }));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}

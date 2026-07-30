import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  decryptWebhookSigningSecret,
  encryptWebhookSigningSecret,
  isEncryptedWebhookSigningSecret,
  WEBHOOK_SIGNING_SECRET_ENVELOPE_PREFIX,
  WebhookSecretCipherError,
} from "../src/lib/webhook-secret-cipher.ts";
import { createWebhookSignatureHeaders } from "../src/lib/webhook-signing.ts";
import { verifyNexIdWebhookSignature } from "../../../packages/sdk/src/index.ts";

const currentKey = "11".repeat(32);
const otherKey = "22".repeat(32);
const tenantId = "f81d4fae-7dec-11d0-a765-00a0c91e6bf6";
const secret = "whsec_0123456789abcdef0123456789abcdef";
const cipherOptions = {
  masterKeyHex: currentKey,
  production: true,
  allowLegacyPlaintext: false,
};

function isCipherError(code) {
  return (error) => error instanceof WebhookSecretCipherError && error.code === code;
}

test("webhook secrets use randomized versioned AES-GCM envelopes", () => {
  const first = encryptWebhookSigningSecret(secret, { tenantId }, cipherOptions);
  const second = encryptWebhookSigningSecret(secret, { tenantId }, cipherOptions);
  assert.ok(first.startsWith(WEBHOOK_SIGNING_SECRET_ENVELOPE_PREFIX));
  assert.equal(isEncryptedWebhookSigningSecret(first), true);
  assert.notEqual(first, second);
  assert.equal(first.includes(secret), false);
  assert.equal(decryptWebhookSigningSecret(first, { tenantId }, cipherOptions), secret);
  assert.equal(decryptWebhookSigningSecret(second, { tenantId }, cipherOptions), secret);
});

test("tenant AAD, authentication tag and master key fail closed", () => {
  const envelope = encryptWebhookSigningSecret(secret, { tenantId }, cipherOptions);
  assert.throws(
    () => decryptWebhookSigningSecret(envelope, { tenantId: "tenant-other" }, cipherOptions),
    isCipherError("webhook_signing_secret_ciphertext_invalid"),
  );
  assert.throws(
    () => decryptWebhookSigningSecret(envelope, { tenantId }, { ...cipherOptions, masterKeyHex: otherKey }),
    isCipherError("webhook_signing_secret_ciphertext_invalid"),
  );
  const last = envelope.at(-1);
  const tampered = `${envelope.slice(0, -1)}${last === "A" ? "B" : "A"}`;
  assert.throws(
    () => decryptWebhookSigningSecret(tampered, { tenantId }, cipherOptions),
    isCipherError("webhook_signing_secret_ciphertext_invalid"),
  );
});

test("production legacy reads require both a valid key and an explicit migration flag", () => {
  assert.throws(
    () => decryptWebhookSigningSecret(secret, { tenantId }, { production: true, allowLegacyPlaintext: true, masterKeyHex: "" }),
    isCipherError("webhook_signing_master_key_required"),
  );
  assert.throws(
    () => decryptWebhookSigningSecret(secret, { tenantId }, { production: true, allowLegacyPlaintext: false, masterKeyHex: currentKey }),
    isCipherError("webhook_signing_legacy_plaintext_disabled"),
  );
  assert.equal(
    decryptWebhookSigningSecret(secret, { tenantId }, { production: true, allowLegacyPlaintext: true, masterKeyHex: currentKey }),
    secret,
  );
  assert.equal(
    decryptWebhookSigningSecret(secret, { tenantId }, { production: false, allowLegacyPlaintext: true }),
    secret,
  );
});

test("every new secret write requires the dedicated 256-bit key in every environment", () => {
  assert.throws(
    () => encryptWebhookSigningSecret(secret, { tenantId }, { production: false, masterKeyHex: "" }),
    isCipherError("webhook_signing_master_key_required"),
  );
  assert.throws(
    () => encryptWebhookSigningSecret(secret, { tenantId }, { production: false, masterKeyHex: "ab" }),
    isCipherError("webhook_signing_master_key_invalid"),
  );
});

test("a decrypted envelope produces the existing SDK-compatible signature", () => {
  const rawBody = JSON.stringify({ id: "evt_123", type: "sdk.verify" });
  const envelope = encryptWebhookSigningSecret(secret, { tenantId }, cipherOptions);
  const decrypted = decryptWebhookSigningSecret(envelope, { tenantId }, cipherOptions);
  const timestamp = 1_750_000_000;
  const headers = createWebhookSignatureHeaders({
    secret: decrypted,
    keyId: "endpoint_123",
    deliveryId: "delivery_456",
    eventId: "evt_123",
    rawBody,
    timestamp,
  });
  assert.equal(verifyNexIdWebhookSignature({ secret, rawBody, headers, now: timestamp }).ok, true);
});

test("admin writes encrypt and the delivery worker decrypts before signing", () => {
  const createRoute = readFileSync(new URL("../src/app/admin/webhooks/route.ts", import.meta.url), "utf8");
  const updateRoute = readFileSync(new URL("../src/app/admin/webhooks/[id]/route.ts", import.meta.url), "utf8");
  const rotateRoute = readFileSync(new URL("../src/app/admin/webhooks/[id]/rotate/route.ts", import.meta.url), "utf8");
  const reactivateRoute = readFileSync(new URL("../src/app/admin/webhooks/[id]/reactivate/route.ts", import.meta.url), "utf8");
  const delivery = readFileSync(new URL("../src/lib/sdk-webhooks.ts", import.meta.url), "utf8");
  for (const route of [createRoute, rotateRoute, reactivateRoute]) {
    assert.match(route, /encryptWebhookSigningSecret\(/);
  }
  assert.doesNotMatch(updateRoute, /encryptWebhookSigningSecret\(/);
  assert.match(updateRoute, /webhook_secret_rotation_route_required/);
  assert.doesNotMatch(createRoute + updateRoute + rotateRoute + reactivateRoute, /signing_secret\s*=\s*COALESCE\(\$\{signingSecret/);
  assert.match(delivery, /decryptWebhookSigningSecret\(row\.signing_secret/);
  assert.match(delivery, /picked\.tenant_id::text AS tenant_id/);
  assert.doesNotMatch(createRoute + updateRoute + rotateRoute + reactivateRoute + delivery, /KMS_MASTER_KEY_HEX/);
});

test("migration is transactional, dry-run by default and skips existing envelopes", () => {
  const migration = readFileSync(new URL("../scripts/migrate-webhook-signing-secrets.mjs", import.meta.url), "utf8");
  assert.match(migration, /process\.argv\.includes\("--apply"\)/);
  assert.match(migration, /FOR UPDATE/);
  assert.match(migration, /isEncryptedWebhookSigningSecret\(storedValue\)/);
  assert.match(migration, /if \(apply\)[\s\S]*COMMIT[\s\S]*else[\s\S]*ROLLBACK/);
  assert.doesNotMatch(migration, /console\.(?:log|error)\([^\n]*(?:signing_secret|storedValue|envelope)/);
});

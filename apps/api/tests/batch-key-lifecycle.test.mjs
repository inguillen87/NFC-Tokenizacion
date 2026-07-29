import test from "node:test";
import assert from "node:assert/strict";
import { createCipheriv, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

process.env.KMS_MASTER_KEY_HEX = process.env.KMS_MASTER_KEY_HEX || "A".repeat(64);

const {
  BATCH_KEY_ROLES,
  assertBatchKeyEnvelopeContext,
  assertBatchKeyHex32,
  buildBatchKeyLifecycleRecords,
  decryptBatchKeyHex,
  fingerprintBatchKey,
  fingerprintSupplierKeyPair,
  generateBatchKeyHex,
  generateSupplierBatchKeyPair,
  inspectBatchKeyEnvelopeBinding,
  redactSecretsDeep,
  rewrapUnscopedBatchKeyEnvelope,
} = await import("../src/lib/batch-keys.ts");
const { encryptKey16 } = await import("../src/lib/keys.ts");

test("batch key helpers generate isolated AES-128 keys and deterministic fingerprints", () => {
  const first = generateBatchKeyHex();
  const second = generateBatchKeyHex();

  assert.match(first, /^[0-9A-F]{32}$/);
  assert.match(second, /^[0-9A-F]{32}$/);
  assert.notEqual(first, second);
  assert.equal(assertBatchKeyHex32(first.toLowerCase(), "K_META_BATCH"), first);

  const metaFingerprint = fingerprintBatchKey(first, "K_META_BATCH");
  const fileFingerprint = fingerprintBatchKey(first, "K_FILE_BATCH");
  assert.match(metaFingerprint, /^[0-9A-F]{16}$/);
  assert.notEqual(metaFingerprint, fileFingerprint);
  assert.equal(fingerprintBatchKey(first, "K_META_BATCH"), metaFingerprint);
});

test("supplier batch pair keeps legacy pair fingerprint while lifecycle records are per role", () => {
  const keys = generateSupplierBatchKeyPair();
  const records = buildBatchKeyLifecycleRecords({
    tenantId: "11111111-1111-4111-8111-111111111111",
    bid: "SYN-AR-2026-001-A",
    kMetaHex: keys.kMetaHex,
    kFileHex: keys.kFileHex,
    keyVersion: 1,
    createdBy: "security-operator@nexid",
  });

  assert.deepEqual(records.map((item) => item.keyRole), BATCH_KEY_ROLES);
  assert.equal(keys.fingerprint, fingerprintSupplierKeyPair(keys.kMetaHex, keys.kFileHex));
  assert.equal(records[0].keyVersion, 1);
  assert.equal(records[0].createdBy, "security-operator@nexid");
  assert.match(records[0].encryptedKeyCt, /^nexid-app-envelope-v2\./);
  assert.equal(decryptBatchKeyHex(records[0].encryptedKeyCt, {
    tenantId: "11111111-1111-4111-8111-111111111111",
    bid: "SYN-AR-2026-001-A",
    role: "K_META_BATCH",
    keyVersion: 1,
  }), keys.kMetaHex);
  assert.equal(decryptBatchKeyHex(records[1].encryptedKeyCt, {
    tenantId: "11111111-1111-4111-8111-111111111111",
    bid: "SYN-AR-2026-001-A",
    role: "K_FILE_BATCH",
    keyVersion: 1,
  }), keys.kFileHex);
  assert.throws(() => decryptBatchKeyHex(records[0].encryptedKeyCt, {
    tenantId: "22222222-2222-4222-8222-222222222222",
    bid: "SYN-AR-2026-001-A",
    role: "K_META_BATCH",
  }), /AAD mismatch: tenantId/);
  assert.throws(() => decryptBatchKeyHex(records[0].encryptedKeyCt, {
    tenantId: "11111111-1111-4111-8111-111111111111",
    bid: "SYN-AR-2026-OTHER",
    role: "K_META_BATCH",
    keyVersion: 1,
  }), /AAD mismatch: bid/);
  assert.throws(() => decryptBatchKeyHex(records[0].encryptedKeyCt, {
    tenantId: "11111111-1111-4111-8111-111111111111",
    bid: "SYN-AR-2026-001-A",
    role: "K_FILE_BATCH",
    keyVersion: 1,
  }), /AAD mismatch: role/);

  const serialized = JSON.stringify(records);
  assert.doesNotMatch(serialized, new RegExp(keys.kMetaHex));
  assert.doesNotMatch(serialized, new RegExp(keys.kFileHex));
});

test("batch key writers fail closed without tenant-bound envelope context", () => {
  const keys = generateSupplierBatchKeyPair();
  assert.throws(() => buildBatchKeyLifecycleRecords({
    tenantId: "",
    bid: "ENTERPRISE-2026-001-A",
    kMetaHex: keys.kMetaHex,
    kFileHex: keys.kFileHex,
    keyVersion: 1,
  }), /tenantId is required/);
});

test("unscoped v2 batch envelopes require an explicit context-bound rewrap", () => {
  const raw = Buffer.from("00112233445566778899AABBCCDDEEFF", "hex");
  const unscoped = encryptKey16(raw);
  assert.deepEqual(inspectBatchKeyEnvelopeBinding(unscoped), {
    format: "v2",
    scope: "unscoped",
    kekVersion: "vercel-env-v1",
    keyVersion: 1,
  });

  const context = {
    tenantId: "11111111-1111-4111-8111-111111111111",
    bid: "SYN-AR-2026-LEGACY-A",
    role: "K_META_BATCH",
    keyVersion: 1,
  };
  const rewrapped = rewrapUnscopedBatchKeyEnvelope(unscoped, context);
  assert.equal(inspectBatchKeyEnvelopeBinding(rewrapped).scope, "context_bound");
  assert.equal(assertBatchKeyEnvelopeContext(rewrapped, context).scope, "context_bound");
  assert.equal(decryptBatchKeyHex(rewrapped, context), raw.toString("hex").toUpperCase());
  assert.throws(() => assertBatchKeyEnvelopeContext(rewrapped, {
    ...context,
    bid: "SYN-AR-2026-WRONG",
  }), /AAD mismatch: bid/);
  assert.throws(() => decryptBatchKeyHex(rewrapped, {
    ...context,
    tenantId: "22222222-2222-4222-8222-222222222222",
  }), /AAD mismatch: tenantId/);
  assert.throws(() => rewrapUnscopedBatchKeyEnvelope(rewrapped, context), /only unscoped v2/);
});

test("internal and demo batch writers use the context-bound lifecycle helper", () => {
  const sources = [
    "../src/app/admin/batches/register/route.ts",
    "../src/app/admin/supplier-orders/route.ts",
    "../src/lib/demo-seed.ts",
    "../scripts/demo-demobodega.mjs",
  ].map((relativePath) => readFileSync(new URL(relativePath, import.meta.url), "utf8"));

  for (const source of sources) {
    assert.match(source, /buildBatchKeyLifecycleRecords/);
    assert.doesNotMatch(source, /encryptKey16\s*\(/);
    assert.match(source, /tenantId:\s*String\(tenant\.id\)/);
    assert.match(source, /keyVersion/);
    assert.match(source, /key_version/);
  }
});

test("batch envelope migration is dry-run by default and requires explicit apply consent", () => {
  const source = readFileSync(new URL("../scripts/migrate-batch-key-envelope-context.mjs", import.meta.url), "utf8");
  assert.match(source, /const apply = process\.argv\.includes\("--apply"\)/);
  assert.match(source, /NEXID_BATCH_KEY_MIGRATION_CONFIRM/);
  assert.match(source, /REWRAP_UNSCOPED_V2/);
  assert.match(source, /BEGIN/);
  assert.match(source, /pg_advisory_xact_lock/);
  assert.match(source, /IS NOT DISTINCT FROM/);
  assert.doesNotMatch(source, /console\.(?:log|error)\([^\n]*(?:meta_key_ct|file_key_ct|encrypted_key_ct)/);
});

test("secret redaction preserves safe identifiers while removing raw keys and transport secrets", () => {
  const metaKey = "B".repeat(32);
  const fileKey = "C".repeat(32);
  const kms = "D".repeat(64);
  const input = {
    tenant_slug: "syngenta",
    key_fingerprint: "SAFEFINGERPRINT01",
    KMS_MASTER_KEY_HEX: kms,
    nested: {
      K_META_BATCH: metaKey,
      url: "https://supplier.example/pack?bid=SYN-A&token=raw-token&X-Amz-Signature=raw-signature",
      log: `K_FILE_BATCH=${fileKey}`,
    },
    artifacts: [{ encrypted_key_ct: "ciphertext" }, { note: "ok" }],
  };

  const redacted = redactSecretsDeep(input);
  const serialized = JSON.stringify(redacted);
  const redactedUrl = new URL(redacted.nested.url);

  assert.equal(redacted.tenant_slug, "syngenta");
  assert.equal(redacted.key_fingerprint, "SAFEFINGERPRINT01");
  assert.equal(redacted.KMS_MASTER_KEY_HEX, "[REDACTED]");
  assert.equal(redacted.nested.K_META_BATCH, "[REDACTED]");
  assert.equal(redacted.artifacts[0].encrypted_key_ct, "[REDACTED]");
  assert.equal(redactedUrl.searchParams.get("token"), "[REDACTED]");
  assert.equal(redactedUrl.searchParams.get("X-Amz-Signature"), "[REDACTED]");
  assert.doesNotMatch(serialized, new RegExp(metaKey));
  assert.doesNotMatch(serialized, new RegExp(fileKey));
  assert.doesNotMatch(serialized, new RegExp(kms));
});

test("legacy unversioned ciphertext remains readable during the pilot migration", () => {
  const plaintext = Buffer.from("AB".repeat(16), "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(process.env.KMS_MASTER_KEY_HEX, "hex"), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const legacy = Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");

  assert.equal(decryptBatchKeyHex(legacy), plaintext.toString("hex").toUpperCase());
});

test("legacy ciphertext can remain pinned to its previous KEK while the active KEK rotates", () => {
  const previous = {
    master: process.env.KMS_MASTER_KEY_HEX,
    activeVersion: process.env.NFC_ENVELOPE_KEK_VERSION,
    legacyVersion: process.env.NFC_LEGACY_ENVELOPE_KEK_VERSION,
    oldVersionKey: process.env.NFC_ENVELOPE_KEK_VERCEL_ENV_V0_HEX,
  };
  const oldKeyHex = "C".repeat(64);
  const plaintext = Buffer.from("CD".repeat(16), "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(oldKeyHex, "hex"), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const legacy = Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
  try {
    process.env.KMS_MASTER_KEY_HEX = "D".repeat(64);
    process.env.NFC_ENVELOPE_KEK_VERSION = "vercel-env-v1";
    process.env.NFC_LEGACY_ENVELOPE_KEK_VERSION = "vercel-env-v0";
    process.env.NFC_ENVELOPE_KEK_VERCEL_ENV_V0_HEX = oldKeyHex;
    assert.equal(decryptBatchKeyHex(legacy), plaintext.toString("hex").toUpperCase());
  } finally {
    for (const [name, value] of [
      ["KMS_MASTER_KEY_HEX", previous.master],
      ["NFC_ENVELOPE_KEK_VERSION", previous.activeVersion],
      ["NFC_LEGACY_ENVELOPE_KEK_VERSION", previous.legacyVersion],
      ["NFC_ENVELOPE_KEK_VERCEL_ENV_V0_HEX", previous.oldVersionKey],
    ]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});

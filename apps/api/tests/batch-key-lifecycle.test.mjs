import test from "node:test";
import assert from "node:assert/strict";

process.env.KMS_MASTER_KEY_HEX = process.env.KMS_MASTER_KEY_HEX || "A".repeat(64);

const {
  BATCH_KEY_ROLES,
  assertBatchKeyHex32,
  buildBatchKeyLifecycleRecords,
  decryptBatchKeyHex,
  fingerprintBatchKey,
  fingerprintSupplierKeyPair,
  generateBatchKeyHex,
  generateSupplierBatchKeyPair,
  redactSecretsDeep,
} = await import("../src/lib/batch-keys.ts");

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
  assert.match(records[0].encryptedKeyCt, /^[A-Za-z0-9+/=]+$/);
  assert.equal(decryptBatchKeyHex(records[0].encryptedKeyCt), keys.kMetaHex);
  assert.equal(decryptBatchKeyHex(records[1].encryptedKeyCt), keys.kFileHex);

  const serialized = JSON.stringify(records);
  assert.doesNotMatch(serialized, new RegExp(keys.kMetaHex));
  assert.doesNotMatch(serialized, new RegExp(keys.kFileHex));
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

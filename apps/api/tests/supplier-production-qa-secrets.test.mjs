import assert from "node:assert/strict";
import test from "node:test";

const priorMasterKey = process.env.KMS_MASTER_KEY_HEX;
process.env.KMS_MASTER_KEY_HEX = "9a".repeat(32);

const {
  createSupplierProductionQaSecrets,
  decryptSupplierProductionQaChallenge,
  decryptSupplierProductionQaSeed,
} = await import("../src/lib/supplier-production-qa-secrets.ts");

test("production QA entropy uses tenant, BID and session-bound software envelopes", () => {
  const context = {
    tenantId: "11111111-1111-4111-8111-111111111111",
    bid: "PROD-2026-001",
    sessionId: "22222222-2222-4222-8222-222222222222",
  };
  const created = createSupplierProductionQaSecrets(context);
  try {
    assert.equal(created.seed.length, 32);
    assert.match(created.seedCiphertext, /^nexid-app-envelope-v2\..+\|nexid-app-envelope-v2\./);
    assert.match(created.challengeCiphertext, /^nexid-app-envelope-v2\./);
    assert.equal(created.seedCiphertext.includes(created.seedReveal), false);
    assert.equal(created.challengeCiphertext.includes(created.challenge), false);

    const decryptedSeed = decryptSupplierProductionQaSeed(created.seedCiphertext, context);
    try {
      assert.deepEqual(decryptedSeed, created.seed);
    } finally {
      decryptedSeed.fill(0);
    }
    assert.equal(
      decryptSupplierProductionQaChallenge(created.challengeCiphertext, context),
      created.challenge,
    );
    assert.throws(
      () => decryptSupplierProductionQaSeed(created.seedCiphertext, {
        ...context,
        tenantId: "33333333-3333-4333-8333-333333333333",
      }),
      /AAD mismatch: tenantId/,
    );
    assert.throws(
      () => decryptSupplierProductionQaChallenge(created.challengeCiphertext, {
        ...context,
        sessionId: "44444444-4444-4444-8444-444444444444",
      }),
      /AAD mismatch: role/,
    );
  } finally {
    created.seed.fill(0);
  }
});

test.after(() => {
  if (priorMasterKey === undefined) delete process.env.KMS_MASTER_KEY_HEX;
  else process.env.KMS_MASTER_KEY_HEX = priorMasterKey;
});

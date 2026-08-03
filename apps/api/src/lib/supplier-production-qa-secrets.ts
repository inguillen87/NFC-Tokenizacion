import { randomBytes } from "node:crypto";
import { decryptKey16, encryptKey16 } from "./keys";

type QaSecretContext = {
  tenantId: string;
  bid: string;
  sessionId: string;
};

function envelopeContext(input: QaSecretContext, role: string) {
  return {
    tenantId: input.tenantId,
    bid: input.bid,
    role: `SUPPLIER_PRODUCTION_QA:${input.sessionId}:${role}`,
    keyVersion: "1",
  };
}

/**
 * Uses the existing software AES-256-GCM application envelope. This protects
 * pilot secrets at rest but is deliberately not described as managed KMS or
 * HSM custody.
 */
export function createSupplierProductionQaSecrets(context: QaSecretContext) {
  const seed = randomBytes(32);
  const challengeBytes = randomBytes(16);
  try {
    const seedCiphertext = [
      encryptKey16(seed.subarray(0, 16), envelopeContext(context, "SELECTION_SEED_A")),
      encryptKey16(seed.subarray(16, 32), envelopeContext(context, "SELECTION_SEED_B")),
    ].join("|");
    const challengeCiphertext = encryptKey16(
      challengeBytes,
      envelopeContext(context, "CEREMONY_CHALLENGE"),
    );
    return {
      seed: Buffer.from(seed),
      seedReveal: seed.toString("base64url"),
      seedCiphertext,
      challenge: challengeBytes.toString("base64url"),
      challengeCiphertext,
    };
  } finally {
    seed.fill(0);
    challengeBytes.fill(0);
  }
}

export function decryptSupplierProductionQaSeed(
  ciphertext: string,
  context: QaSecretContext,
) {
  const [left, right, extra] = String(ciphertext || "").split("|");
  if (!left || !right || extra) throw new Error("supplier_production_qa_seed_envelope_invalid");
  const first = decryptKey16(left, envelopeContext(context, "SELECTION_SEED_A"));
  const second = decryptKey16(right, envelopeContext(context, "SELECTION_SEED_B"));
  try {
    return Buffer.concat([first, second]);
  } finally {
    first.fill(0);
    second.fill(0);
  }
}

export function decryptSupplierProductionQaChallenge(
  ciphertext: string,
  context: QaSecretContext,
) {
  const plaintext = decryptKey16(ciphertext, envelopeContext(context, "CEREMONY_CHALLENGE"));
  try {
    return plaintext.toString("base64url");
  } finally {
    plaintext.fill(0);
  }
}

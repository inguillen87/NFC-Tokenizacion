import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

type NodeBuf = Buffer<ArrayBufferLike>;

export type ApplicationEnvelopeContext = {
  tenantId?: string | null;
  bid?: string | null;
  role?: string | null;
  keyVersion?: number | string | null;
};

const ENVELOPE_PREFIX = "nexid-app-envelope-v2";

function currentKekVersion() {
  return String(process.env.NFC_ENVELOPE_KEK_VERSION || "vercel-env-v1").trim() || "vercel-env-v1";
}

function legacyKekVersion() {
  return String(process.env.NFC_LEGACY_ENVELOPE_KEK_VERSION || currentKekVersion()).trim() || currentKekVersion();
}

function versionedKekEnvironmentName(version: string) {
  const suffix = version.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return suffix ? `NFC_ENVELOPE_KEK_${suffix}_HEX` : "";
}

// Pilot custody only: these are raw application secrets stored by the
// deployment platform. They are not managed KMS handles and are not HSM-backed.
// A versioned secondary env allows dual-read during KEK rotation.
function applicationMasterKey(requestedVersion?: string | null): NodeBuf {
  const activeVersion = currentKekVersion();
  const requested = String(requestedVersion || activeVersion).trim();
  const versionedName = requested === activeVersion ? "" : versionedKekEnvironmentName(requested);
  const hex = versionedName ? process.env[versionedName] : process.env.KMS_MASTER_KEY_HEX;
  if (!hex) {
    throw new Error(versionedName
      ? `NFC envelope KEK version ${requested} is unavailable`
      : "KMS_MASTER_KEY_HEX is not set");
  }
  const key = Buffer.from(hex, "hex") as NodeBuf;
  if (key.length !== 32) throw new Error("NFC application envelope KEK must be 32 bytes hex (64 chars)");
  return key;
}

function normalizedEnvelopeContext(context: ApplicationEnvelopeContext, kekVersion: string) {
  return {
    schema: "nexid-nfc-application-envelope-v2",
    kekVersion,
    tenantId: String(context.tenantId || "unscoped").trim().toLowerCase(),
    bid: String(context.bid || "unscoped").trim(),
    role: String(context.role || "unscoped").trim().toUpperCase(),
    keyVersion: String(context.keyVersion || "1").trim(),
  };
}

function assertExpectedContext(
  embedded: ReturnType<typeof normalizedEnvelopeContext>,
  expected: ApplicationEnvelopeContext,
) {
  const comparisons: Array<[keyof ApplicationEnvelopeContext, string, string]> = [
    ["tenantId", embedded.tenantId, String(expected.tenantId || "").trim().toLowerCase()],
    ["bid", embedded.bid, String(expected.bid || "").trim()],
    ["role", embedded.role, String(expected.role || "").trim().toUpperCase()],
    ["keyVersion", embedded.keyVersion, String(expected.keyVersion || "").trim()],
  ];
  for (const [field, actual, wanted] of comparisons) {
    if (expected[field] != null && wanted && actual !== wanted) {
      throw new Error(`NFC application envelope AAD mismatch: ${field}`);
    }
  }
}

export function encryptKey16(key16: Uint8Array, context: ApplicationEnvelopeContext = {}): string {
  if (key16.length !== 16) throw new Error("key must be 16 bytes");
  const kekVersion = currentKekVersion();
  const key = applicationMasterKey(kekVersion);
  const iv = randomBytes(12) as NodeBuf;
  const aadDocument = normalizedEnvelopeContext(context, kekVersion);
  const aad = Buffer.from(JSON.stringify(aadDocument), "utf8") as NodeBuf;
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad);
  const ct = Buffer.concat([cipher.update(key16), cipher.final()]) as NodeBuf;
  const tag = cipher.getAuthTag() as NodeBuf;
  const payload = (Buffer.concat([iv, tag, ct]) as NodeBuf).toString("base64url");
  return `${ENVELOPE_PREFIX}.${aad.toString("base64url")}.${payload}`;
}

export function decryptKey16(value: string, expectedContext: ApplicationEnvelopeContext = {}): NodeBuf {
  if (!value.startsWith(`${ENVELOPE_PREFIX}.`)) {
    // Legacy envelopes did not carry an authenticated KEK version. Operators
    // must pin the version that encrypted those rows while the active KEK is
    // rotated; this keeps existing samples readable without silently trying
    // arbitrary keys.
    const raw = Buffer.from(value, "base64") as NodeBuf;
    const iv = raw.subarray(0, 12) as NodeBuf;
    const tag = raw.subarray(12, 28) as NodeBuf;
    const ct = raw.subarray(28) as NodeBuf;
    const decipher = createDecipheriv("aes-256-gcm", applicationMasterKey(legacyKekVersion()), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]) as NodeBuf;
  }

  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== ENVELOPE_PREFIX) throw new Error("NFC application envelope is malformed");
  let embedded: ReturnType<typeof normalizedEnvelopeContext>;
  try {
    embedded = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    throw new Error("NFC application envelope AAD is malformed");
  }
  if (embedded.schema !== "nexid-nfc-application-envelope-v2" || !embedded.kekVersion) {
    throw new Error("NFC application envelope schema is unsupported");
  }
  assertExpectedContext(embedded, expectedContext);
  const raw = Buffer.from(parts[2], "base64url") as NodeBuf;
  if (raw.length !== 44) throw new Error("NFC application envelope ciphertext is malformed");
  const iv = raw.subarray(0, 12) as NodeBuf;
  const tag = raw.subarray(12, 28) as NodeBuf;
  const ct = raw.subarray(28) as NodeBuf;
  const aad = Buffer.from(parts[1], "base64url") as NodeBuf;
  const decipher = createDecipheriv("aes-256-gcm", applicationMasterKey(embedded.kekVersion), iv);
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]) as NodeBuf;
}

import {
  createHash,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "node:crypto";

export const OWNERSHIP_CLAIM_PIN_MIN_CHARACTERS = 8;
export const OWNERSHIP_CLAIM_PIN_MAX_CHARACTERS = 128;
export const OWNERSHIP_CLAIM_PIN_MAX_BYTES = 256;

const FORMAT_PREFIX = "nexid-claim-pin";
const FORMAT_VERSION = "v1";
const FORMAT_ALGORITHM = "scrypt";
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 32;
const SCRYPT_MAXMEM = 32 * 1024 * 1024;
const SALT_BYTES = 16;
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/i;
const VISIBLE_ASCII_PATTERN = /^[\x21-\x7e]+$/;

const COMMON_TRIVIAL_CODES = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "87654321",
  "00000000",
  "11111111",
  "abcdefgh",
  "password",
  "password1",
  "passw0rd",
  "qwertyui",
  "qwerty123",
  "letmein1",
  "changeme",
  "nexid123",
  "nexid2026",
]);

export type OwnershipClaimPinContext = {
  tenantId: string;
  bid: string;
  uidHex?: string | null;
};

export type OwnershipClaimPinAlgorithm =
  | "scrypt-v1"
  | "legacy-sha256-raw"
  | "legacy-sha256-tag-context"
  | "legacy-sha256-batch-context"
  | "unknown";

export type OwnershipClaimPinVerification = {
  matches: boolean;
  algorithm: OwnershipClaimPinAlgorithm;
  needsRotation: boolean;
};

export type OwnershipClaimPinInputReason =
  | "pin_required"
  | "pin_invalid_type"
  | "pin_too_long"
  | "pin_invalid_characters";

export type OwnershipClaimPinInput =
  | { ok: true; pin: string }
  | {
      ok: false;
      reason: OwnershipClaimPinInputReason;
    };

export type NewOwnershipClaimPinValidation =
  | { ok: true; pin: string }
  | {
      ok: false;
      reason:
        | OwnershipClaimPinInputReason
        | "pin_too_short"
        | "pin_trivial";
    };

type NormalizedContext = {
  tenantId: string;
  bid: string;
  uidHex: string;
};

type ScryptScope = "batch" | "tag";

function normalizeContext(context: OwnershipClaimPinContext): NormalizedContext {
  const tenantId = String(context.tenantId || "").trim();
  const bid = String(context.bid || "").trim();
  const uidHex = String(context.uidHex || "").trim().toUpperCase();
  if (!tenantId || tenantId.length > 128) throw new Error("ownership_claim_pin_invalid_tenant_context");
  if (!bid || bid.length > 256) throw new Error("ownership_claim_pin_invalid_batch_context");
  if (uidHex.length > 256) throw new Error("ownership_claim_pin_invalid_uid_context");
  return { tenantId, bid, uidHex };
}

export function readOwnershipClaimPinInput(
  value: unknown,
  options: { required?: boolean } = {},
): OwnershipClaimPinInput {
  if (value === undefined || value === null || value === "") {
    return options.required
      ? { ok: false, reason: "pin_required" }
      : { ok: true, pin: "" };
  }
  if (typeof value !== "string") return { ok: false, reason: "pin_invalid_type" };
  if (Buffer.byteLength(value, "utf8") > OWNERSHIP_CLAIM_PIN_MAX_BYTES) {
    return { ok: false, reason: "pin_too_long" };
  }
  const pin = value.trim();
  if (!pin) {
    return options.required
      ? { ok: false, reason: "pin_required" }
      : { ok: true, pin: "" };
  }
  if (pin.length > OWNERSHIP_CLAIM_PIN_MAX_CHARACTERS) {
    return { ok: false, reason: "pin_too_long" };
  }
  if (!VISIBLE_ASCII_PATTERN.test(pin)) {
    return { ok: false, reason: "pin_invalid_characters" };
  }
  return { ok: true, pin };
}

function isSequential(code: string) {
  const sequences = [
    "012345678901234567890123456789",
    "987654321098765432109876543210",
    "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz",
    "zyxwvutsrqponmlkjihgfedcbazyxwvutsrqponmlkjihgfedcba",
    "qwertyuiopasdfghjklzxcvbnmqwertyuiopasdfghjklzxcvbnm",
  ];
  return sequences.some((sequence) => sequence.includes(code));
}

function isTrivialPin(pin: string, context: OwnershipClaimPinContext) {
  const lower = pin.toLowerCase();
  if (COMMON_TRIVIAL_CODES.has(lower)) return true;
  if (/^(.)\1+$/.test(lower)) return true;
  if (/^(.{1,4})\1+$/.test(lower)) return true;
  if (isSequential(lower)) return true;

  const normalizedCode = lower.replace(/[^a-z0-9]/g, "");
  const normalizedContext = normalizeContext(context);
  const contextIdentifiers = [
    normalizedContext.tenantId,
    normalizedContext.bid,
    normalizedContext.uidHex,
  ]
    .map((entry) => entry.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter((entry) => entry.length >= OWNERSHIP_CLAIM_PIN_MIN_CHARACTERS);
  return contextIdentifiers.includes(normalizedCode);
}

export function validateNewOwnershipClaimPin(
  value: unknown,
  context: OwnershipClaimPinContext,
): NewOwnershipClaimPinValidation {
  const parsed = readOwnershipClaimPinInput(value, { required: true });
  if (!parsed.ok) return parsed;
  if (parsed.pin.length < OWNERSHIP_CLAIM_PIN_MIN_CHARACTERS) {
    return { ok: false, reason: "pin_too_short" };
  }
  if (isTrivialPin(parsed.pin, context)) {
    return { ok: false, reason: "pin_trivial" };
  }
  return parsed;
}

function secretMaterial(pin: string, context: NormalizedContext, scope: ScryptScope) {
  return Buffer.from([
    "nexid-ownership-claim-pin-v1",
    scope,
    context.tenantId,
    context.bid,
    scope === "tag" ? context.uidHex : "",
    pin,
  ].join("\0"), "utf8");
}

function deriveScrypt(secret: Buffer, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(secret, salt, SCRYPT_KEY_LENGTH, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
      maxmem: SCRYPT_MAXMEM,
    }, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey as Buffer);
    });
  });
}

function encodedScryptHash(scope: ScryptScope, salt: Buffer, digest: Buffer) {
  return [
    FORMAT_PREFIX,
    FORMAT_VERSION,
    FORMAT_ALGORITHM,
    `N=${SCRYPT_N}`,
    `r=${SCRYPT_R}`,
    `p=${SCRYPT_P}`,
    `dk=${SCRYPT_KEY_LENGTH}`,
    `maxmem=${SCRYPT_MAXMEM}`,
    `scope=${scope}`,
    salt.toString("base64url"),
    digest.toString("base64url"),
  ].join("$");
}

export async function hashOwnershipClaimPin(
  pin: string,
  contextInput: OwnershipClaimPinContext,
) {
  const validation = validateNewOwnershipClaimPin(pin, contextInput);
  if (!validation.ok) {
    const error = new Error(validation.reason) as Error & { code?: string };
    error.code = validation.reason;
    throw error;
  }
  const context = normalizeContext(contextInput);
  const scope: ScryptScope = context.uidHex ? "tag" : "batch";
  const salt = randomBytes(SALT_BYTES);
  const digest = await deriveScrypt(secretMaterial(validation.pin, context, scope), salt);
  return encodedScryptHash(scope, salt, digest);
}

function parseScryptHash(storedHash: string) {
  const parts = storedHash.split("$");
  if (
    parts.length !== 11
    || parts[0] !== FORMAT_PREFIX
    || parts[1] !== FORMAT_VERSION
    || parts[2] !== FORMAT_ALGORITHM
    || parts[3] !== `N=${SCRYPT_N}`
    || parts[4] !== `r=${SCRYPT_R}`
    || parts[5] !== `p=${SCRYPT_P}`
    || parts[6] !== `dk=${SCRYPT_KEY_LENGTH}`
    || parts[7] !== `maxmem=${SCRYPT_MAXMEM}`
    || !/^scope=(?:batch|tag)$/.test(parts[8])
    || !/^[A-Za-z0-9_-]{22}$/.test(parts[9])
    || !/^[A-Za-z0-9_-]{43}$/.test(parts[10])
  ) {
    return null;
  }
  const salt = Buffer.from(parts[9], "base64url");
  const digest = Buffer.from(parts[10], "base64url");
  if (salt.length !== SALT_BYTES || digest.length !== SCRYPT_KEY_LENGTH) return null;
  return {
    scope: parts[8].slice("scope=".length) as ScryptScope,
    salt,
    digest,
  };
}

/**
 * Chooses the online-guess budget boundary from the credential itself. Legacy
 * hashes do not encode a scope, so they deliberately share the batch budget
 * until rotated to a self-describing record.
 */
export function ownershipClaimPinRateScope(storedHash: unknown): ScryptScope {
  const parsed = parseScryptHash(String(storedHash || "").trim());
  return parsed?.scope === "tag" ? "tag" : "batch";
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

function safeEqual(left: Buffer, right: Buffer) {
  const sameLength = left.length === right.length;
  const comparableRight = sameLength ? right : Buffer.alloc(left.length);
  const equal = timingSafeEqual(left, comparableRight);
  return sameLength && equal;
}

function legacyVerification(
  storedHash: string,
  pin: string,
  context: NormalizedContext,
): OwnershipClaimPinVerification {
  const storedDigest = SHA256_HEX_PATTERN.test(storedHash)
    ? Buffer.from(storedHash, "hex")
    : Buffer.alloc(32);
  const candidates: Array<[Exclude<OwnershipClaimPinAlgorithm, "scrypt-v1" | "unknown">, Buffer]> = [
    ["legacy-sha256-raw", sha256(pin)],
    ["legacy-sha256-tag-context", sha256(`${context.tenantId}:${context.bid}:${context.uidHex}:${pin}`)],
    ["legacy-sha256-batch-context", sha256(`${context.tenantId}:${context.bid}:${pin}`)],
  ];
  const matches = candidates.map(([, candidate]) => safeEqual(candidate, storedDigest));
  const matchedIndex = matches.findIndex(Boolean);
  const matched = SHA256_HEX_PATTERN.test(storedHash) && matchedIndex >= 0;
  return {
    matches: matched,
    algorithm: matched ? candidates[matchedIndex][0] : "unknown",
    needsRotation: matched,
  };
}

export async function verifyOwnershipClaimPin(input: {
  storedHash: string;
  pin: string;
  context: OwnershipClaimPinContext;
}): Promise<OwnershipClaimPinVerification> {
  const storedHash = String(input.storedHash || "").trim();
  const parsedPin = readOwnershipClaimPinInput(input.pin, { required: true });
  const context = normalizeContext(input.context);
  if (!parsedPin.ok || !storedHash) {
    // Keep malformed/absent records on the same timing-safe legacy comparison
    // surface. Routes still return one generic invalid-PIN outcome.
    return legacyVerification("", parsedPin.ok ? parsedPin.pin : "", context);
  }

  const parsedScrypt = parseScryptHash(storedHash);
  if (!parsedScrypt) return legacyVerification(storedHash.toLowerCase(), parsedPin.pin, context);
  if (parsedScrypt.scope === "tag" && !context.uidHex) {
    // Perform the KDF even when context is incomplete so this condition does
    // not become a cheap format oracle at the API boundary.
    const candidate = await deriveScrypt(secretMaterial(parsedPin.pin, context, parsedScrypt.scope), parsedScrypt.salt);
    safeEqual(candidate, parsedScrypt.digest);
    return { matches: false, algorithm: "scrypt-v1", needsRotation: false };
  }
  const candidate = await deriveScrypt(secretMaterial(parsedPin.pin, context, parsedScrypt.scope), parsedScrypt.salt);
  return {
    matches: safeEqual(candidate, parsedScrypt.digest),
    algorithm: "scrypt-v1",
    needsRotation: false,
  };
}

export const OWNERSHIP_CLAIM_PIN_SCRYPT_POLICY = Object.freeze({
  version: FORMAT_VERSION,
  algorithm: FORMAT_ALGORITHM,
  N: SCRYPT_N,
  r: SCRYPT_R,
  p: SCRYPT_P,
  keyLength: SCRYPT_KEY_LENGTH,
  maxmem: SCRYPT_MAXMEM,
  saltBytes: SALT_BYTES,
});

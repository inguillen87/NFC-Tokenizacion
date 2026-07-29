import { createHash, randomBytes } from "node:crypto";
import { decryptKey16, encryptKey16 } from "./keys.ts";

export const BATCH_KEY_ROLES = ["K_META_BATCH", "K_FILE_BATCH"] as const;
export type BatchKeyRole = (typeof BATCH_KEY_ROLES)[number];

export type BatchKeyEnvelopeContext = {
  tenantId: string;
  bid: string;
  role: BatchKeyRole;
  keyVersion: number;
};

export type BatchKeyEnvelopeBinding = {
  format: "legacy" | "v2";
  scope: "legacy" | "unscoped" | "context_bound" | "partial";
  kekVersion: string | null;
  keyVersion: number | null;
};

export type SupplierBatchKeyPair = {
  kMetaHex: string;
  kFileHex: string;
  fingerprint: string;
  roleFingerprints: Record<BatchKeyRole, string>;
};

export type BatchKeyLifecycleRecord = {
  bid: string;
  keyRole: BatchKeyRole;
  keyVersion: number;
  encryptedKeyCt: string;
  keyFingerprint: string;
  status: "active";
  createdBy: string | null;
};

const BATCH_KEY_ROLE_SET = new Set<string>(BATCH_KEY_ROLES);
const APPLICATION_ENVELOPE_PREFIX = "nexid-app-envelope-v2";
const APPLICATION_ENVELOPE_SCHEMA = "nexid-nfc-application-envelope-v2";
const REDACTED = "[REDACTED]";

function normalizeSecretKey(key: string) {
  return key
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

const SENSITIVE_KEY_NAMES = new Set([
  "admin_api_key",
  "admin_token",
  "api_key",
  "authorization",
  "bearer_token",
  "cookie",
  "database_url",
  "db_url",
  "encrypted_key_ct",
  "file_key",
  "file_key_ct",
  "iota_private_key",
  "k_file",
  "k_file_batch",
  "k_file_hex",
  "k_meta",
  "k_meta_batch",
  "k_meta_hex",
  "kms_master_key",
  "kms_master_key_hex",
  "meta_key",
  "meta_key_ct",
  "pack_password",
  "password",
  "polygon_private_key",
  "private_key",
  "raw_key",
  "secret",
  "secret_key",
  "session_token",
  "signature",
  "token",
  "webhook_secret",
]);

const SENSITIVE_QUERY_KEYS = new Set([
  "access_token",
  "api_key",
  "key",
  "password",
  "secret",
  "signature",
  "sig",
  "token",
  "x_amz_credential",
  "x_amz_security_token",
  "x_amz_signature",
]);

function isSensitiveKey(key: string) {
  const normalized = normalizeSecretKey(key);
  if (SENSITIVE_KEY_NAMES.has(normalized)) return true;
  return (
    normalized.endsWith("_api_key")
    || normalized.endsWith("_secret")
    || normalized.endsWith("_token")
    || normalized.endsWith("_private_key")
    || normalized.endsWith("_password")
  );
}

function redactUrlString(value: string) {
  if (!/^https?:\/\//i.test(value)) return value;
  try {
    const url = new URL(value);
    for (const key of Array.from(url.searchParams.keys())) {
      if (SENSITIVE_QUERY_KEYS.has(normalizeSecretKey(key))) {
        url.searchParams.set(key, REDACTED);
      }
    }
    return url.toString();
  } catch {
    return value;
  }
}

function redactSecretAssignments(value: string) {
  return value.replace(
    /\b(KMS_MASTER_KEY(?:_HEX)?|DATABASE_URL|POLYGON_PRIVATE_KEY|IOTA_PRIVATE_KEY|ADMIN_API_KEY|ADMIN_TOKEN|WEBHOOK_SECRET|K_META_BATCH|K_FILE_BATCH|PACK_PASSWORD|PRIVATE_KEY|API_KEY|AUTHORIZATION|COOKIE)\b(\s*[:=]\s*)([^,\s"'}]+)/gi,
    (_match, key: string, separator: string) => `${key}${separator}${REDACTED}`,
  );
}

function normalizeKeyVersion(value: unknown) {
  const parsed = Math.trunc(Number(value || 1));
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error("key_version must be greater than zero");
  return parsed;
}

function normalizeBatchKeyEnvelopeContext(context: BatchKeyEnvelopeContext): BatchKeyEnvelopeContext {
  const tenantId = String(context?.tenantId || "").trim();
  const bid = String(context?.bid || "").trim();
  if (!tenantId) throw new Error("tenantId is required for batch key encryption");
  if (!bid) throw new Error("bid is required for batch key encryption");
  return {
    tenantId,
    bid,
    role: normalizeBatchKeyRole(context.role),
    keyVersion: normalizeKeyVersion(context.keyVersion),
  };
}

export function normalizeBatchKeyRole(value: unknown): BatchKeyRole {
  const role = String(value || "").trim().toUpperCase();
  if (!BATCH_KEY_ROLE_SET.has(role)) {
    throw new Error("batch key role is not supported");
  }
  return role as BatchKeyRole;
}

export function assertBatchKeyHex32(value: unknown, field = "batch_key") {
  const normalized = String(value || "").trim().toUpperCase();
  if (!/^[0-9A-F]{32}$/.test(normalized)) {
    throw new Error(`${field} must be a 32-char hex string`);
  }
  return normalized;
}

export function generateBatchKeyHex() {
  return randomBytes(16).toString("hex").toUpperCase();
}

export function fingerprintBatchKey(keyHex: string, role: BatchKeyRole) {
  const normalizedRole = normalizeBatchKeyRole(role);
  const key = assertBatchKeyHex32(keyHex, normalizedRole);
  return createHash("sha256")
    .update(`nexid:batch-key:v1:${normalizedRole}:${key}`)
    .digest("hex")
    .slice(0, 16)
    .toUpperCase();
}

export function fingerprintSupplierKeyPair(kMetaHex: string, kFileHex: string) {
  const meta = assertBatchKeyHex32(kMetaHex, "K_META_BATCH");
  const file = assertBatchKeyHex32(kFileHex, "K_FILE_BATCH");
  return createHash("sha256").update(`${meta}:${file}`).digest("hex").slice(0, 16).toUpperCase();
}

export function generateSupplierBatchKeyPair(): SupplierBatchKeyPair {
  const kMetaHex = generateBatchKeyHex();
  const kFileHex = generateBatchKeyHex();
  return {
    kMetaHex,
    kFileHex,
    fingerprint: fingerprintSupplierKeyPair(kMetaHex, kFileHex),
    roleFingerprints: {
      K_META_BATCH: fingerprintBatchKey(kMetaHex, "K_META_BATCH"),
      K_FILE_BATCH: fingerprintBatchKey(kFileHex, "K_FILE_BATCH"),
    },
  };
}

export function encryptBatchKeyHex(keyHex: string, context: BatchKeyEnvelopeContext) {
  const authenticatedContext = normalizeBatchKeyEnvelopeContext(context);
  return encryptKey16(Buffer.from(assertBatchKeyHex32(keyHex), "hex"), authenticatedContext);
}

export function inspectBatchKeyEnvelopeBinding(encryptedKeyCt: string): BatchKeyEnvelopeBinding {
  const value = String(encryptedKeyCt || "").trim();
  if (!value.startsWith(`${APPLICATION_ENVELOPE_PREFIX}.`)) {
    return { format: "legacy", scope: "legacy", kekVersion: null, keyVersion: null };
  }

  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== APPLICATION_ENVELOPE_PREFIX) {
    throw new Error("NFC application envelope is malformed");
  }

  let document: Record<string, unknown>;
  try {
    document = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    throw new Error("NFC application envelope AAD is malformed");
  }
  const kekVersion = String(document.kekVersion || "").trim();
  if (document.schema !== APPLICATION_ENVELOPE_SCHEMA || !kekVersion) {
    throw new Error("NFC application envelope schema is unsupported");
  }

  const tenantId = String(document.tenantId || "").trim().toLowerCase();
  const bid = String(document.bid || "").trim();
  const role = String(document.role || "").trim().toUpperCase();
  const parsedVersion = Number(document.keyVersion);
  const keyVersion = Number.isInteger(parsedVersion) && parsedVersion > 0 ? parsedVersion : null;
  const unscoped = tenantId === "unscoped" && bid === "unscoped" && role === "UNSCOPED" && keyVersion != null;
  const contextBound = tenantId !== "" && tenantId !== "unscoped"
    && bid !== "" && bid !== "unscoped"
    && BATCH_KEY_ROLE_SET.has(role)
    && keyVersion != null;

  return {
    format: "v2",
    scope: unscoped ? "unscoped" : contextBound ? "context_bound" : "partial",
    kekVersion,
    keyVersion,
  };
}

export function rewrapUnscopedBatchKeyEnvelope(
  encryptedKeyCt: string,
  context: BatchKeyEnvelopeContext,
) {
  const authenticatedContext = normalizeBatchKeyEnvelopeContext(context);
  const binding = inspectBatchKeyEnvelopeBinding(encryptedKeyCt);
  if (binding.format !== "v2" || binding.scope !== "unscoped") {
    throw new Error("only unscoped v2 batch key envelopes can be rewrapped");
  }

  const plaintext = decryptKey16(String(encryptedKeyCt));
  try {
    return encryptKey16(plaintext, authenticatedContext);
  } finally {
    plaintext.fill(0);
  }
}

export function assertBatchKeyEnvelopeContext(
  encryptedKeyCt: string,
  context: BatchKeyEnvelopeContext,
) {
  const authenticatedContext = normalizeBatchKeyEnvelopeContext(context);
  const binding = inspectBatchKeyEnvelopeBinding(encryptedKeyCt);
  if (binding.format !== "v2" || binding.scope !== "context_bound") {
    throw new Error("context-bound v2 batch key envelope is required");
  }
  const plaintext = decryptKey16(String(encryptedKeyCt), authenticatedContext);
  try {
    if (plaintext.length !== 16) throw new Error("batch key envelope plaintext length is invalid");
  } finally {
    plaintext.fill(0);
  }
  return binding;
}

export function decryptBatchKeyHex(encryptedKeyCt: string, context: { tenantId?: string | null; bid?: string | null; role?: BatchKeyRole | null; keyVersion?: number | null } = {}) {
  return decryptKey16(String(encryptedKeyCt), context).toString("hex").toUpperCase();
}

export function buildBatchKeyLifecycleRecords(input: {
  tenantId: string;
  bid: string;
  kMetaHex: string;
  kFileHex: string;
  keyVersion?: number | null;
  createdBy?: string | null;
}): BatchKeyLifecycleRecord[] {
  const tenantId = String(input.tenantId || "").trim();
  const bid = String(input.bid || "").trim();
  if (!tenantId) throw new Error("tenantId is required");
  if (!bid) throw new Error("bid is required");
  const keyVersion = normalizeKeyVersion(input.keyVersion);
  const createdBy = String(input.createdBy || "").trim() || null;
  const keys: Array<{ role: BatchKeyRole; hex: string }> = [
    { role: "K_META_BATCH", hex: input.kMetaHex },
    { role: "K_FILE_BATCH", hex: input.kFileHex },
  ];
  return keys.map(({ role, hex }) => ({
    bid,
    keyRole: role,
    keyVersion,
    encryptedKeyCt: encryptBatchKeyHex(hex, { tenantId, bid, role, keyVersion }),
    keyFingerprint: fingerprintBatchKey(hex, role),
    status: "active",
    createdBy,
  }));
}

export function redactSecretsDeep<T>(input: T, seen = new WeakSet<object>()): T {
  if (input == null) return input;
  if (typeof input === "string") {
    return redactUrlString(redactSecretAssignments(input)) as T;
  }
  if (typeof input !== "object") return input;
  if (seen.has(input as object)) return "[Circular]" as T;
  seen.add(input as object);

  if (Array.isArray(input)) {
    return input.map((item) => redactSecretsDeep(item, seen)) as T;
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    redacted[key] = isSensitiveKey(key) ? REDACTED : redactSecretsDeep(value, seen);
  }
  return redacted as T;
}

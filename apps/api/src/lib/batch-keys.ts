import { createHash, randomBytes } from "node:crypto";
import { decryptKey16, encryptKey16 } from "./keys.ts";

export const BATCH_KEY_ROLES = ["K_META_BATCH", "K_FILE_BATCH"] as const;
export type BatchKeyRole = (typeof BATCH_KEY_ROLES)[number];

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

export function encryptBatchKeyHex(keyHex: string, context: { tenantId?: string | null; bid?: string | null; role?: BatchKeyRole | null; keyVersion?: number | null } = {}) {
  return encryptKey16(Buffer.from(assertBatchKeyHex32(keyHex), "hex"), context);
}

export function decryptBatchKeyHex(encryptedKeyCt: string, context: { tenantId?: string | null; bid?: string | null; role?: BatchKeyRole | null; keyVersion?: number | null } = {}) {
  return decryptKey16(String(encryptedKeyCt), context).toString("hex").toUpperCase();
}

export function buildBatchKeyLifecycleRecords(input: {
  tenantId?: string | null;
  bid: string;
  kMetaHex: string;
  kFileHex: string;
  keyVersion?: number | null;
  createdBy?: string | null;
}): BatchKeyLifecycleRecord[] {
  const bid = String(input.bid || "").trim();
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
    encryptedKeyCt: encryptBatchKeyHex(hex, { tenantId: input.tenantId, bid, role, keyVersion }),
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

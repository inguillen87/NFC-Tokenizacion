import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const NONCE_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const KEY_BYTES = 32;
const ENVELOPE_PREFIX = "nexid:whsec:v1:";
const AAD_DOMAIN = "nexid:webhook-signing-secret:v1";

export const WEBHOOK_SIGNING_SECRET_ENVELOPE_PREFIX = ENVELOPE_PREFIX;

export type WebhookSecretCipherErrorCode =
  | "webhook_signing_master_key_required"
  | "webhook_signing_master_key_invalid"
  | "webhook_signing_secret_context_invalid"
  | "webhook_signing_secret_ciphertext_invalid"
  | "webhook_signing_legacy_plaintext_disabled";

export class WebhookSecretCipherError extends Error {
  readonly code: WebhookSecretCipherErrorCode;

  constructor(code: WebhookSecretCipherErrorCode) {
    super(code);
    this.name = "WebhookSecretCipherError";
    this.code = code;
  }
}

type WebhookSecretCipherOptions = {
  masterKeyHex?: string;
  production?: boolean;
  allowLegacyPlaintext?: boolean;
};

function productionRuntime(options: WebhookSecretCipherOptions) {
  return options.production
    ?? (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production");
}

function masterKey(options: WebhookSecretCipherOptions) {
  const value = options.masterKeyHex ?? String(process.env.WEBHOOK_SIGNING_MASTER_KEY_HEX || "").trim();
  if (!value) throw new WebhookSecretCipherError("webhook_signing_master_key_required");
  if (!/^[0-9a-f]{64}$/i.test(value)) {
    throw new WebhookSecretCipherError("webhook_signing_master_key_invalid");
  }
  const key = Buffer.from(value, "hex");
  if (key.byteLength !== KEY_BYTES) {
    throw new WebhookSecretCipherError("webhook_signing_master_key_invalid");
  }
  return key;
}

function normalizedTenantId(tenantId: string) {
  const value = String(tenantId || "").trim().toLowerCase();
  if (!value || value.includes("\u0000")) {
    throw new WebhookSecretCipherError("webhook_signing_secret_context_invalid");
  }
  return value;
}

function additionalAuthenticatedData(tenantId: string) {
  return Buffer.from(`${AAD_DOMAIN}\u0000tenant:${normalizedTenantId(tenantId)}`, "utf8");
}

function encodeEnvelope(bytes: Buffer) {
  return `${ENVELOPE_PREFIX}${bytes.toString("base64url")}`;
}

function decodeEnvelope(value: string) {
  const encoded = value.slice(ENVELOPE_PREFIX.length);
  if (!encoded || !/^[A-Za-z0-9_-]+$/.test(encoded)) {
    throw new WebhookSecretCipherError("webhook_signing_secret_ciphertext_invalid");
  }
  const decoded = Buffer.from(encoded, "base64url");
  if (decoded.toString("base64url") !== encoded || decoded.byteLength <= NONCE_BYTES + AUTH_TAG_BYTES) {
    throw new WebhookSecretCipherError("webhook_signing_secret_ciphertext_invalid");
  }
  return decoded;
}

function legacyPlaintextAllowed(options: WebhookSecretCipherOptions) {
  if (typeof options.allowLegacyPlaintext === "boolean") return options.allowLegacyPlaintext;
  const configured = String(process.env.WEBHOOK_SIGNING_ALLOW_LEGACY_PLAINTEXT || "").trim().toLowerCase();
  if (configured === "true") return true;
  if (configured === "false") return false;
  return !productionRuntime(options);
}

export function isEncryptedWebhookSigningSecret(value: string | null | undefined) {
  return String(value || "").startsWith(ENVELOPE_PREFIX);
}

export function assertWebhookSigningMasterKeyConfigured(options: WebhookSecretCipherOptions = {}) {
  masterKey(options);
}

/**
 * Encrypts a tenant webhook signing secret with a dedicated application-layer
 * key. The random 96-bit nonce is stored beside the GCM tag and ciphertext;
 * the tenant identifier is authenticated as domain-separated AAD.
 */
export function encryptWebhookSigningSecret(
  plaintext: string,
  input: { tenantId: string },
  options: WebhookSecretCipherOptions = {},
) {
  const value = String(plaintext ?? "");
  if (!value) throw new WebhookSecretCipherError("webhook_signing_secret_ciphertext_invalid");
  const key = masterKey(options);
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, nonce, { authTagLength: AUTH_TAG_BYTES });
  cipher.setAAD(additionalAuthenticatedData(input.tenantId));
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return encodeEnvelope(Buffer.concat([nonce, tag, ciphertext]));
}

/**
 * Reads v1 envelopes and, during a bounded migration window, legacy plaintext.
 * Production requires a valid master key even for a legacy read and defaults
 * to rejecting plaintext unless WEBHOOK_SIGNING_ALLOW_LEGACY_PLAINTEXT=true.
 */
export function decryptWebhookSigningSecret(
  storedValue: string | null | undefined,
  input: { tenantId: string },
  options: WebhookSecretCipherOptions = {},
) {
  const value = String(storedValue || "");
  if (!value) return "";

  if (!isEncryptedWebhookSigningSecret(value)) {
    if (productionRuntime(options)) masterKey(options);
    if (!legacyPlaintextAllowed(options)) {
      throw new WebhookSecretCipherError("webhook_signing_legacy_plaintext_disabled");
    }
    return value;
  }

  const key = masterKey(options);
  const envelope = decodeEnvelope(value);
  const nonce = envelope.subarray(0, NONCE_BYTES);
  const tag = envelope.subarray(NONCE_BYTES, NONCE_BYTES + AUTH_TAG_BYTES);
  const ciphertext = envelope.subarray(NONCE_BYTES + AUTH_TAG_BYTES);
  try {
    const decipher = createDecipheriv(ALGORITHM, key, nonce, { authTagLength: AUTH_TAG_BYTES });
    decipher.setAAD(additionalAuthenticatedData(input.tenantId));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    throw new WebhookSecretCipherError("webhook_signing_secret_ciphertext_invalid");
  }
}

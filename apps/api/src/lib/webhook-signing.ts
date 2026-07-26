import { createHmac } from "node:crypto";

export const WEBHOOK_SIGNATURE_VERSION_V1 = "v1" as const;
export const WEBHOOK_SIGNATURE_VERSION_V2 = "v2" as const;
export const WEBHOOK_SIGNATURE_VERSIONS = [WEBHOOK_SIGNATURE_VERSION_V1, WEBHOOK_SIGNATURE_VERSION_V2] as const;
export type WebhookSignatureVersion = typeof WEBHOOK_SIGNATURE_VERSIONS[number];
// Backwards-compatible alias for code that explicitly implements the legacy
// envelope. New endpoints use v2 through createWebhookSignatureHeaders.
export const WEBHOOK_SIGNATURE_VERSION = WEBHOOK_SIGNATURE_VERSION_V1;
export const WEBHOOK_SIGNING_SECRET_MIN_BYTES = 32;

export const WEBHOOK_SIGNATURE_HEADERS = {
  version: "x-nexid-signature-version",
  timestamp: "x-nexid-timestamp",
  keyId: "x-nexid-key-id",
  deliveryId: "x-nexid-delivery-id",
  eventId: "x-nexid-event-id",
  signature: "x-nexid-signature",
} as const;

export type WebhookSigningSecretIssue =
  | "webhook_signing_secret_required"
  | "webhook_signing_secret_too_short";

export class WebhookSigningError extends Error {
  readonly code: WebhookSigningSecretIssue | "invalid_webhook_signature_input";

  constructor(code: WebhookSigningError["code"]) {
    super(code);
    this.name = "WebhookSigningError";
    this.code = code;
  }
}

export function normalizeWebhookSignatureVersion(value: unknown): WebhookSignatureVersion | null {
  const candidate = String(value || "").trim().toLowerCase();
  return candidate === WEBHOOK_SIGNATURE_VERSION_V1 || candidate === WEBHOOK_SIGNATURE_VERSION_V2
    ? candidate
    : null;
}

export function webhookSigningSecretIssue(
  secret: string | null | undefined,
  options: { required: boolean },
): WebhookSigningSecretIssue | null {
  const value = String(secret || "");
  if (!value) return options.required ? "webhook_signing_secret_required" : null;
  return Buffer.byteLength(value, "utf8") >= WEBHOOK_SIGNING_SECRET_MIN_BYTES
    ? null
    : "webhook_signing_secret_too_short";
}

function safeHeaderIdentifier(value: unknown) {
  const normalized = String(value || "").trim();
  if (!normalized || /[\r\n]/.test(normalized)) {
    throw new WebhookSigningError("invalid_webhook_signature_input");
  }
  return normalized;
}

function normalizedTimestamp(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new WebhookSigningError("invalid_webhook_signature_input");
  }
  return String(value);
}

/**
 * Versioned webhook signature envelope.
 *
 * Canonical bytes (identifiers and body are UTF-8 byte-length framed):
 *   v1.<unix-seconds>.<delivery-bytes>.<delivery-id>.<event-bytes>.<event-id>.<body-bytes>.<exact raw request body>
 *
 * The raw body is deliberately last so it is never parsed or re-serialized.
 */
export function createWebhookSignatureV1(input: {
  secret: string;
  timestamp: number;
  deliveryId: string;
  eventId: string;
  rawBody: string | Uint8Array;
}) {
  const secretIssue = webhookSigningSecretIssue(input.secret, { required: true });
  if (secretIssue) throw new WebhookSigningError(secretIssue);
  const timestamp = normalizedTimestamp(input.timestamp);
  const deliveryId = safeHeaderIdentifier(input.deliveryId);
  const eventId = safeHeaderIdentifier(input.eventId);
  const rawBodyBytes = typeof input.rawBody === "string"
    ? Buffer.byteLength(input.rawBody, "utf8")
    : input.rawBody.byteLength;
  const prefix = [
    WEBHOOK_SIGNATURE_VERSION_V1,
    timestamp,
    Buffer.byteLength(deliveryId, "utf8"),
    deliveryId,
    Buffer.byteLength(eventId, "utf8"),
    eventId,
    rawBodyBytes,
    "",
  ].join(".");
  const digest = createHmac("sha256", input.secret)
    .update(prefix, "utf8")
    .update(input.rawBody)
    .digest("hex");
  return `${WEBHOOK_SIGNATURE_VERSION_V1}=${digest}`;
}

/**
 * v2 authenticates the routing key as part of the byte-framed envelope:
 *   v2.<unix-seconds>.<key-bytes>.<key-id>.<delivery-bytes>.<delivery-id>.<event-bytes>.<event-id>.<body-bytes>.<raw body>
 */
export function createWebhookSignatureV2(input: {
  secret: string;
  timestamp: number;
  keyId: string;
  deliveryId: string;
  eventId: string;
  rawBody: string | Uint8Array;
}) {
  const secretIssue = webhookSigningSecretIssue(input.secret, { required: true });
  if (secretIssue) throw new WebhookSigningError(secretIssue);
  const timestamp = normalizedTimestamp(input.timestamp);
  const keyId = safeHeaderIdentifier(input.keyId);
  const deliveryId = safeHeaderIdentifier(input.deliveryId);
  const eventId = safeHeaderIdentifier(input.eventId);
  const rawBodyBytes = typeof input.rawBody === "string"
    ? Buffer.byteLength(input.rawBody, "utf8")
    : input.rawBody.byteLength;
  const prefix = [
    WEBHOOK_SIGNATURE_VERSION_V2,
    timestamp,
    Buffer.byteLength(keyId, "utf8"),
    keyId,
    Buffer.byteLength(deliveryId, "utf8"),
    deliveryId,
    Buffer.byteLength(eventId, "utf8"),
    eventId,
    rawBodyBytes,
    "",
  ].join(".");
  const digest = createHmac("sha256", input.secret)
    .update(prefix, "utf8")
    .update(input.rawBody)
    .digest("hex");
  return `${WEBHOOK_SIGNATURE_VERSION_V2}=${digest}`;
}

export function createWebhookSignatureHeaders(input: {
  secret: string;
  keyId: string;
  deliveryId: string;
  eventId: string;
  rawBody: string | Uint8Array;
  timestamp?: number;
  version?: WebhookSignatureVersion;
}) {
  const timestamp = input.timestamp ?? Math.floor(Date.now() / 1_000);
  const timestampHeader = normalizedTimestamp(timestamp);
  const keyId = safeHeaderIdentifier(input.keyId);
  const deliveryId = safeHeaderIdentifier(input.deliveryId);
  const eventId = safeHeaderIdentifier(input.eventId);
  const version = normalizeWebhookSignatureVersion(input.version || WEBHOOK_SIGNATURE_VERSION_V2);
  if (!version) throw new WebhookSigningError("invalid_webhook_signature_input");
  const signature = version === WEBHOOK_SIGNATURE_VERSION_V2
    ? createWebhookSignatureV2({
      secret: input.secret,
      timestamp,
      keyId,
      deliveryId,
      eventId,
      rawBody: input.rawBody,
    })
    : createWebhookSignatureV1({
      secret: input.secret,
      timestamp,
      deliveryId,
      eventId,
      rawBody: input.rawBody,
    });
  return {
    [WEBHOOK_SIGNATURE_HEADERS.version]: version,
    [WEBHOOK_SIGNATURE_HEADERS.timestamp]: timestampHeader,
    [WEBHOOK_SIGNATURE_HEADERS.keyId]: keyId,
    [WEBHOOK_SIGNATURE_HEADERS.deliveryId]: deliveryId,
    [WEBHOOK_SIGNATURE_HEADERS.eventId]: eventId,
    [WEBHOOK_SIGNATURE_HEADERS.signature]: signature,
  };
}

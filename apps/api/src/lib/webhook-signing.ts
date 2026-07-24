import { createHmac } from "node:crypto";

export const WEBHOOK_SIGNATURE_VERSION = "v1" as const;
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
    WEBHOOK_SIGNATURE_VERSION,
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
  return `${WEBHOOK_SIGNATURE_VERSION}=${digest}`;
}

export function createWebhookSignatureHeaders(input: {
  secret: string;
  keyId: string;
  deliveryId: string;
  eventId: string;
  rawBody: string | Uint8Array;
  timestamp?: number;
}) {
  const timestamp = input.timestamp ?? Math.floor(Date.now() / 1_000);
  const timestampHeader = normalizedTimestamp(timestamp);
  const keyId = safeHeaderIdentifier(input.keyId);
  const deliveryId = safeHeaderIdentifier(input.deliveryId);
  const eventId = safeHeaderIdentifier(input.eventId);
  return {
    [WEBHOOK_SIGNATURE_HEADERS.version]: WEBHOOK_SIGNATURE_VERSION,
    [WEBHOOK_SIGNATURE_HEADERS.timestamp]: timestampHeader,
    [WEBHOOK_SIGNATURE_HEADERS.keyId]: keyId,
    [WEBHOOK_SIGNATURE_HEADERS.deliveryId]: deliveryId,
    [WEBHOOK_SIGNATURE_HEADERS.eventId]: eventId,
    [WEBHOOK_SIGNATURE_HEADERS.signature]: createWebhookSignatureV1({
      secret: input.secret,
      timestamp,
      deliveryId,
      eventId,
      rawBody: input.rawBody,
    }),
  };
}

import { createHmac, timingSafeEqual } from "node:crypto";

export const NEXID_WEBHOOK_SIGNATURE_VERSION = "v1" as const;
export const NEXID_WEBHOOK_SIGNATURE_HEADERS = {
  version: "x-nexid-signature-version",
  timestamp: "x-nexid-timestamp",
  keyId: "x-nexid-key-id",
  deliveryId: "x-nexid-delivery-id",
  eventId: "x-nexid-event-id",
  signature: "x-nexid-signature",
} as const;

export type NexIdWebhookHeaders = Headers | Record<string, string | string[] | undefined>;
export type NexIdWebhookVerificationResult =
  | {
      ok: true;
      version: typeof NEXID_WEBHOOK_SIGNATURE_VERSION;
      timestamp: number;
      keyId: string;
      deliveryId: string;
      eventId: string;
    }
  | {
      ok: false;
      reason:
        | "invalid_secret"
        | "missing_header"
        | "unsupported_version"
        | "invalid_timestamp"
        | "timestamp_out_of_tolerance"
        | "invalid_signature_format"
        | "signature_mismatch";
    };

function webhookHeader(headers: NexIdWebhookHeaders, name: string) {
  if (typeof (headers as Headers).get === "function") {
    return (headers as Headers).get(name)?.trim() || "";
  }
  const record = headers as Record<string, string | string[] | undefined>;
  const entry = Object.entries(record).find(([key]) => key.toLowerCase() === name);
  const value = entry?.[1];
  return (Array.isArray(value) ? value[0] : value || "").trim();
}

/**
 * Verifies a nexID webhook against the exact, unparsed HTTP request body.
 * Parse JSON only after this function returns `{ ok: true }`.
 */
export function verifyNexIdWebhookSignature(input: {
  secret: string;
  rawBody: string | Uint8Array;
  headers: NexIdWebhookHeaders;
  toleranceSeconds?: number;
  now?: number | Date;
}): NexIdWebhookVerificationResult {
  if (Buffer.byteLength(String(input.secret || ""), "utf8") < 32) {
    return { ok: false, reason: "invalid_secret" };
  }

  const version = webhookHeader(input.headers, NEXID_WEBHOOK_SIGNATURE_HEADERS.version);
  const timestampHeader = webhookHeader(input.headers, NEXID_WEBHOOK_SIGNATURE_HEADERS.timestamp);
  const keyId = webhookHeader(input.headers, NEXID_WEBHOOK_SIGNATURE_HEADERS.keyId);
  const deliveryId = webhookHeader(input.headers, NEXID_WEBHOOK_SIGNATURE_HEADERS.deliveryId);
  const eventId = webhookHeader(input.headers, NEXID_WEBHOOK_SIGNATURE_HEADERS.eventId);
  const signatureHeader = webhookHeader(input.headers, NEXID_WEBHOOK_SIGNATURE_HEADERS.signature);
  if (!version || !timestampHeader || !keyId || !deliveryId || !eventId || !signatureHeader) {
    return { ok: false, reason: "missing_header" };
  }
  if (version !== NEXID_WEBHOOK_SIGNATURE_VERSION) {
    return { ok: false, reason: "unsupported_version" };
  }
  if (!/^\d{1,12}$/.test(timestampHeader)) {
    return { ok: false, reason: "invalid_timestamp" };
  }
  const timestamp = Number(timestampHeader);
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0) {
    return { ok: false, reason: "invalid_timestamp" };
  }
  const requestedTolerance = Number(input.toleranceSeconds ?? 300);
  const toleranceSeconds = Number.isFinite(requestedTolerance)
    ? Math.min(Math.max(Math.floor(requestedTolerance), 0), 86_400)
    : 300;
  const nowValue = input.now instanceof Date ? input.now.getTime() / 1_000 : input.now ?? Date.now() / 1_000;
  const nowSeconds = Math.floor(nowValue);
  if (!Number.isFinite(nowSeconds) || Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    return { ok: false, reason: "timestamp_out_of_tolerance" };
  }
  const match = /^v1=([a-f0-9]{64})$/.exec(signatureHeader);
  if (!match) return { ok: false, reason: "invalid_signature_format" };

  const rawBodyBytes = typeof input.rawBody === "string"
    ? Buffer.byteLength(input.rawBody, "utf8")
    : input.rawBody.byteLength;
  const prefix = [
    NEXID_WEBHOOK_SIGNATURE_VERSION,
    timestampHeader,
    Buffer.byteLength(deliveryId, "utf8"),
    deliveryId,
    Buffer.byteLength(eventId, "utf8"),
    eventId,
    rawBodyBytes,
    "",
  ].join(".");
  const expected = createHmac("sha256", input.secret)
    .update(prefix, "utf8")
    .update(input.rawBody)
    .digest();
  const received = Buffer.from(match[1], "hex");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return { ok: false, reason: "signature_mismatch" };
  }
  return { ok: true, version: NEXID_WEBHOOK_SIGNATURE_VERSION, timestamp, keyId, deliveryId, eventId };
}

/** Short alias for frameworks that expose a generic webhook verification hook. */
export const verifyWebhookSignature = verifyNexIdWebhookSignature;

export type NexIdEnvironment = "production" | "private";

export interface NexIdConfig {
  apiKey: string;
  tenantSlug: string;
  environment?: NexIdEnvironment;
  apiBaseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface VerifyTapRequest {
  bid: string;
  picc_data: string;
  enc: string;
  cmac: string;
  gps?: {
    lat: number;
    lng: number;
    accuracy?: number;
    city?: string;
    country?: string;
  };
  deviceMeta?: {
    userAgent?: string;
    language?: string;
    mobile?: boolean;
    label?: string;
  };
}

export interface VerifyTapResponse {
  ok: boolean;
  verdict: "VALID" | "REPLAY_SUSPECT" | "TAMPER_RISK" | "INVALID" | "UNKNOWN_BATCH";
  uidMasked: string | null;
  readCounter: number | null;
  sealStatus: "CLOSED" | "OPENED" | "UNKNOWN";
  eventId: string | null;
  tenant?: { slug: string; name?: string };
  bid?: string;
  result?: string;
  reason?: string | null;
  traceId?: string;
}

export interface ClaimOwnershipRequest {
  contact: string;
  name?: string;
  bid: string;
  uidHex?: string;
  pin?: string;
  posToken?: string;
  meta?: Record<string, unknown>;
  gps?: Record<string, unknown>;
  device?: Record<string, unknown>;
}

export interface ClaimOwnershipResponse {
  ok: boolean;
  claimId: string;
  leadId?: string;
  status: "claimed" | "pending_verification" | "failed";
  tokenId?: string | null;
  txHash?: string | null;
  policy?: Record<string, unknown>;
  traceId?: string;
}

export interface SdkProductResponse {
  ok: boolean;
  tenant: { slug: string; name?: string };
  batch: Record<string, unknown>;
  carrier: Record<string, unknown>;
  product: Record<string, unknown>;
  stats: Record<string, number>;
  tags: Array<Record<string, unknown>>;
  traceId?: string;
}

export interface ExternalEventRequest {
  eventType: string;
  bid?: string;
  uidHex?: string;
  source?: string;
  occurredAt?: string;
  data?: Record<string, unknown>;
  meta?: Record<string, unknown>;
  gps?: Record<string, unknown>;
  device?: Record<string, unknown>;
}

export interface ExternalEventResponse {
  ok: boolean;
  eventId: string;
  eventType: string;
  tenant?: { slug: string; name?: string };
  bid?: string | null;
  uidMasked?: string | null;
  traceId?: string;
}

export interface PosActivationRequest {
  bid: string;
  uidHex?: string;
  externalOrderId?: string;
  retailerId?: string;
  contact?: string;
  pin?: string;
  expiresInMinutes?: number;
  meta?: Record<string, unknown>;
  gps?: Record<string, unknown>;
  device?: Record<string, unknown>;
}

export interface PosActivationResponse {
  ok: boolean;
  activationId: string;
  tenant?: { slug: string; name?: string };
  bid: string;
  uidMasked?: string | null;
  posToken: string;
  expiresAt: string;
  policy?: Record<string, unknown>;
  traceId?: string;
}

export interface LogisticsSealApplyRequest {
  uidHex: string;
  shipmentId: string;
  ttRaw?: string;
  location?: string;
  scannedBy?: string;
}

export interface LogisticsHandoffRequest {
  uidHex: string;
  shipmentId?: string;
  ttRaw?: string;
  location?: string;
  scannedBy?: string;
}

export interface LogisticsRecipientVerifyRequest {
  uidHex: string;
  shipmentId?: string;
  ttRaw?: string;
  location?: string;
  recipientName?: string;
  verificationMethod?: string;
}

export interface LogisticsScanResponse {
  ok: boolean;
  tenant?: { slug: string; name?: string };
  trace_id?: string;
  data: {
    sealId: string;
    previousStatus: string;
    newStatus: string;
    shipmentId: string | null;
    tamperState: "closed" | "opened" | "unknown";
  };
}

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
};

export class NexIdClient {
  private apiKey: string;
  private tenantSlug: string;
  private apiBaseUrl: string;
  private fetchImpl: typeof fetch;

  constructor(config: NexIdConfig) {
    const browserRuntime = typeof globalThis === "object"
      && "window" in globalThis
      && "document" in globalThis;
    if (browserRuntime) {
      throw new Error("nexID server SDK cannot run in a browser. Keep NEXID_API_KEY in your backend or BFF.");
    }
    if (!config.apiKey) throw new Error("nexID SDK requires apiKey");
    if (!config.tenantSlug) throw new Error("nexID SDK requires tenantSlug");
    const environment = String(config.environment || "production");
    if (!["production", "private"].includes(environment)) {
      throw new Error("nexID SDK has no public sandbox endpoint. Use apiBaseUrl only for an approved local or private environment.");
    }
    if (environment === "private" && !config.apiBaseUrl) {
      throw new Error("nexID private environment requires apiBaseUrl");
    }
    this.apiKey = config.apiKey;
    this.tenantSlug = config.tenantSlug;
    this.apiBaseUrl = (config.apiBaseUrl || "https://api.nexid.lat").replace(/\/$/, "");
    this.fetchImpl = config.fetchImpl || fetch;
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const response = await this.fetchImpl(`${this.apiBaseUrl}${endpoint}`, {
      method: options.method || (options.body === undefined ? "GET" : "POST"),
      headers: {
        "Content-Type": "application/json",
        "x-nexid-api-key": this.apiKey,
        "x-nexid-tenant-slug": this.tenantSlug,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!response.ok) {
      const errorData = data && typeof data === "object" ? data as Record<string, unknown> : {};
      throw new Error(String(errorData.reason || errorData.error || `nexID SDK error: ${response.status}`));
    }
    return data as T;
  }

  verifyTap(params: VerifyTapRequest): Promise<VerifyTapResponse> {
    return this.request<VerifyTapResponse>("/api/v1/sdk/verify", { method: "POST", body: params });
  }

  claimOwnership(params: ClaimOwnershipRequest): Promise<ClaimOwnershipResponse> {
    return this.request<ClaimOwnershipResponse>("/api/v1/sdk/claim", { method: "POST", body: params });
  }

  getProduct(bid: string): Promise<SdkProductResponse> {
    return this.request<SdkProductResponse>(`/api/v1/sdk/products/${encodeURIComponent(bid)}`, { method: "GET" });
  }

  reportEvent(params: ExternalEventRequest): Promise<ExternalEventResponse> {
    return this.request<ExternalEventResponse>("/api/v1/sdk/events", { method: "POST", body: params });
  }

  activatePosPurchase(params: PosActivationRequest): Promise<PosActivationResponse> {
    return this.request<PosActivationResponse>("/api/v1/sdk/pos/activate", { method: "POST", body: params });
  }

  applyDeliverySeal(params: LogisticsSealApplyRequest): Promise<LogisticsScanResponse> {
    return this.request<LogisticsScanResponse>("/api/v1/logistics/seal-apply", { method: "POST", body: params });
  }

  handoffDeliverySeal(params: LogisticsHandoffRequest): Promise<LogisticsScanResponse> {
    return this.request<LogisticsScanResponse>("/api/v1/logistics/handoff", { method: "POST", body: params });
  }

  verifyDeliverySeal(params: LogisticsRecipientVerifyRequest): Promise<LogisticsScanResponse> {
    return this.request<LogisticsScanResponse>("/api/v1/logistics/recipient-verify", { method: "POST", body: params });
  }
}

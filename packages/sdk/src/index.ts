export type NexIdEnvironment = "sandbox" | "production";

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
    if (!config.apiKey) throw new Error("nexID SDK requires apiKey");
    if (!config.tenantSlug) throw new Error("nexID SDK requires tenantSlug");
    this.apiKey = config.apiKey;
    this.tenantSlug = config.tenantSlug;
    this.apiBaseUrl = (config.apiBaseUrl
      || (config.environment === "production" ? "https://api.nexid.lat" : "https://sandbox.api.nexid.lat")).replace(/\/$/, "");
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
}

export declare const NEXID_SDK_VERSION: "0.2.0";
export declare const NEXID_SDK_USER_AGENT: "@product/nexid-server-sdk/0.2.0";
export declare const NEXID_WEBHOOK_SIGNATURE_VERSION_V1: "v1";
export declare const NEXID_WEBHOOK_SIGNATURE_VERSION_V2: "v2";
export declare const NEXID_WEBHOOK_SIGNATURE_VERSIONS: readonly ["v1", "v2"];
export type NexIdWebhookSignatureVersion = typeof NEXID_WEBHOOK_SIGNATURE_VERSIONS[number];
/**
 * Backward-compatible alias for legacy v1 integrations. New integrations
 * should inspect the verified result and prefer v2.
 * @deprecated Use `NEXID_WEBHOOK_SIGNATURE_VERSION_V2` for new producers.
 */
export declare const NEXID_WEBHOOK_SIGNATURE_VERSION: "v1";
export declare const NEXID_WEBHOOK_SIGNATURE_HEADERS: {
    readonly version: "x-nexid-signature-version";
    readonly timestamp: "x-nexid-timestamp";
    readonly keyId: "x-nexid-key-id";
    readonly deliveryId: "x-nexid-delivery-id";
    readonly eventId: "x-nexid-event-id";
    readonly signature: "x-nexid-signature";
};
export type NexIdWebhookHeaders = Headers | Record<string, string | string[] | undefined>;
export type NexIdWebhookVerifiedEnvelope<Version extends NexIdWebhookSignatureVersion> = {
    ok: true;
    version: Version;
    timestamp: number;
    keyId: string;
    /** False for legacy v1; true only when v2 cryptographically binds keyId. */
    keyIdAuthenticated: Version extends typeof NEXID_WEBHOOK_SIGNATURE_VERSION_V2 ? true : false;
    deliveryId: string;
    eventId: string;
};
export type NexIdWebhookVerificationResult = NexIdWebhookVerifiedEnvelope<typeof NEXID_WEBHOOK_SIGNATURE_VERSION_V1> | NexIdWebhookVerifiedEnvelope<typeof NEXID_WEBHOOK_SIGNATURE_VERSION_V2> | {
    ok: false;
    reason: "invalid_secret" | "missing_header" | "unsupported_version" | "invalid_timestamp" | "timestamp_out_of_tolerance" | "invalid_signature_format" | "signature_mismatch";
};
/**
 * Verifies a nexID webhook against the exact, unparsed HTTP request body.
 *
 * Legacy v1 authenticates timestamp, deliveryId, eventId and body, but not
 * keyId. Version v2 also authenticates keyId and should be preferred by
 * producers. This verifier accepts both during a controlled migration.
 * Parse JSON only after this function returns `{ ok: true }`.
 */
export declare function verifyNexIdWebhookSignature(input: {
    secret: string;
    rawBody: string | Uint8Array;
    headers: NexIdWebhookHeaders;
    toleranceSeconds?: number;
    now?: number | Date;
}): NexIdWebhookVerificationResult;
/** Short alias for frameworks that expose a generic webhook verification hook. */
export declare const verifyWebhookSignature: typeof verifyNexIdWebhookSignature;
export declare const NEXID_WEBHOOK_EVENT_SCHEMA_VERSION: "1.0";
export declare const NEXID_WEBHOOK_EVENT_TYPES: readonly ["demo.tap.simulated", "epcis.event.captured", "ownership.activated", "provenance.viewed", "sdk.claim.claimed", "sdk.claim.created", "sdk.external_event", "sdk.pos.activated", "sdk.verify", "tokenization.anchored", "tokenization.requested", "tokenization.simulated", "warranty.review_requested"];
export type NexIdWebhookEventType = typeof NEXID_WEBHOOK_EVENT_TYPES[number];
export type NexIdWebhookEventEnvelope<Data extends Record<string, unknown> = Record<string, unknown>> = {
    /** Present on the current contract; omitted only by the supported legacy N-1 envelope. */
    schemaVersion?: typeof NEXID_WEBHOOK_EVENT_SCHEMA_VERSION;
    id: string;
    type: string;
    createdAt: string;
    data: Data;
};
export type NexIdWebhookEnvelopeFailureReason = "webhook_body_too_large" | "invalid_webhook_body_encoding" | "invalid_webhook_json" | "invalid_webhook_envelope" | "unsupported_webhook_schema_version" | "webhook_event_id_mismatch" | "unexpected_webhook_event_type";
export type NexIdWebhookVerificationAndParseResult = {
    ok: true;
    verification: NexIdWebhookVerifiedEnvelope<NexIdWebhookSignatureVersion>;
    event: NexIdWebhookEventEnvelope;
    /** `legacy` is the one supported N-1 envelope and omits schemaVersion. */
    contractVersion: typeof NEXID_WEBHOOK_EVENT_SCHEMA_VERSION | "legacy";
    knownEventType: boolean;
} | {
    ok: false;
    stage: "signature";
    reason: Exclude<NexIdWebhookVerificationResult, {
        ok: true;
    }>["reason"];
} | {
    ok: false;
    stage: "envelope";
    reason: NexIdWebhookEnvelopeFailureReason;
};
/**
 * Verifies the signed bytes and then validates the versioned event envelope.
 *
 * The header event ID must equal the signed body ID. Current v1 events carry
 * schemaVersion `1.0`; the immediately previous unversioned envelope remains
 * readable as `legacy` during migration. Unknown future schema versions fail
 * closed instead of being interpreted with today's semantics.
 */
export declare function verifyAndParseNexIdWebhook(input: {
    secret: string;
    rawBody: string | Uint8Array;
    headers: NexIdWebhookHeaders;
    toleranceSeconds?: number;
    now?: number | Date;
    expectedEventTypes?: readonly string[];
    maxBodyBytes?: number;
}): NexIdWebhookVerificationAndParseResult;
export type NexIdEnvironment = "production" | "private";
export interface NexIdRetryConfig {
    /** Number of retries after the initial read or explicitly idempotent SDK mutation. */
    maxRetries?: number;
    /** Initial exponential backoff delay in milliseconds. */
    baseDelayMs?: number;
    /** Maximum delay for either exponential backoff or Retry-After. */
    maxDelayMs?: number;
}
export interface NexIdRequestContext {
    /** Abort this request when the caller no longer needs the result. */
    signal?: AbortSignal;
    /** Per-request timeout. Set to 0 to disable the SDK timeout. */
    timeoutMs?: number;
    /** Caller-provided correlation id, forwarded to nexID as the trace id. */
    requestId?: string;
}
export interface NexIdReadRequestOptions extends NexIdRequestContext {
    /** Override the configured retry count for this GET request. */
    maxRetries?: number;
}
export interface NexIdMutationRequestOptions extends NexIdRequestContext {
    /**
     * Enables durable tenant + route scoped replay protection on supported SDK v1
     * mutations. Reusing this key with another payload fails with HTTP 409.
     */
    idempotencyKey?: string;
    /**
     * Override retries for a supported mutation. It is ignored unless an
     * idempotencyKey is present; non-idempotent mutations are never retried.
     */
    maxRetries?: number;
}
/** Required for EPCIS capture because the server commits the document atomically. */
export interface NexIdRequiredIdempotencyOptions extends NexIdMutationRequestOptions {
    idempotencyKey: string;
}
export interface NexIdConfig {
    apiKey: string;
    tenantSlug: string;
    environment?: NexIdEnvironment;
    apiBaseUrl?: string;
    fetchImpl?: typeof fetch;
    /** Default per-attempt timeout. Defaults to 15 seconds; set to 0 to disable. */
    timeoutMs?: number;
    /** Bounded retry policy for GET requests. Set to false to disable retries. */
    retry?: false | NexIdRetryConfig;
}
export declare const NEXID_EPCIS_CONTEXT: "https://ref.gs1.org/standards/epcis/epcis-context.jsonld";
export declare const NEXID_EPCIS_VERSION: "2.0";
export declare const NEXID_EPCIS_MEDIA_TYPE: "application/vnd.gs1.epcis+json";
export declare const NEXID_EPCIS_CAPTURE_MAX_BYTES: number;
export declare const NEXID_EPCIS_CAPTURE_MAX_EVENTS = 100;
export declare const NEXID_EPCIS_CAPTURE_MAX_PROJECTIONS = 100;
export type NexIdEpcisEventType = "ObjectEvent" | "AggregationEvent" | "TransactionEvent" | "TransformationEvent" | "AssociationEvent";
/**
 * The SDK intentionally models nexID's bounded EPCIS 2.0 JSON/JSON-LD profile,
 * not every extension in the complete GS1 standard.
 */
export interface NexIdEpcisEvent extends Record<string, unknown> {
    type: NexIdEpcisEventType;
    eventTime: string;
    eventTimeZoneOffset: string;
    eventID?: string;
}
export interface NexIdEpcisDocument extends Record<string, unknown> {
    "@context": typeof NEXID_EPCIS_CONTEXT | readonly [typeof NEXID_EPCIS_CONTEXT];
    type: "EPCISDocument";
    schemaVersion: typeof NEXID_EPCIS_VERSION;
    epcisBody: {
        eventList: NexIdEpcisEvent[];
    };
}
export interface NexIdEpcisQueryDocument extends Record<string, unknown> {
    "@context": typeof NEXID_EPCIS_CONTEXT;
    type: "EPCISQueryDocument";
    schemaVersion: typeof NEXID_EPCIS_VERSION;
    epcisBody: {
        queryResults: {
            queryName: "SimpleEventQuery";
            resultsBody: {
                eventList: NexIdEpcisEvent[];
            };
        };
    };
}
export interface NexIdEpcisCaptureReceipt {
    ok: true;
    captureID: string;
    documentRecordID: string;
    eventCount: number;
    canonicalProjectionCount: number;
    capturedAt: string;
    replayed: boolean;
    evidence: {
        level: "declared_business_event";
        cryptographicNfcAuthentication: false;
    };
    /** Correlation id returned by the API, or the SDK request id as fallback. */
    traceId: string;
}
export interface NexIdEpcisQueryFilters {
    /** Page size. nexID accepts 1..200 and defaults to 50. */
    limit?: number;
    cursor?: string;
    eventType?: NexIdEpcisEventType;
    bizStep?: string;
    disposition?: string;
    gtin?: string;
    lot?: string;
    serial?: string;
    eventTimeFrom?: string | Date;
    eventTimeTo?: string | Date;
}
export interface NexIdEpcisPage<Document> {
    document: Document;
    nextCursor: string | null;
    pageSize: number;
    /** Correlation id returned by the API, or the SDK request id as fallback. */
    traceId: string;
}
export interface NexIdApiErrorOptions {
    status: number;
    reason: string;
    traceId: string | null;
    retryAfter: number | null;
    body?: unknown;
    cause?: unknown;
}
/** A stable, machine-readable error for HTTP, timeout, abort and network failures. */
export declare class NexIdApiError extends Error {
    readonly status: number;
    readonly reason: string;
    readonly traceId: string | null;
    readonly retryAfter: number | null;
    readonly body: unknown;
    constructor(options: NexIdApiErrorOptions);
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
export interface WebhookOutboxReceipt {
    status: "confirmed" | "not_configured";
    eventId: string | null;
    attempted: number;
    confirmed: number;
    queued: number;
    deduplicated: number;
}
export interface VerifyTapResponse {
    ok: boolean;
    verdict: "VALID" | "REPLAY_SUSPECT" | "TAMPER_RISK" | "INVALID" | "UNKNOWN_BATCH";
    uidMasked: string | null;
    readCounter: number | null;
    sealStatus: "CLOSED" | "OPENED" | "UNKNOWN";
    eventId: string | null;
    tenant?: {
        slug: string;
        name?: string;
    };
    bid?: string;
    result?: string;
    reason?: string | null;
    traceId?: string;
    webhookOutbox?: WebhookOutboxReceipt;
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
    webhookOutbox?: WebhookOutboxReceipt[];
}
export interface SdkProductResponse {
    ok: boolean;
    tenant: {
        slug: string;
        name?: string;
    };
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
    tenant?: {
        slug: string;
        name?: string;
    };
    bid?: string | null;
    uidMasked?: string | null;
    traceId?: string;
    webhookOutbox?: WebhookOutboxReceipt;
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
    tenant?: {
        slug: string;
        name?: string;
    };
    bid: string;
    uidMasked?: string | null;
    posToken: string;
    expiresAt: string;
    policy?: Record<string, unknown>;
    traceId?: string;
    webhookOutbox?: WebhookOutboxReceipt;
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
    tenant?: {
        slug: string;
        name?: string;
    };
    trace_id?: string;
    data: {
        sealId: string;
        previousStatus: string;
        newStatus: string;
        shipmentId: string | null;
        tamperState: "closed" | "opened" | "unknown";
    };
}
export type NexIdIdempotencyOperation = "verifyTap" | "claimOwnership" | "reportEvent" | "activatePosPurchase";
export interface NexIdIdempotencyStatus {
    ok: true;
    operation: NexIdIdempotencyOperation;
    route: string;
    state: "processing" | "completed" | "failed" | "uncertain";
    operationCommitted: boolean | null;
    resourceId: string | null;
    traceId: string | null;
    responseStatus: number | null;
    replayAvailable: boolean;
    reconciliationStatus: "not_requested" | "confirmed" | "not_configured" | "failed";
    reconciliationDetails: Record<string, unknown>;
    reconciledAt: string | null;
    reconciled: boolean;
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
    expiresAt: string;
    nextAction: string;
}
export declare class NexIdClient {
    private apiKey;
    private tenantSlug;
    private apiBaseUrl;
    private fetchImpl;
    private timeoutMs;
    private retry;
    constructor(config: NexIdConfig);
    private request;
    verifyTap(params: VerifyTapRequest): Promise<VerifyTapResponse>;
    verifyTap(params: VerifyTapRequest, options: NexIdMutationRequestOptions): Promise<VerifyTapResponse>;
    claimOwnership(params: ClaimOwnershipRequest): Promise<ClaimOwnershipResponse>;
    claimOwnership(params: ClaimOwnershipRequest, options: NexIdMutationRequestOptions): Promise<ClaimOwnershipResponse>;
    getProduct(bid: string): Promise<SdkProductResponse>;
    getProduct(bid: string, options: NexIdReadRequestOptions): Promise<SdkProductResponse>;
    reportEvent(params: ExternalEventRequest): Promise<ExternalEventResponse>;
    reportEvent(params: ExternalEventRequest, options: NexIdMutationRequestOptions): Promise<ExternalEventResponse>;
    activatePosPurchase(params: PosActivationRequest): Promise<PosActivationResponse>;
    activatePosPurchase(params: PosActivationRequest, options: NexIdMutationRequestOptions): Promise<PosActivationResponse>;
    /**
     * Captures one bounded EPCIS 2.0 JSON/JSON-LD document. The idempotency key
     * is mandatory so a transport retry cannot duplicate business events.
     */
    captureEpcisDocument(document: NexIdEpcisDocument, options: NexIdRequiredIdempotencyOptions): Promise<NexIdEpcisCaptureReceipt>;
    /** Returns one cursor page in an EPCISQueryDocument. */
    queryEpcisEvents(filters?: NexIdEpcisQueryFilters, options?: NexIdReadRequestOptions): Promise<NexIdEpcisPage<NexIdEpcisQueryDocument>>;
    /** Returns one cursor page as a portable EPCISDocument export. */
    exportEpcisEvents(filters?: NexIdEpcisQueryFilters, options?: NexIdReadRequestOptions): Promise<NexIdEpcisPage<NexIdEpcisDocument>>;
    getIdempotencyStatus(operation: NexIdIdempotencyOperation, idempotencyKey: string, options?: NexIdReadRequestOptions): Promise<NexIdIdempotencyStatus>;
    reconcileIdempotency(operation: NexIdIdempotencyOperation, idempotencyKey: string, options?: NexIdRequestContext): Promise<NexIdIdempotencyStatus>;
    applyDeliverySeal(params: LogisticsSealApplyRequest): Promise<LogisticsScanResponse>;
    applyDeliverySeal(params: LogisticsSealApplyRequest, options: NexIdMutationRequestOptions): Promise<LogisticsScanResponse>;
    handoffDeliverySeal(params: LogisticsHandoffRequest): Promise<LogisticsScanResponse>;
    handoffDeliverySeal(params: LogisticsHandoffRequest, options: NexIdMutationRequestOptions): Promise<LogisticsScanResponse>;
    verifyDeliverySeal(params: LogisticsRecipientVerifyRequest): Promise<LogisticsScanResponse>;
    verifyDeliverySeal(params: LogisticsRecipientVerifyRequest, options: NexIdMutationRequestOptions): Promise<LogisticsScanResponse>;
}
//# sourceMappingURL=index.d.ts.map
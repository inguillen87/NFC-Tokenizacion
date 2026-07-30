import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
export const NEXID_SDK_VERSION = "0.2.0";
export const NEXID_SDK_USER_AGENT = `@product/nexid-server-sdk/${NEXID_SDK_VERSION}`;
export const NEXID_WEBHOOK_SIGNATURE_VERSION_V1 = "v1";
export const NEXID_WEBHOOK_SIGNATURE_VERSION_V2 = "v2";
export const NEXID_WEBHOOK_SIGNATURE_VERSIONS = [
    NEXID_WEBHOOK_SIGNATURE_VERSION_V1,
    NEXID_WEBHOOK_SIGNATURE_VERSION_V2,
];
/**
 * Backward-compatible alias for legacy v1 integrations. New integrations
 * should inspect the verified result and prefer v2.
 * @deprecated Use `NEXID_WEBHOOK_SIGNATURE_VERSION_V2` for new producers.
 */
export const NEXID_WEBHOOK_SIGNATURE_VERSION = NEXID_WEBHOOK_SIGNATURE_VERSION_V1;
export const NEXID_WEBHOOK_SIGNATURE_HEADERS = {
    version: "x-nexid-signature-version",
    timestamp: "x-nexid-timestamp",
    keyId: "x-nexid-key-id",
    deliveryId: "x-nexid-delivery-id",
    eventId: "x-nexid-event-id",
    signature: "x-nexid-signature",
};
function webhookHeader(headers, name) {
    if (typeof headers.get === "function") {
        return headers.get(name)?.trim() || "";
    }
    const record = headers;
    const entry = Object.entries(record).find(([key]) => key.toLowerCase() === name);
    const value = entry?.[1];
    return (Array.isArray(value) ? value[0] : value || "").trim();
}
function webhookCanonicalPrefix(input) {
    const identityFields = input.version === NEXID_WEBHOOK_SIGNATURE_VERSION_V2
        ? [Buffer.byteLength(input.keyId, "utf8"), input.keyId]
        : [];
    return [
        input.version,
        input.timestamp,
        ...identityFields,
        Buffer.byteLength(input.deliveryId, "utf8"),
        input.deliveryId,
        Buffer.byteLength(input.eventId, "utf8"),
        input.eventId,
        input.rawBodyBytes,
        "",
    ].join(".");
}
/**
 * Verifies a nexID webhook against the exact, unparsed HTTP request body.
 *
 * Legacy v1 authenticates timestamp, deliveryId, eventId and body, but not
 * keyId. Version v2 also authenticates keyId and should be preferred by
 * producers. This verifier accepts both during a controlled migration.
 * Parse JSON only after this function returns `{ ok: true }`.
 */
export function verifyNexIdWebhookSignature(input) {
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
    if (version !== NEXID_WEBHOOK_SIGNATURE_VERSION_V1 && version !== NEXID_WEBHOOK_SIGNATURE_VERSION_V2) {
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
    const match = version === NEXID_WEBHOOK_SIGNATURE_VERSION_V2
        ? /^v2=([a-f0-9]{64})$/.exec(signatureHeader)
        : /^v1=([a-f0-9]{64})$/.exec(signatureHeader);
    if (!match)
        return { ok: false, reason: "invalid_signature_format" };
    const rawBodyBytes = typeof input.rawBody === "string"
        ? Buffer.byteLength(input.rawBody, "utf8")
        : input.rawBody.byteLength;
    const prefix = webhookCanonicalPrefix({
        version,
        timestamp: timestampHeader,
        keyId,
        deliveryId,
        eventId,
        rawBodyBytes,
    });
    const expected = createHmac("sha256", input.secret)
        .update(prefix, "utf8")
        .update(input.rawBody)
        .digest();
    const received = Buffer.from(match[1], "hex");
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
        return { ok: false, reason: "signature_mismatch" };
    }
    const verified = {
        ok: true,
        timestamp,
        keyId,
        deliveryId,
        eventId,
    };
    return version === NEXID_WEBHOOK_SIGNATURE_VERSION_V2
        ? { ...verified, version, keyIdAuthenticated: true }
        : { ...verified, version, keyIdAuthenticated: false };
}
/** Short alias for frameworks that expose a generic webhook verification hook. */
export const verifyWebhookSignature = verifyNexIdWebhookSignature;
export const NEXID_WEBHOOK_EVENT_SCHEMA_VERSION = "1.0";
export const NEXID_WEBHOOK_EVENT_TYPES = [
    "demo.tap.simulated",
    "epcis.event.captured",
    "ownership.activated",
    "provenance.viewed",
    "sdk.claim.claimed",
    "sdk.claim.created",
    "sdk.external_event",
    "sdk.pos.activated",
    "sdk.verify",
    "tokenization.anchored",
    "tokenization.requested",
    "tokenization.simulated",
    "warranty.review_requested",
];
const NEXID_WEBHOOK_EVENT_TYPE_SET = new Set(NEXID_WEBHOOK_EVENT_TYPES);
const NEXID_WEBHOOK_EVENT_ID_PATTERN = /^evt_[A-Za-z0-9_-]{8,128}$/;
const NEXID_WEBHOOK_EVENT_TYPE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,119}$/;
const DEFAULT_WEBHOOK_BODY_MAX_BYTES = 256 * 1024;
function decodeWebhookBody(rawBody) {
    if (typeof rawBody === "string")
        return rawBody;
    try {
        return new TextDecoder("utf-8", { fatal: true }).decode(rawBody);
    }
    catch {
        return null;
    }
}
function isPlainRecord(value) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
/**
 * Verifies the signed bytes and then validates the versioned event envelope.
 *
 * The header event ID must equal the signed body ID. Current v1 events carry
 * schemaVersion `1.0`; the immediately previous unversioned envelope remains
 * readable as `legacy` during migration. Unknown future schema versions fail
 * closed instead of being interpreted with today's semantics.
 */
export function verifyAndParseNexIdWebhook(input) {
    const verification = verifyNexIdWebhookSignature(input);
    if (!verification.ok)
        return { ok: false, stage: "signature", reason: verification.reason };
    const requestedMaxBytes = Number(input.maxBodyBytes ?? DEFAULT_WEBHOOK_BODY_MAX_BYTES);
    const maxBodyBytes = Number.isSafeInteger(requestedMaxBytes)
        ? Math.min(Math.max(requestedMaxBytes, 1), 1024 * 1024)
        : DEFAULT_WEBHOOK_BODY_MAX_BYTES;
    const bodyBytes = typeof input.rawBody === "string"
        ? Buffer.byteLength(input.rawBody, "utf8")
        : input.rawBody.byteLength;
    if (bodyBytes > maxBodyBytes)
        return { ok: false, stage: "envelope", reason: "webhook_body_too_large" };
    const decoded = decodeWebhookBody(input.rawBody);
    if (decoded === null)
        return { ok: false, stage: "envelope", reason: "invalid_webhook_body_encoding" };
    let parsed;
    try {
        parsed = JSON.parse(decoded);
    }
    catch {
        return { ok: false, stage: "envelope", reason: "invalid_webhook_json" };
    }
    if (!isPlainRecord(parsed) || !isPlainRecord(parsed.data)) {
        return { ok: false, stage: "envelope", reason: "invalid_webhook_envelope" };
    }
    const id = typeof parsed.id === "string" ? parsed.id : "";
    const type = typeof parsed.type === "string" ? parsed.type : "";
    const createdAt = typeof parsed.createdAt === "string" ? parsed.createdAt : "";
    const schemaVersion = parsed.schemaVersion;
    if (!NEXID_WEBHOOK_EVENT_ID_PATTERN.test(id)
        || !NEXID_WEBHOOK_EVENT_TYPE_PATTERN.test(type)
        || createdAt.length < 20
        || createdAt.length > 40
        || !Number.isFinite(Date.parse(createdAt))) {
        return { ok: false, stage: "envelope", reason: "invalid_webhook_envelope" };
    }
    if (schemaVersion !== undefined && schemaVersion !== NEXID_WEBHOOK_EVENT_SCHEMA_VERSION) {
        return { ok: false, stage: "envelope", reason: "unsupported_webhook_schema_version" };
    }
    if (id !== verification.eventId) {
        return { ok: false, stage: "envelope", reason: "webhook_event_id_mismatch" };
    }
    const expected = input.expectedEventTypes;
    if (expected?.length) {
        const allowed = new Set(expected.map((entry) => String(entry || "").trim()).filter(Boolean));
        if (!allowed.has(type)) {
            return { ok: false, stage: "envelope", reason: "unexpected_webhook_event_type" };
        }
    }
    return {
        ok: true,
        verification,
        event: {
            ...(schemaVersion === NEXID_WEBHOOK_EVENT_SCHEMA_VERSION ? { schemaVersion } : {}),
            id,
            type,
            createdAt,
            data: parsed.data,
        },
        contractVersion: schemaVersion === NEXID_WEBHOOK_EVENT_SCHEMA_VERSION
            ? NEXID_WEBHOOK_EVENT_SCHEMA_VERSION
            : "legacy",
        knownEventType: NEXID_WEBHOOK_EVENT_TYPE_SET.has(type),
    };
}
export const NEXID_EPCIS_CONTEXT = "https://ref.gs1.org/standards/epcis/epcis-context.jsonld";
export const NEXID_EPCIS_VERSION = "2.0";
export const NEXID_EPCIS_MEDIA_TYPE = "application/vnd.gs1.epcis+json";
export const NEXID_EPCIS_CAPTURE_MAX_BYTES = 512 * 1024;
export const NEXID_EPCIS_CAPTURE_MAX_EVENTS = 100;
export const NEXID_EPCIS_CAPTURE_MAX_PROJECTIONS = 100;
/** A stable, machine-readable error for HTTP, timeout, abort and network failures. */
export class NexIdApiError extends Error {
    status;
    reason;
    traceId;
    retryAfter;
    body;
    constructor(options) {
        const statusLabel = options.status > 0 ? String(options.status) : "transport";
        const traceLabel = options.traceId ? ` [trace ${options.traceId}]` : "";
        super(`nexID request failed (${statusLabel}: ${options.reason})${traceLabel}`, { cause: options.cause });
        this.name = "NexIdApiError";
        this.status = options.status;
        this.reason = options.reason;
        this.traceId = options.traceId;
        this.retryAfter = options.retryAfter;
        this.body = options.body;
    }
}
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRY = {
    maxRetries: 2,
    baseDelayMs: 200,
    maxDelayMs: 2_000,
};
const TENANT_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._~:/+=-]{0,254}$/;
const EPCIS_CURSOR_PATTERN = /^[A-Za-z0-9_-]+$/;
const EPCIS_QUALIFIER_PATTERN = /^[\x21-\x7e]{1,20}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EPCIS_EVENT_TYPE_VALUES = new Set([
    "ObjectEvent",
    "AggregationEvent",
    "TransactionEvent",
    "TransformationEvent",
    "AssociationEvent",
]);
const SDK_IDEMPOTENCY_OPERATION_VALUES = new Set([
    "verifyTap",
    "claimOwnership",
    "reportEvent",
    "activatePosPurchase",
]);
function boundedInteger(name, value, fallback, minimum, maximum) {
    if (value === undefined)
        return fallback;
    if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) {
        throw new TypeError(`nexID SDK ${name} must be an integer between ${minimum} and ${maximum}`);
    }
    return Number(value);
}
function normalizeApiBaseUrl(value, environment) {
    const raw = String(value || "https://api.nexid.lat").trim();
    let url;
    try {
        url = new URL(raw);
    }
    catch {
        throw new TypeError("nexID SDK apiBaseUrl must be an absolute HTTP(S) URL");
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new TypeError("nexID SDK apiBaseUrl must use HTTP or HTTPS");
    }
    if (environment === "production" && url.protocol !== "https:") {
        throw new TypeError("nexID production apiBaseUrl must use HTTPS");
    }
    if (url.username || url.password) {
        throw new TypeError("nexID SDK apiBaseUrl must not contain credentials");
    }
    if (url.search || url.hash) {
        throw new TypeError("nexID SDK apiBaseUrl must not contain a query or fragment");
    }
    return url.toString().replace(/\/+$/, "");
}
function normalizeHeaderValue(name, value, maximumLength) {
    const normalized = String(value || "").trim();
    if (!normalized || normalized.length > maximumLength || /[\u0000-\u001f\u007f]/.test(normalized)) {
        throw new TypeError(`nexID SDK ${name} is invalid`);
    }
    return normalized;
}
function isValidGtin14(value) {
    if (!/^\d{14}$/.test(value))
        return false;
    let sum = 0;
    for (let index = 0; index < 13; index += 1) {
        sum += Number(value[index]) * (index % 2 === 0 ? 3 : 1);
    }
    return (10 - (sum % 10)) % 10 === Number(value[13]);
}
function normalizedEpcisDate(name, value) {
    if (value === undefined)
        return "";
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime()))
        throw new TypeError(`nexID SDK ${name} must be a valid date-time`);
    return date.toISOString();
}
function normalizedEpcisText(name, value, maximumLength) {
    if (value === undefined)
        return "";
    const normalized = String(value).trim();
    if (!normalized || normalized.length > maximumLength || /[\u0000-\u001f\u007f]/.test(normalized)) {
        throw new TypeError(`nexID SDK ${name} is invalid`);
    }
    return normalized;
}
function epcisQueryString(filters = {}) {
    if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
        throw new TypeError("nexID SDK EPCIS filters must be an object");
    }
    const search = new URLSearchParams();
    if (filters.limit !== undefined)
        search.set("limit", String(boundedInteger("EPCIS limit", filters.limit, 50, 1, 200)));
    const cursor = normalizedEpcisText("EPCIS cursor", filters.cursor, 512);
    if (cursor) {
        if (!EPCIS_CURSOR_PATTERN.test(cursor))
            throw new TypeError("nexID SDK EPCIS cursor is invalid");
        search.set("cursor", cursor);
    }
    if (filters.eventType !== undefined) {
        if (!EPCIS_EVENT_TYPE_VALUES.has(filters.eventType))
            throw new TypeError("nexID SDK EPCIS eventType is invalid");
        search.set("eventType", filters.eventType);
    }
    for (const [key, raw] of [["bizStep", filters.bizStep], ["disposition", filters.disposition]]) {
        const value = normalizedEpcisText(`EPCIS ${key}`, raw, 512);
        if (value)
            search.set(key, value);
    }
    const gtin = normalizedEpcisText("EPCIS gtin", filters.gtin, 14);
    if (gtin && !isValidGtin14(gtin))
        throw new TypeError("nexID SDK EPCIS gtin must be a valid GTIN-14");
    const lot = normalizedEpcisText("EPCIS lot", filters.lot, 20);
    const serial = normalizedEpcisText("EPCIS serial", filters.serial, 20);
    if ((lot || serial) && !gtin)
        throw new TypeError("nexID SDK EPCIS lot and serial filters require gtin");
    for (const [key, value] of [["lot", lot], ["serial", serial]]) {
        if (value && (!EPCIS_QUALIFIER_PATTERN.test(value) || /[\/?#]/.test(value))) {
            throw new TypeError(`nexID SDK EPCIS ${key} is invalid`);
        }
    }
    if (gtin)
        search.set("gtin", gtin);
    if (lot)
        search.set("lot", lot);
    if (serial)
        search.set("serial", serial);
    const eventTimeFrom = normalizedEpcisDate("EPCIS eventTimeFrom", filters.eventTimeFrom);
    const eventTimeTo = normalizedEpcisDate("EPCIS eventTimeTo", filters.eventTimeTo);
    if (eventTimeFrom && eventTimeTo && eventTimeFrom > eventTimeTo) {
        throw new TypeError("nexID SDK EPCIS eventTimeFrom must not be after eventTimeTo");
    }
    if (eventTimeFrom)
        search.set("eventTimeFrom", eventTimeFrom);
    if (eventTimeTo)
        search.set("eventTimeTo", eventTimeTo);
    const encoded = search.toString();
    return encoded ? `?${encoded}` : "";
}
function assertBoundedEpcisCaptureDocument(document) {
    const record = document && typeof document === "object" && !Array.isArray(document)
        ? document
        : null;
    const context = record?.["@context"];
    const officialContext = context === NEXID_EPCIS_CONTEXT
        || (Array.isArray(context) && context.length === 1 && context[0] === NEXID_EPCIS_CONTEXT);
    const body = record?.epcisBody && typeof record.epcisBody === "object" && !Array.isArray(record.epcisBody)
        ? record.epcisBody
        : null;
    const events = body?.eventList;
    if (!record
        || !officialContext
        || record.type !== "EPCISDocument"
        || record.schemaVersion !== NEXID_EPCIS_VERSION
        || !Array.isArray(events)
        || events.length < 1
        || events.length > NEXID_EPCIS_CAPTURE_MAX_EVENTS) {
        throw new TypeError("nexID SDK EPCIS document is outside the supported bounded EPCIS 2.0 profile");
    }
    let encoded;
    try {
        encoded = JSON.stringify(document);
    }
    catch (error) {
        throw new TypeError("nexID SDK EPCIS document must be JSON serializable", { cause: error });
    }
    if (Buffer.byteLength(encoded, "utf8") > NEXID_EPCIS_CAPTURE_MAX_BYTES) {
        throw new TypeError(`nexID SDK EPCIS document exceeds ${NEXID_EPCIS_CAPTURE_MAX_BYTES} bytes`);
    }
}
function epcisPage(expectedType, data, response, traceId) {
    const record = data && typeof data === "object" && !Array.isArray(data)
        ? data
        : null;
    const rawPageSize = response.headers.get("x-nexid-page-size");
    const pageSize = rawPageSize && /^\d{1,3}$/.test(rawPageSize) ? Number(rawPageSize) : -1;
    const nextCursor = response.headers.get("x-nexid-next-cursor")?.trim() || null;
    const body = record?.epcisBody && typeof record.epcisBody === "object" && !Array.isArray(record.epcisBody)
        ? record.epcisBody
        : null;
    const queryResults = body?.queryResults && typeof body.queryResults === "object" && !Array.isArray(body.queryResults)
        ? body.queryResults
        : null;
    const resultsBody = queryResults?.resultsBody && typeof queryResults.resultsBody === "object" && !Array.isArray(queryResults.resultsBody)
        ? queryResults.resultsBody
        : null;
    const eventList = expectedType === "EPCISQueryDocument" ? resultsBody?.eventList : body?.eventList;
    if (!record
        || record.type !== expectedType
        || record.schemaVersion !== NEXID_EPCIS_VERSION
        || record["@context"] !== NEXID_EPCIS_CONTEXT
        || !Array.isArray(eventList)
        || pageSize < 0
        || pageSize > 200
        || pageSize !== eventList.length
        || (nextCursor !== null && (nextCursor.length > 512 || !EPCIS_CURSOR_PATTERN.test(nextCursor)))) {
        throw new NexIdApiError({
            status: 502,
            reason: "invalid_epcis_response",
            traceId,
            retryAfter: null,
            body: data,
        });
    }
    return { document: record, nextCursor, pageSize, traceId };
}
function parseRetryAfter(value, now = Date.now()) {
    if (!value)
        return null;
    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0)
        return Math.ceil(seconds);
    const date = Date.parse(value);
    if (!Number.isFinite(date))
        return null;
    return Math.max(0, Math.ceil((date - now) / 1_000));
}
function responseTraceId(data, response, fallback) {
    const record = data && typeof data === "object" ? data : {};
    const bodyTrace = record.traceId ?? record.trace_id;
    return String((typeof bodyTrace === "string" && bodyTrace.trim() ? bodyTrace : "")
        || response.headers.get("x-nexid-trace-id")
        || response.headers.get("x-request-id")
        || fallback).trim() || null;
}
function responseReason(data, status) {
    const record = data && typeof data === "object" ? data : {};
    for (const candidate of [record.reason, record.error, record.message]) {
        if (typeof candidate === "string" && candidate.trim())
            return candidate.trim();
    }
    return `http_${status}`;
}
function createAttemptSignal(external, timeoutMs) {
    if (!external && timeoutMs === 0) {
        return { signal: undefined, didTimeout: () => false, cleanup: () => undefined };
    }
    const controller = new AbortController();
    let timedOut = false;
    const abortFromCaller = () => controller.abort(external?.reason);
    if (external?.aborted)
        abortFromCaller();
    else
        external?.addEventListener("abort", abortFromCaller, { once: true });
    const timer = timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true;
            controller.abort(new Error(`nexID SDK request timed out after ${timeoutMs}ms`));
        }, timeoutMs)
        : null;
    return {
        signal: controller.signal,
        didTimeout: () => timedOut,
        cleanup: () => {
            if (timer)
                clearTimeout(timer);
            external?.removeEventListener("abort", abortFromCaller);
        },
    };
}
async function waitForRetry(delayMs, signal) {
    if (signal?.aborted)
        throw signal.reason || new Error("request aborted");
    if (delayMs <= 0)
        return;
    await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            signal?.removeEventListener("abort", abort);
            resolve();
        }, delayMs);
        const abort = () => {
            clearTimeout(timer);
            signal?.removeEventListener("abort", abort);
            reject(signal?.reason || new Error("request aborted"));
        };
        signal?.addEventListener("abort", abort, { once: true });
    });
}
export class NexIdClient {
    apiKey;
    tenantSlug;
    apiBaseUrl;
    fetchImpl;
    timeoutMs;
    retry;
    constructor(config) {
        const browserRuntime = typeof globalThis === "object"
            && "window" in globalThis
            && "document" in globalThis;
        if (browserRuntime) {
            throw new Error("nexID server SDK cannot run in a browser. Keep NEXID_API_KEY in your backend or BFF.");
        }
        if (!config || typeof config !== "object")
            throw new TypeError("nexID SDK requires a configuration object");
        if (!config.apiKey)
            throw new Error("nexID SDK requires apiKey");
        if (!config.tenantSlug)
            throw new Error("nexID SDK requires tenantSlug");
        const environment = String(config.environment || "production");
        if (!["production", "private"].includes(environment)) {
            throw new Error("nexID SDK has no public sandbox endpoint. Use apiBaseUrl only for an approved local or private environment.");
        }
        if (environment === "private" && !config.apiBaseUrl) {
            throw new Error("nexID private environment requires apiBaseUrl");
        }
        this.apiKey = normalizeHeaderValue("apiKey", config.apiKey, 4_096);
        this.tenantSlug = normalizeHeaderValue("tenantSlug", config.tenantSlug, 128).toLowerCase();
        if (!TENANT_SLUG_PATTERN.test(this.tenantSlug)) {
            throw new TypeError("nexID SDK tenantSlug must contain only letters, numbers, dots, underscores or hyphens");
        }
        this.apiBaseUrl = normalizeApiBaseUrl(config.apiBaseUrl, environment);
        const runtimeFetch = config.fetchImpl || globalThis.fetch;
        if (typeof runtimeFetch !== "function")
            throw new Error("nexID SDK requires a Fetch API implementation");
        this.fetchImpl = runtimeFetch;
        this.timeoutMs = boundedInteger("timeoutMs", config.timeoutMs, DEFAULT_TIMEOUT_MS, 0, 300_000);
        this.retry = config.retry === false
            ? { ...DEFAULT_RETRY, maxRetries: 0 }
            : {
                maxRetries: boundedInteger("retry.maxRetries", config.retry?.maxRetries, DEFAULT_RETRY.maxRetries, 0, 5),
                baseDelayMs: boundedInteger("retry.baseDelayMs", config.retry?.baseDelayMs, DEFAULT_RETRY.baseDelayMs, 0, 10_000),
                maxDelayMs: boundedInteger("retry.maxDelayMs", config.retry?.maxDelayMs, DEFAULT_RETRY.maxDelayMs, 0, 30_000),
            };
    }
    async request(endpoint, options = {}) {
        const method = options.method || (options.body === undefined ? "GET" : "POST");
        const timeoutMs = boundedInteger("request timeoutMs", options.context?.timeoutMs, this.timeoutMs, 0, 300_000);
        const requestId = options.context?.requestId
            ? normalizeHeaderValue("requestId", options.context.requestId, 128)
            : `sdk_${randomUUID()}`;
        if (!REQUEST_ID_PATTERN.test(requestId)) {
            throw new TypeError("nexID SDK requestId contains unsupported characters");
        }
        const idempotencyKey = options.idempotencyKey
            ? normalizeHeaderValue("idempotencyKey", options.idempotencyKey, 255)
            : "";
        const mayRetry = method === "GET" || Boolean(options.idempotentMutation && idempotencyKey);
        const maxRetries = mayRetry
            ? boundedInteger("request maxRetries", options.maxRetries, this.retry.maxRetries, 0, 5)
            : 0;
        for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
            if (options.context?.signal?.aborted) {
                throw new NexIdApiError({
                    status: 0,
                    reason: "request_aborted",
                    traceId: requestId,
                    retryAfter: null,
                    cause: options.context.signal.reason,
                });
            }
            const attemptSignal = createAttemptSignal(options.context?.signal, timeoutMs);
            try {
                const headers = {
                    "accept": options.accept || "application/json",
                    "user-agent": NEXID_SDK_USER_AGENT,
                    "x-nexid-sdk-version": NEXID_SDK_VERSION,
                    "x-nexid-api-key": this.apiKey,
                    "x-nexid-tenant-slug": this.tenantSlug,
                    "x-nexid-trace-id": requestId,
                    "x-request-id": requestId,
                };
                if (options.body !== undefined)
                    headers["content-type"] = options.contentType || "application/json";
                if (idempotencyKey)
                    headers["idempotency-key"] = idempotencyKey;
                const response = await this.fetchImpl(`${this.apiBaseUrl}${endpoint}`, {
                    method,
                    headers,
                    body: options.body === undefined ? undefined : JSON.stringify(options.body),
                    signal: attemptSignal.signal,
                });
                const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
                const retryableStatus = response.status === 429 || response.status >= 500;
                if (mayRetry && retryableStatus && attempt < maxRetries) {
                    await response.body?.cancel().catch(() => undefined);
                    attemptSignal.cleanup();
                    const exponentialDelay = this.retry.baseDelayMs * (2 ** attempt);
                    const requestedDelay = retryAfter === null ? exponentialDelay : retryAfter * 1_000;
                    await waitForRetry(Math.min(requestedDelay, this.retry.maxDelayMs), options.context?.signal);
                    continue;
                }
                const text = await response.text();
                let data = null;
                try {
                    data = text ? JSON.parse(text) : null;
                }
                catch {
                    data = { raw: text };
                }
                if (!response.ok) {
                    throw new NexIdApiError({
                        status: response.status,
                        reason: responseReason(data, response.status),
                        traceId: responseTraceId(data, response, requestId),
                        retryAfter,
                        body: data,
                    });
                }
                const traceId = responseTraceId(data, response, requestId) || requestId;
                return options.transformResponse
                    ? options.transformResponse(data, response, traceId)
                    : data;
            }
            catch (error) {
                if (error instanceof NexIdApiError)
                    throw error;
                const reason = attemptSignal.didTimeout()
                    ? "request_timeout"
                    : options.context?.signal?.aborted
                        ? "request_aborted"
                        : "network_error";
                if (mayRetry && attempt < maxRetries && !options.context?.signal?.aborted) {
                    const exponentialDelay = this.retry.baseDelayMs * (2 ** attempt);
                    await waitForRetry(Math.min(exponentialDelay, this.retry.maxDelayMs), options.context?.signal);
                    continue;
                }
                throw new NexIdApiError({
                    status: 0,
                    reason,
                    traceId: requestId,
                    retryAfter: null,
                    cause: error,
                });
            }
            finally {
                attemptSignal.cleanup();
            }
        }
        throw new NexIdApiError({
            status: 0,
            reason: "retry_exhausted",
            traceId: requestId,
            retryAfter: null,
        });
    }
    verifyTap(params, options = {}) {
        return this.request("/api/v1/sdk/verify", { method: "POST", body: params, context: options, idempotencyKey: options.idempotencyKey, idempotentMutation: true, maxRetries: options.maxRetries });
    }
    claimOwnership(params, options = {}) {
        return this.request("/api/v1/sdk/claim", { method: "POST", body: params, context: options, idempotencyKey: options.idempotencyKey, idempotentMutation: true, maxRetries: options.maxRetries });
    }
    getProduct(bid, options = {}) {
        return this.request(`/api/v1/sdk/products/${encodeURIComponent(bid)}`, { method: "GET", context: options, maxRetries: options.maxRetries });
    }
    reportEvent(params, options = {}) {
        return this.request("/api/v1/sdk/events", { method: "POST", body: params, context: options, idempotencyKey: options.idempotencyKey, idempotentMutation: true, maxRetries: options.maxRetries });
    }
    activatePosPurchase(params, options = {}) {
        return this.request("/api/v1/sdk/pos/activate", { method: "POST", body: params, context: options, idempotencyKey: options.idempotencyKey, idempotentMutation: true, maxRetries: options.maxRetries });
    }
    /**
     * Captures one bounded EPCIS 2.0 JSON/JSON-LD document. The idempotency key
     * is mandatory so a transport retry cannot duplicate business events.
     */
    captureEpcisDocument(document, options) {
        if (!options || typeof options !== "object") {
            throw new TypeError("nexID SDK EPCIS capture requires options with idempotencyKey");
        }
        assertBoundedEpcisCaptureDocument(document);
        const idempotencyKey = normalizeHeaderValue("idempotencyKey", options.idempotencyKey, 255);
        if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
            throw new TypeError("nexID SDK idempotencyKey contains unsupported characters");
        }
        return this.request("/api/v1/sdk/epcis/capture", {
            method: "POST",
            body: document,
            context: options,
            idempotencyKey,
            idempotentMutation: true,
            maxRetries: options.maxRetries,
            accept: NEXID_EPCIS_MEDIA_TYPE,
            contentType: NEXID_EPCIS_MEDIA_TYPE,
            transformResponse: (data, response, traceId) => {
                const receipt = data && typeof data === "object" && !Array.isArray(data)
                    ? data
                    : null;
                if (!receipt
                    || receipt.ok !== true
                    || typeof receipt.captureID !== "string"
                    || !UUID_PATTERN.test(receipt.captureID)
                    || typeof receipt.documentRecordID !== "string"
                    || !UUID_PATTERN.test(receipt.documentRecordID)
                    || !Number.isSafeInteger(receipt.eventCount)
                    || Number(receipt.eventCount) < 1
                    || Number(receipt.eventCount) > NEXID_EPCIS_CAPTURE_MAX_EVENTS
                    || !Number.isSafeInteger(receipt.canonicalProjectionCount)
                    || Number(receipt.canonicalProjectionCount) < Number(receipt.eventCount)
                    || Number(receipt.canonicalProjectionCount) > NEXID_EPCIS_CAPTURE_MAX_PROJECTIONS
                    || typeof receipt.capturedAt !== "string"
                    || !Number.isFinite(Date.parse(receipt.capturedAt))
                    || typeof receipt.replayed !== "boolean"
                    || !receipt.evidence
                    || typeof receipt.evidence !== "object"
                    || Array.isArray(receipt.evidence)
                    || receipt.evidence.level !== "declared_business_event"
                    || receipt.evidence.cryptographicNfcAuthentication !== false) {
                    throw new NexIdApiError({
                        status: 502,
                        reason: "invalid_epcis_capture_receipt",
                        traceId,
                        retryAfter: null,
                        body: data,
                    });
                }
                return { ...receipt, traceId };
            },
        });
    }
    /** Returns one cursor page in an EPCISQueryDocument. */
    queryEpcisEvents(filters = {}, options = {}) {
        const query = epcisQueryString(filters);
        return this.request(`/api/v1/sdk/epcis/events${query}`, {
            method: "GET",
            context: options,
            maxRetries: options.maxRetries,
            accept: NEXID_EPCIS_MEDIA_TYPE,
            transformResponse: (data, response, traceId) => epcisPage("EPCISQueryDocument", data, response, traceId),
        });
    }
    /** Returns one cursor page as a portable EPCISDocument export. */
    exportEpcisEvents(filters = {}, options = {}) {
        const query = epcisQueryString(filters);
        return this.request(`/api/v1/sdk/epcis/export${query}`, {
            method: "GET",
            context: options,
            maxRetries: options.maxRetries,
            accept: NEXID_EPCIS_MEDIA_TYPE,
            transformResponse: (data, response, traceId) => epcisPage("EPCISDocument", data, response, traceId),
        });
    }
    getIdempotencyStatus(operation, idempotencyKey, options = {}) {
        if (!SDK_IDEMPOTENCY_OPERATION_VALUES.has(operation)) {
            throw new TypeError("nexID SDK idempotency operation is invalid");
        }
        const key = normalizeHeaderValue("idempotencyKey", idempotencyKey, 255);
        const endpoint = `/api/v1/sdk/idempotency/status?operation=${encodeURIComponent(operation)}`;
        return this.request(endpoint, { method: "GET", context: options, maxRetries: options.maxRetries, idempotencyKey: key });
    }
    reconcileIdempotency(operation, idempotencyKey, options = {}) {
        if (!SDK_IDEMPOTENCY_OPERATION_VALUES.has(operation)) {
            throw new TypeError("nexID SDK idempotency operation is invalid");
        }
        const key = normalizeHeaderValue("idempotencyKey", idempotencyKey, 255);
        const endpoint = `/api/v1/sdk/idempotency/status?operation=${encodeURIComponent(operation)}`;
        return this.request(endpoint, { method: "POST", context: options, idempotencyKey: key });
    }
    applyDeliverySeal(params, options = {}) {
        return this.request("/api/v1/logistics/seal-apply", { method: "POST", body: params, context: options, idempotencyKey: options.idempotencyKey });
    }
    handoffDeliverySeal(params, options = {}) {
        return this.request("/api/v1/logistics/handoff", { method: "POST", body: params, context: options, idempotencyKey: options.idempotencyKey });
    }
    verifyDeliverySeal(params, options = {}) {
        return this.request("/api/v1/logistics/recipient-verify", { method: "POST", body: params, context: options, idempotencyKey: options.idempotencyKey });
    }
}
//# sourceMappingURL=index.js.map
import { createHash } from "node:crypto";
import { normalizeConsentedApproximateLocation } from "./approximate-location";
import { buildSunPayloadHashes } from "./sun-payload";

export const SDK_OFFLINE_SYNC_SCHEMA_VERSION = 1 as const;
export const SDK_OFFLINE_SYNC_MAX_BODY_BYTES = 256 * 1024;
export const SDK_OFFLINE_SYNC_MAX_EVENTS = 100;
export const SDK_OFFLINE_SYNC_MAX_CAPTURED_URL_BYTES = 4_096;
export const SDK_OFFLINE_SYNC_EXPIRY_GRACE_MS = 30 * 24 * 60 * 60 * 1_000;
export const SDK_OFFLINE_SYNC_PROCESSING_LEASE_MS = 5 * 60 * 1_000;

const OFFLINE_EVENT_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._~:+/-]{0,159}$/;
const BID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const APP_VERSION_RE = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/;
const HEX_RE = /^[0-9A-F]+$/;
const SUN_QUERY_KEYS = new Set(["v", "bid", "picc_data", "enc", "cmac"]);
const OFFLINE_EVENT_KEYS = new Set([
  "localId",
  "local_id",
  "clientEventId",
  "client_event_id",
  "capturedUrl",
  "captured_url",
  "capturedAt",
  "captured_at",
  "observedAt",
  "observed_at",
  "status",
  "deviceId",
  "device_id",
  "tenantId",
  "tenant_id",
  "tenant",
  "bid",
  "batchId",
  "batch_id",
  "approximateLocation",
  "approximate_location",
  "appVersion",
  "app_version",
]);

const AUTHENTIC_RESULTS = new Set([
  "VALID",
  "TAP_VALID",
  "VALID_CLOSED",
  "VALID_UNKNOWN_TAMPER",
  "OPENED",
  "OPENED_PREVIOUSLY",
  "MANUAL_OPENED",
  "VALID_OPENED",
  "VALID_OPENED_PREVIOUSLY",
  "VALID_MANUAL_OPENED",
]);

export type OfflineSyncApproximateLocation = {
  lat: number;
  lng: number;
  accuracy_m: number;
  precision: "approximate";
};

export type NormalizedOfflineSunEvent = {
  clientEventId: string;
  capturedUrl: string;
  capturedAt: string;
  bid: string;
  piccDataHex: string;
  encHex: string;
  cmacHex: string;
  sunPayloadHash: string;
  legacyCapturedUrlHash: string;
  approximateLocation: OfflineSyncApproximateLocation | null;
  appVersion: string | null;
};

export type OfflineSyncTerminalStatus = "SYNCED_VALID" | "SYNCED_INVALID" | "REPLAY_SUSPECT";

export type RedactedOfflineSyncReceipt = {
  ok: true;
  client_event_id: string;
  bid: string;
  sync_status: OfflineSyncTerminalStatus;
  final_verdict: true;
  verdict: "MESSAGE_VALID" | "MESSAGE_NOT_VALID" | "REPLAY_SUSPECT";
  cryptographic_verification: boolean;
  uid_masked: string | null;
  read_counter: number | null;
  seal_status: "CLOSED" | "OPENED" | "UNKNOWN";
  sun_event_id: string | null;
  verified_at: string;
  reason: string;
  replayed: boolean;
};

export class OfflineSyncValidationError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.name = "OfflineSyncValidationError";
    this.reason = reason;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function boundedIdentifier(value: unknown, pattern: RegExp, reason: string) {
  const normalized = firstString(value);
  if (!pattern.test(normalized) || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new OfflineSyncValidationError(reason);
  }
  return normalized;
}

function strictHex(value: string, options: { minimumChars: number; maximumChars: number; blockChars?: number }, reason: string) {
  const normalized = value.trim().toUpperCase();
  if (
    !HEX_RE.test(normalized)
    || normalized.length < options.minimumChars
    || normalized.length > options.maximumChars
    || normalized.length % 2 !== 0
    || (options.blockChars && normalized.length % options.blockChars !== 0)
  ) {
    throw new OfflineSyncValidationError(reason);
  }
  return normalized;
}

export function parseOfflineSunCapturedUrl(value: unknown) {
  const capturedUrl = firstString(value);
  if (!capturedUrl || Buffer.byteLength(capturedUrl, "utf8") > SDK_OFFLINE_SYNC_MAX_CAPTURED_URL_BYTES) {
    throw new OfflineSyncValidationError("offline_sync_captured_url_invalid");
  }
  let url: URL;
  try {
    url = new URL(capturedUrl);
  } catch {
    throw new OfflineSyncValidationError("offline_sync_captured_url_invalid");
  }
  if (
    url.protocol !== "https:"
    || url.username
    || url.password
    || url.hash
    || !["/sun", "/sun/"].includes(url.pathname)
  ) {
    throw new OfflineSyncValidationError("offline_sync_captured_url_invalid");
  }
  for (const key of url.searchParams.keys()) {
    if (!SUN_QUERY_KEYS.has(key) || url.searchParams.getAll(key).length !== 1) {
      throw new OfflineSyncValidationError("offline_sync_sun_query_invalid");
    }
  }
  if (["bid", "picc_data", "enc", "cmac"].some((key) => url.searchParams.getAll(key).length !== 1)) {
    throw new OfflineSyncValidationError("offline_sync_sun_query_invalid");
  }
  const version = firstString(url.searchParams.get("v"));
  if (version && version !== "1") throw new OfflineSyncValidationError("offline_sync_sun_version_unsupported");

  const bid = boundedIdentifier(url.searchParams.get("bid"), BID_RE, "offline_sync_bid_invalid");
  const piccDataHex = strictHex(
    firstString(url.searchParams.get("picc_data")),
    { minimumChars: 32, maximumChars: 256, blockChars: 32 },
    "offline_sync_picc_data_invalid",
  );
  const encHex = strictHex(
    firstString(url.searchParams.get("enc")),
    { minimumChars: 32, maximumChars: 512, blockChars: 32 },
    "offline_sync_enc_invalid",
  );
  const cmacHex = strictHex(
    firstString(url.searchParams.get("cmac")),
    { minimumChars: 16, maximumChars: 16 },
    "offline_sync_cmac_invalid",
  );
  return { capturedUrl, bid, piccDataHex, encHex, cmacHex };
}

export function normalizeSdkOfflineSyncEvent(
  value: unknown,
  options: { expectedDeviceId: string; expectedTenantId: string; expectedTenantSlug: string; now?: number },
): NormalizedOfflineSunEvent {
  if (!isRecord(value) || Object.keys(value).some((key) => !OFFLINE_EVENT_KEYS.has(key))) {
    throw new OfflineSyncValidationError("offline_sync_event_shape_invalid");
  }
  const clientEventId = boundedIdentifier(
    firstString(value.clientEventId, value.client_event_id, value.localId, value.local_id),
    OFFLINE_EVENT_ID_RE,
    "offline_sync_client_event_id_invalid",
  );
  const eventDeviceId = firstString(value.deviceId, value.device_id);
  if (eventDeviceId && eventDeviceId !== options.expectedDeviceId) {
    throw new OfflineSyncValidationError("offline_sync_device_mismatch");
  }
  const eventTenant = firstString(value.tenantId, value.tenant_id, value.tenant).toLowerCase();
  if (
    eventTenant
    && eventTenant !== options.expectedTenantId.toLowerCase()
    && eventTenant !== options.expectedTenantSlug.toLowerCase()
  ) {
    throw new OfflineSyncValidationError("offline_sync_tenant_mismatch");
  }
  const localStatus = firstString(value.status).toUpperCase();
  if (localStatus && !["PENDING_BACKEND_VERIFICATION", "SYNC_PENDING", "SYNC_FAILED"].includes(localStatus)) {
    throw new OfflineSyncValidationError("offline_sync_requires_pending_backend_verification");
  }

  const parsed = parseOfflineSunCapturedUrl(firstString(value.capturedUrl, value.captured_url));
  const declaredBid = firstString(value.bid, value.batchId, value.batch_id);
  if (declaredBid && declaredBid !== parsed.bid) {
    throw new OfflineSyncValidationError("offline_sync_bid_mismatch");
  }

  const capturedAtRaw = firstString(value.capturedAt, value.captured_at, value.observedAt, value.observed_at);
  const capturedAtDate = new Date(capturedAtRaw);
  const now = options.now ?? Date.now();
  if (!capturedAtRaw || !Number.isFinite(capturedAtDate.getTime()) || capturedAtDate.getTime() > now + 5 * 60 * 1_000) {
    throw new OfflineSyncValidationError("offline_sync_captured_at_invalid");
  }

  const rawLocation = value.approximateLocation ?? value.approximate_location;
  let approximateLocation: OfflineSyncApproximateLocation | null = null;
  if (rawLocation !== undefined && rawLocation !== null) {
    if (!isRecord(rawLocation)) throw new OfflineSyncValidationError("offline_sync_approximate_location_invalid");
    const normalized = normalizeConsentedApproximateLocation({
      consent: rawLocation.consent,
      precision: rawLocation.precision,
      lat: rawLocation.lat ?? rawLocation.latitude,
      lng: rawLocation.lng ?? rawLocation.longitude,
      accuracy: rawLocation.accuracy ?? rawLocation.accuracy_m,
    });
    if (!normalized.accepted) throw new OfflineSyncValidationError("offline_sync_approximate_location_invalid");
    approximateLocation = {
      lat: normalized.lat,
      lng: normalized.lng,
      accuracy_m: normalized.accuracy,
      precision: "approximate",
    };
  }

  const appVersionRaw = firstString(value.appVersion, value.app_version);
  if (appVersionRaw && !APP_VERSION_RE.test(appVersionRaw)) {
    throw new OfflineSyncValidationError("offline_sync_app_version_invalid");
  }
  const hashes = buildSunPayloadHashes({
    bid: parsed.bid,
    piccDataHex: parsed.piccDataHex,
    encHex: parsed.encHex,
    cmacHex: parsed.cmacHex,
  });
  const legacyHash = `sha256:${createHash("sha256").update(parsed.capturedUrl, "utf8").digest("hex")}`;
  return {
    clientEventId,
    capturedUrl: parsed.capturedUrl,
    capturedAt: capturedAtDate.toISOString(),
    bid: parsed.bid,
    piccDataHex: parsed.piccDataHex,
    encHex: parsed.encHex,
    cmacHex: parsed.cmacHex,
    sunPayloadHash: hashes.rawUrlHash,
    legacyCapturedUrlHash: legacyHash,
    approximateLocation,
    appVersion: appVersionRaw || null,
  };
}

export function assertOfflineCaptureWithinBundleWindow(input: {
  capturedAt: string;
  bundleCreatedAt: unknown;
  bundleExpiresAt: unknown;
}) {
  const capturedAt = new Date(input.capturedAt).getTime();
  const createdAt = new Date(String(input.bundleCreatedAt || "")).getTime();
  const expiresAt = new Date(String(input.bundleExpiresAt || "")).getTime();
  if (
    !Number.isFinite(capturedAt)
    || !Number.isFinite(createdAt)
    || !Number.isFinite(expiresAt)
    || capturedAt < createdAt - 5 * 60 * 1_000
    || capturedAt > expiresAt
  ) {
    throw new OfflineSyncValidationError("offline_sync_capture_outside_bundle_window");
  }
}

function upper(value: unknown) {
  return firstString(value).toUpperCase();
}

function maskedUid(value: unknown) {
  const uid = upper(value);
  if (!uid || !/^[0-9A-F]{8,20}$/.test(uid)) return null;
  return uid.length <= 8 ? `${uid.slice(0, 2)}****${uid.slice(-2)}` : `${uid.slice(0, 4)}****${uid.slice(-4)}`;
}

function safeEventId(value: unknown) {
  const normalized = typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? String(value)
    : firstString(value);
  return /^\d{1,20}$/.test(normalized) || UUID_RE.test(normalized) ? normalized : null;
}

export function redactOfflineSunVerification(input: {
  clientEventId: string;
  bid: string;
  result: { status: number; body: unknown };
  verifiedAt?: string;
  replayed?: boolean;
}): RedactedOfflineSyncReceipt {
  const body = isRecord(input.result.body) ? input.result.body : {};
  const result = upper(body.result || body.auth_status);
  const productState = upper(body.product_state);
  const combined = `${result} ${productState} ${upper(body.reason)}`;
  const isReplay = combined.includes("REPLAY");
  const cryptographicVerification = body.cryptographic_verification === true;
  const isValid = !isReplay
    && input.result.status === 200
    && body.ok === true
    && cryptographicVerification
    && body.allowlisted === true
    && AUTHENTIC_RESULTS.has(result);
  const syncStatus: OfflineSyncTerminalStatus = isReplay
    ? "REPLAY_SUSPECT"
    : isValid
      ? "SYNCED_VALID"
      : "SYNCED_INVALID";
  const tamperStatus = upper(body.tamper_status);
  const sealStatus = isValid && tamperStatus === "CLOSED"
    ? "CLOSED"
    : isValid && ["OPENED", "OPENED_PREVIOUSLY", "MANUAL_OPENED"].includes(tamperStatus)
      ? "OPENED"
      : "UNKNOWN";
  const readCounter = Number(body.ctr);
  const reason = isReplay
    ? "nfc_message_replay_suspect"
    : isValid
      ? "sun_sdm_backend_verified"
      : !cryptographicVerification
        ? "sun_sdm_cryptographic_verification_failed"
        : body.allowlisted === false
          ? "nfc_tag_not_registered"
          : ["NOT_ACTIVE", "REVOKED", "QUARANTINED"].some((state) => combined.includes(state))
            ? "nfc_tag_not_active"
            : "sun_sdm_message_not_accepted";

  return {
    ok: true,
    client_event_id: input.clientEventId,
    bid: input.bid,
    sync_status: syncStatus,
    final_verdict: true,
    verdict: isReplay ? "REPLAY_SUSPECT" : isValid ? "MESSAGE_VALID" : "MESSAGE_NOT_VALID",
    cryptographic_verification: isValid,
    uid_masked: maskedUid(body.uid),
    read_counter: Number.isSafeInteger(readCounter) && readCounter >= 0 ? readCounter : null,
    seal_status: sealStatus,
    sun_event_id: safeEventId(body.event_id),
    verified_at: input.verifiedAt || new Date().toISOString(),
    reason,
    replayed: Boolean(input.replayed),
  };
}

export function readStoredOfflineSyncReceipt(value: unknown): RedactedOfflineSyncReceipt | null {
  let metadata = value;
  if (typeof metadata === "string") {
    try {
      metadata = JSON.parse(metadata);
    } catch {
      return null;
    }
  }
  if (!isRecord(metadata) || !isRecord(metadata.verification_receipt)) return null;
  const receipt = metadata.verification_receipt;
  const status = firstString(receipt.sync_status) as OfflineSyncTerminalStatus;
  if (!(["SYNCED_VALID", "SYNCED_INVALID", "REPLAY_SUSPECT"] as string[]).includes(status)) return null;
  if (receipt.final_verdict !== true || receipt.ok !== true) return null;
  if (status === "SYNCED_VALID" && receipt.cryptographic_verification !== true) return null;
  const verifiedAt = firstString(receipt.verified_at);
  if (!verifiedAt || !Number.isFinite(Date.parse(verifiedAt))) return null;
  const clientEventId = firstString(receipt.client_event_id);
  const bid = firstString(receipt.bid);
  const reason = firstString(receipt.reason);
  if (!OFFLINE_EVENT_ID_RE.test(clientEventId) || !BID_RE.test(bid) || !/^[a-z0-9_]{1,120}$/.test(reason)) return null;
  return {
    ok: true,
    client_event_id: clientEventId,
    bid,
    sync_status: status,
    final_verdict: true,
    verdict: status === "REPLAY_SUSPECT" ? "REPLAY_SUSPECT" : status === "SYNCED_VALID" ? "MESSAGE_VALID" : "MESSAGE_NOT_VALID",
    cryptographic_verification: status === "SYNCED_VALID" && receipt.cryptographic_verification === true,
    uid_masked: typeof receipt.uid_masked === "string" && /^[0-9A-F]{2,4}\*{4}[0-9A-F]{2,4}$/.test(receipt.uid_masked)
      ? receipt.uid_masked
      : null,
    read_counter: Number.isSafeInteger(receipt.read_counter) && Number(receipt.read_counter) >= 0 ? Number(receipt.read_counter) : null,
    seal_status: status === "SYNCED_VALID" && ["CLOSED", "OPENED"].includes(firstString(receipt.seal_status))
      ? firstString(receipt.seal_status) as "CLOSED" | "OPENED"
      : "UNKNOWN",
    sun_event_id: safeEventId(receipt.sun_event_id),
    verified_at: new Date(verifiedAt).toISOString(),
    reason,
    replayed: true,
  };
}

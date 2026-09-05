export const APPROXIMATE_ACCURACY_FLOOR_M = 150;
export const APPROXIMATE_ACCURACY_CEILING_M = 50_000;

export const APPROXIMATE_GEOLOCATION_OPTIONS = {
  // This is a one-shot, user-triggered measurement. Ask the browser for its
  // best available fix, then coarsen it before any network transfer.
  enableHighAccuracy: true,
  timeout: 12_000,
  maximumAge: 0,
} as const;

export type ApproximateBrowserLocation = {
  lat: number;
  lng: number;
  accuracyM: number;
  measuredAt: string;
};

export type LocationReceipt = {
  source?: string | null;
  precision?: string | null;
  accuracyM?: number | null;
  city?: string | null;
  countryCode?: string | null;
  lat?: number | null;
  lng?: number | null;
  tapReceivedAt?: string | null;
  measuredAt?: string | null;
  receivedAt?: string | null;
  timing?: string | null;
};

export type LocationSubmissionFailure = "retryable" | "fresh_tap_required" | "uncertain";

const CONSENTED_APPROXIMATE_SOURCES = new Set([
  "browser_geolocation_approximate_consent",
  "browser_gps_approximate_consent",
]);

const RETRYABLE_SUBMISSION_REASONS = new Set([
  "fresh_location_measurement_required",
  "invalid_location",
  "invalid_location_accuracy",
  "location_consent_required",
  "approximate_location_required",
  "post_tap_location_timing_invalid",
  "rate_limited",
  "sun_context_schema_check_unavailable",
  "sun_context_schema_not_ready",
  // A BFF transport failure cannot prove the upstream did not persist/consume
  // the one-time capability. It must remain uncertain, never a blind retry.
]);

export type BrowserLocationFailure =
  | "denied"
  | "timeout"
  | "unsupported"
  | "invalid"
  | "stale"
  | "unavailable";

type GeolocationPositionLike = {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  timestamp: number;
};

type GeolocationErrorLike = {
  code?: number;
};

export type GeolocationPort = {
  getCurrentPosition: (
    success: (position: GeolocationPositionLike) => void,
    error: (error: GeolocationErrorLike) => void,
    options: typeof APPROXIMATE_GEOLOCATION_OPTIONS,
  ) => void;
};

export type BrowserLocationResult =
  | { ok: true; location: ApproximateBrowserLocation }
  | { ok: false; reason: BrowserLocationFailure };

export function roundApproximateCoordinate(value: number) {
  return Math.round(value * 1_000) / 1_000;
}

function validIsoTimestamp(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function isConsentedApproximateLocationReceipt(value: unknown): value is LocationReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const receipt = value as LocationReceipt;
  const source = String(receipt.source || "").toLowerCase();
  const accuracyM = Number(receipt.accuracyM);
  return CONSENTED_APPROXIMATE_SOURCES.has(source)
    && receipt.precision === "approximate"
    && typeof receipt.lat === "number"
    && Number.isFinite(receipt.lat)
    && receipt.lat >= -90
    && receipt.lat <= 90
    && typeof receipt.lng === "number"
    && Number.isFinite(receipt.lng)
    && receipt.lng >= -180
    && receipt.lng <= 180
    && Number.isFinite(accuracyM)
    && accuracyM >= APPROXIMATE_ACCURACY_FLOOR_M
    && accuracyM <= APPROXIMATE_ACCURACY_CEILING_M
    && validIsoTimestamp(receipt.measuredAt)
    && (!receipt.tapReceivedAt || validIsoTimestamp(receipt.tapReceivedAt))
    && (!receipt.receivedAt || validIsoTimestamp(receipt.receivedAt))
    && (!receipt.timing || receipt.timing === "client_reported_after_tap");
}

export function classifyLocationSubmissionFailure(
  status: number,
  reason: unknown,
  freshTokenStatus?: unknown,
): LocationSubmissionFailure {
  const normalizedReason = String(reason || "").trim().toLowerCase();
  const normalizedFreshStatus = String(freshTokenStatus || "").trim().toLowerCase();

  if (status === 429 || RETRYABLE_SUBMISSION_REASONS.has(normalizedReason)) return "retryable";
  if (
    status === 403
    || status === 404
    || status === 409
    || normalizedFreshStatus.includes("expired")
    || normalizedFreshStatus.includes("already_used")
    || normalizedReason.includes("capability")
    || normalizedReason.includes("evidence_already_consumed")
  ) {
    return "fresh_tap_required";
  }
  return "uncertain";
}

export function normalizeApproximateBrowserPosition(
  position: GeolocationPositionLike,
  requestedAtMs: number,
): BrowserLocationResult {
  const lat = Number(position.coords.latitude);
  const lng = Number(position.coords.longitude);
  const accuracy = Number(position.coords.accuracy);
  const measuredAtMs = Number(position.timestamp);

  if (
    !Number.isFinite(lat)
    || !Number.isFinite(lng)
    || lat < -90
    || lat > 90
    || lng < -180
    || lng > 180
    || !Number.isFinite(accuracy)
    || accuracy < 0
    || accuracy > APPROXIMATE_ACCURACY_CEILING_M
  ) {
    return { ok: false, reason: "invalid" };
  }
  if (!Number.isFinite(measuredAtMs) || measuredAtMs < requestedAtMs) {
    return { ok: false, reason: "stale" };
  }

  return {
    ok: true,
    location: {
      lat: roundApproximateCoordinate(lat),
      lng: roundApproximateCoordinate(lng),
      accuracyM: Math.max(APPROXIMATE_ACCURACY_FLOOR_M, Math.round(accuracy)),
      measuredAt: new Date(measuredAtMs).toISOString(),
    },
  };
}

export function requestApproximateBrowserLocation(
  geolocation: GeolocationPort | null | undefined,
  requestedAtMs: number,
): Promise<BrowserLocationResult> {
  if (!geolocation) return Promise.resolve({ ok: false, reason: "unsupported" });

  return new Promise((resolve) => {
    try {
      geolocation.getCurrentPosition(
        (position) => resolve(normalizeApproximateBrowserPosition(position, requestedAtMs)),
        (error) => {
          if (error.code === 1) resolve({ ok: false, reason: "denied" });
          else if (error.code === 3) resolve({ ok: false, reason: "timeout" });
          else resolve({ ok: false, reason: "unavailable" });
        },
        APPROXIMATE_GEOLOCATION_OPTIONS,
      );
    } catch {
      resolve({ ok: false, reason: "unavailable" });
    }
  });
}

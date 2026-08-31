export const APPROXIMATE_ACCURACY_FLOOR_M = 150;

export const APPROXIMATE_GEOLOCATION_OPTIONS = {
  enableHighAccuracy: false,
  timeout: 12_000,
  maximumAge: 0,
} as const;

export type ApproximateBrowserLocation = {
  lat: number;
  lng: number;
  accuracyM: number;
  measuredAt: string;
};

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
    || accuracy > 50_000
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

export type CoordinateValue = number | string | null | undefined;

export type StrictCoordinatePair = {
  lat: number;
  lng: number;
};

export type MapCoordinatePrecision = "reported" | "approximate";

export type ResolvedMapCoordinate = StrictCoordinatePair & {
  accuracyM: number | null;
  label: string;
  precision: MapCoordinatePrecision;
  source: string;
};

type EventCoordinateInput = {
  lat?: CoordinateValue;
  lng?: CoordinateValue;
  /** Descriptive fields only; never used to manufacture map coordinates. */
  city?: string | null;
  country?: string | null;
  locationSource?: string | null;
  locationAccuracyM?: CoordinateValue;
};

function parseFiniteNumber(value: CoordinateValue): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseStrictCoordinate(value: CoordinateValue, axis: "lat" | "lng"): number | null {
  const parsed = parseFiniteNumber(value);
  if (parsed == null) return null;
  const limit = axis === "lat" ? 90 : 180;
  return parsed >= -limit && parsed <= limit ? parsed : null;
}

export function strictCoordinatePair(lat: CoordinateValue, lng: CoordinateValue): StrictCoordinatePair | null {
  const parsedLat = parseStrictCoordinate(lat, "lat");
  const parsedLng = parseStrictCoordinate(lng, "lng");
  if (parsedLat == null || parsedLng == null) return null;
  return { lat: parsedLat, lng: parsedLng };
}

export function hasStrictCoordinatePair(lat: CoordinateValue, lng: CoordinateValue): boolean {
  return strictCoordinatePair(lat, lng) != null;
}

function parseAccuracy(value: CoordinateValue): number | null {
  const parsed = parseFiniteNumber(value);
  return parsed != null && parsed >= 0 ? parsed : null;
}

function reportedCoordinateLabel(source: string, accuracyM: number | null) {
  if (["browser_gps_approximate_consent","browser_geolocation_approximate_consent","browser_approximate_consent"].includes(source)) {
    return accuracyM == null
      ? "Ubicacion aproximada compartida con consentimiento"
      : `Ubicacion aproximada compartida con consentimiento +/-${Math.round(accuracyM)} m`;
  }
  if (source === "browser_gps" || source === "browser_gps_reported") {
    return accuracyM == null ? "GPS historico reportado; precision no informada" : `GPS historico reportado +/-${Math.round(accuracyM)} m`;
  }
  if (["ip_geo", "ip_approx", "edge_ip_approx"].includes(source)) {
    return accuracyM == null ? "Ubicacion aproximada por IP" : `Ubicacion aproximada por IP +/-${Math.round(accuracyM)} m`;
  }
  const sourceLabel = source || "fuente no informada";
  return accuracyM == null
    ? `Coordenada reportada; precision no informada (${sourceLabel})`
    : `Coordenada reportada +/-${Math.round(accuracyM)} m (${sourceLabel})`;
}

export function resolveEventMapCoordinate(input: EventCoordinateInput): ResolvedMapCoordinate | null {
  const reported = strictCoordinatePair(input.lat, input.lng);
  const originalSource = String(input.locationSource || "").trim().toLowerCase();
  if (["tenant_default","tenant_origin","product_origin","declared_origin","product_passport_declared","default_location","fallback_city"].includes(originalSource)) return null;
  const accuracyM = parseAccuracy(input.locationAccuracyM);

  if (!reported) return null;
  const precision: MapCoordinatePrecision = [
    "browser_gps_approximate_consent",
    "browser_geolocation_approximate_consent",
    "browser_approximate_consent",
    "ip_geo",
    "ip_approx",
    "edge_ip_approx",
  ].includes(originalSource)
    ? "approximate"
    : "reported";
  return {
    ...reported,
    accuracyM,
    label: reportedCoordinateLabel(originalSource, accuracyM),
    precision,
    source: originalSource || "reported_coordinate",
  };
}

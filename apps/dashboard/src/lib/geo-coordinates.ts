export type CoordinateValue = number | string | null | undefined;

export type StrictCoordinatePair = {
  lat: number;
  lng: number;
};

export type MapCoordinatePrecision = "reported" | "approximate" | "synthetic";

export type ResolvedMapCoordinate = StrictCoordinatePair & {
  accuracyM: number | null;
  label: string;
  precision: MapCoordinatePrecision;
  source: string;
};

type EventCoordinateInput = {
  lat?: CoordinateValue;
  lng?: CoordinateValue;
  city?: string | null;
  country?: string | null;
  locationSource?: string | null;
  locationAccuracyM?: CoordinateValue;
  seed: string;
};

const CITY_FALLBACK_COORDS: Array<{ match: RegExp; country: string; lat: number; lng: number }> = [
  { match: /san\s*martin|buenos\s*aires|caba/i, country: "AR", lat: -34.6037, lng: -58.3816 },
  { match: /mendoza|valle\s+de\s+uco|tunuyan|tupungato|lujan/i, country: "AR", lat: -32.8895, lng: -68.8458 },
  { match: /cordoba/i, country: "AR", lat: -31.4201, lng: -64.1888 },
  { match: /rosario/i, country: "AR", lat: -32.9442, lng: -60.6505 },
  { match: /neuquen/i, country: "AR", lat: -38.9516, lng: -68.0591 },
  { match: /mar\s*del\s*plata/i, country: "AR", lat: -38.0055, lng: -57.5426 },
];

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

function cityFallbackCoordinate(city: string, country: string): StrictCoordinatePair | null {
  const normalizedCountry = country.trim().toUpperCase();
  const normalizedCity = city.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const match = CITY_FALLBACK_COORDS.find((item) => item.country === normalizedCountry && item.match.test(normalizedCity));
  return match ? { lat: match.lat, lng: match.lng } : null;
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function jitterCityCenter(coordinate: StrictCoordinatePair, seed: string): StrictCoordinatePair {
  const hash = hashString(seed);
  const lngDelta = (((hash % 100) / 100) - 0.5) * 0.18;
  const latDelta = ((((hash >> 8) % 100) / 100) - 0.5) * 0.18;
  return { lat: coordinate.lat + latDelta, lng: coordinate.lng + lngDelta };
}

function reportedCoordinateLabel(source: string, accuracyM: number | null) {
  if (source === "browser_gps") {
    return accuracyM == null ? "GPS reportado; precision no informada" : `GPS reportado +/-${Math.round(accuracyM)} m`;
  }
  if (source === "ip_geo") {
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
  const accuracyM = parseAccuracy(input.locationAccuracyM);

  if (reported) {
    const precision: MapCoordinatePrecision = originalSource === "ip_geo" ? "approximate" : "reported";
    return {
      ...reported,
      accuracyM,
      label: reportedCoordinateLabel(originalSource, accuracyM),
      precision,
      source: originalSource || "reported_coordinate",
    };
  }

  const city = String(input.city || "").trim();
  const country = String(input.country || "").trim();
  const fallback = cityFallbackCoordinate(city, country);
  if (!fallback) return null;
  const synthetic = jitterCityCenter(fallback, input.seed);
  const sourceContext = originalSource ? `; evento=${originalSource}` : "";
  return {
    ...synthetic,
    accuracyM,
    label: `Posicion sintetica alrededor del centro de ${city}; sirve para densidad por ciudad, no es GPS${sourceContext}`,
    precision: "synthetic",
    source: originalSource ? `city_fallback:${originalSource}` : "city_fallback",
  };
}

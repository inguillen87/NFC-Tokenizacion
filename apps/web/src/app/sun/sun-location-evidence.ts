export type SunLocationEvidenceKind = "measured" | "approximate" | "declared" | "absent";

export type SunLocationObservation = {
  id: string;
  eventId?: string | null;
  lat?: number | null;
  lng?: number | null;
  city?: string | null;
  country?: string | null;
  at?: string | null;
  result?: string | null;
  source?: string | null;
  accuracyM?: number | null;
  current?: boolean;
};

export type SunLocationCluster = {
  id: string;
  lat: number;
  lng: number;
  city: string;
  country: string;
  count: number;
  risk: number;
  result: string;
  lastSeen: string;
  current: boolean;
  kind: Exclude<SunLocationEvidenceKind, "declared" | "absent">;
  sourceLabel: string;
  accuracyM: number | null;
};

const MEASURED_LOCATION_SOURCES = new Set([
  "device_gnss_measured",
  "device_gps_measured",
  "gnss_measured",
  "gps_measured",
  "surveyed",
]);

export function normalizeSunCoordinatePair(lat: unknown, lng: unknown) {
  const parsedLat = typeof lat === "number" ? lat : typeof lat === "string" && lat.trim() ? Number(lat) : Number.NaN;
  const parsedLng = typeof lng === "number" ? lng : typeof lng === "string" && lng.trim() ? Number(lng) : Number.NaN;
  if (
    !Number.isFinite(parsedLat)
    || !Number.isFinite(parsedLng)
    || parsedLat < -90
    || parsedLat > 90
    || parsedLng < -180
    || parsedLng > 180
  ) return null;
  return { lat: parsedLat, lng: parsedLng };
}

export function classifySunLocationEvidence(
  source: unknown,
  hasCoordinates: boolean,
  options: { declared?: boolean } = {},
): SunLocationEvidenceKind {
  if (!hasCoordinates) return "absent";
  if (options.declared) return "declared";
  const normalized = String(source || "").trim().toLowerCase();
  return MEASURED_LOCATION_SOURCES.has(normalized) ? "measured" : "approximate";
}

export function describeSunLocationEvidence(kind: SunLocationEvidenceKind, accuracyM?: number | null) {
  const numericAccuracy = Number(accuracyM);
  const accuracy = Number.isFinite(numericAccuracy) && numericAccuracy > 0
    ? ` · radio informado ±${Math.round(numericAccuracy)} m`
    : "";
  if (kind === "measured") return `Ubicación medida${accuracy}`;
  if (kind === "approximate") return `Ubicación aproximada${accuracy || " · precisión no informada"}`;
  if (kind === "declared") return "Origen declarado por la marca";
  return "Ubicación no disponible";
}

function observationIdentity(observation: SunLocationObservation, lat: number, lng: number) {
  const eventId = String(observation.eventId || "").trim();
  if (eventId) return `event:${eventId}`;
  return [
    String(observation.at || "unknown-time"),
    lat.toFixed(4),
    lng.toFixed(4),
    String(observation.result || "unknown-result"),
  ].join(":");
}

function riskFromResult(result: unknown) {
  return /replay|tamper|risk|invalid|mismatch/i.test(String(result || "")) ? 1 : 0;
}

/**
 * Builds density from observed events only. Declared origins and total scan
 * counters are deliberately excluded so a heat halo cannot imply activity
 * that was never observed at that coordinate.
 */
export function clusterSunLocationObservations(observations: readonly SunLocationObservation[]) {
  const unique = new Map<string, SunLocationObservation & { lat: number; lng: number }>();
  for (const observation of observations) {
    const coordinate = normalizeSunCoordinatePair(observation.lat, observation.lng);
    if (!coordinate) continue;
    const normalized = { ...observation, ...coordinate };
    const identity = observationIdentity(observation, coordinate.lat, coordinate.lng);
    const existing = unique.get(identity);
    if (!existing || observation.current) unique.set(identity, normalized);
  }

  // Older SUN snapshots may not carry event ids. When the explicit current
  // point repeats the newest timeline coordinate, keep one observed event.
  const current = Array.from(unique.values()).find((item) => item.current);
  if (current) {
    for (const [key, item] of unique) {
      if (item === current || item.eventId) continue;
      const sameCoordinate = Math.abs(item.lat - current.lat) < 0.00005 && Math.abs(item.lng - current.lng) < 0.00005;
      const sameTimestamp = !current.at || !item.at || current.at === item.at;
      if (sameCoordinate && sameTimestamp) unique.delete(key);
    }
  }

  const clusters = new Map<string, SunLocationCluster>();
  for (const observation of unique.values()) {
    const clusterKey = `${observation.lat.toFixed(4)}:${observation.lng.toFixed(4)}`;
    const kind = classifySunLocationEvidence(observation.source, true) as "measured" | "approximate";
    const accuracy = Number(observation.accuracyM);
    const accuracyM = Number.isFinite(accuracy) && accuracy > 0 ? accuracy : null;
    const existing = clusters.get(clusterKey);
    if (!existing) {
      clusters.set(clusterKey, {
        id: `sun-location-${clusterKey}`,
        lat: observation.lat,
        lng: observation.lng,
        city: String(observation.city || "Ubicación reportada"),
        country: String(observation.country || "--"),
        count: 1,
        risk: riskFromResult(observation.result),
        result: String(observation.result || "REPORTED"),
        lastSeen: String(observation.at || ""),
        current: Boolean(observation.current),
        kind,
        sourceLabel: describeSunLocationEvidence(kind, accuracyM),
        accuracyM,
      });
      continue;
    }
    existing.count += 1;
    existing.risk += riskFromResult(observation.result);
    if (observation.current || Date.parse(String(observation.at || "")) > Date.parse(existing.lastSeen || "")) {
      existing.city = String(observation.city || existing.city);
      existing.country = String(observation.country || existing.country);
      existing.result = String(observation.result || existing.result);
      existing.lastSeen = String(observation.at || existing.lastSeen);
      existing.current = existing.current || Boolean(observation.current);
      existing.kind = kind;
      existing.accuracyM = accuracyM;
      existing.sourceLabel = describeSunLocationEvidence(kind, accuracyM);
    }
  }
  return Array.from(clusters.values());
}

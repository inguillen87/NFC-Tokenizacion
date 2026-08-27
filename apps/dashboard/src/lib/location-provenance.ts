export type LocationProvenanceClass =
  | "consented_gps"
  | "network_approx"
  | "mixed_approx"
  | "other_reported";

const CONSENTED_GPS_SOURCES = new Set([
  "browser_gps_approximate_consent",
  "browser_approximate_consent",
]);

const NETWORK_APPROX_SOURCES = new Set([
  "ip_geo",
  "ip_approx",
  "edge_ip_approx",
]);

const MIXED_APPROX_SOURCES = new Set([
  "mixed_or_unknown_approx",
  "unknown",
  "",
]);

export function classifyLocationProvenance(value?: string | null): LocationProvenanceClass {
  const source = String(value || "").trim().toLowerCase();
  if (CONSENTED_GPS_SOURCES.has(source)) return "consented_gps";
  if (NETWORK_APPROX_SOURCES.has(source)) return "network_approx";
  if (MIXED_APPROX_SOURCES.has(source)) return "mixed_approx";
  return "other_reported";
}

export function locationProvenanceLabel(value?: string | null) {
  const classification = classifyLocationProvenance(value);
  if (classification === "consented_gps") return "GPS consentido (aproximado)";
  if (classification === "network_approx") return "Red/IP (aproximada)";
  if (classification === "mixed_approx") return "Fuentes mixtas o no clasificadas";
  return "Otra coordenada reportada";
}

export type TrustMapSourceMode = "public-vector" | "self-hosted-vector" | "public-raster" | "self-hosted-raster" | "pmtiles-ready";

export type TrustMapSourceConfig = {
  id: string;
  mode: TrustMapSourceMode;
  styleUrl: string;
  darkStyleUrl: string;
  rasterTileTemplate?: string;
  pmtilesUrl?: string;
  attribution: string;
  badge: string;
  detail: string;
};

export type TrustMapSourceOverrides = Partial<Pick<TrustMapSourceConfig, "styleUrl" | "darkStyleUrl" | "rasterTileTemplate" | "pmtilesUrl" | "attribution" | "badge" | "detail">>;

export const DEFAULT_PUBLIC_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
export const DEFAULT_PUBLIC_DARK_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
const DEFAULT_ATTRIBUTION = "OpenFreeMap © OpenMapTiles · Data from OpenStreetMap";
const REQUIRED_TILE_TOKENS = ["{z}", "{x}", "{y}"] as const;
const KEYED_TILE_PATTERN = /(?:[?&](?:api[_-]?key|apikey|access[_-]?token|token|key)=|\{(?:api[_-]?key|apikey|access[_-]?token|token|key)\})/i;
const KEY_REQUIRED_HOST_PATTERN = /(?:^|\.)(?:basemaps\.cartocdn\.com|cartocdn\.com|stadiamaps\.com|maptiler\.com|mapbox\.com)$/i;

function publicEnv(name: string) {
  if (typeof process === "undefined") return "";
  // Next.js only exposes browser variables when access is statically analyzable.
  // Keep the public names explicit so production overrides are actually bundled.
  if (name === "NEXT_PUBLIC_NEXID_RASTER_TILE_TEMPLATE") return String(process.env.NEXT_PUBLIC_NEXID_RASTER_TILE_TEMPLATE || "").trim();
  if (name === "NEXT_PUBLIC_NEXID_MAP_STYLE_URL") return String(process.env.NEXT_PUBLIC_NEXID_MAP_STYLE_URL || "").trim();
  if (name === "NEXT_PUBLIC_NEXID_DARK_MAP_STYLE_URL") return String(process.env.NEXT_PUBLIC_NEXID_DARK_MAP_STYLE_URL || "").trim();
  if (name === "NEXT_PUBLIC_NEXID_PMTILES_URL") return String(process.env.NEXT_PUBLIC_NEXID_PMTILES_URL || "").trim();
  if (name === "NEXT_PUBLIC_NEXID_MAP_ATTRIBUTION") return String(process.env.NEXT_PUBLIC_NEXID_MAP_ATTRIBUTION || "").trim();
  if (typeof window !== "undefined") return "";
  if (name === "NEXID_RASTER_TILE_TEMPLATE") return String(process.env.NEXID_RASTER_TILE_TEMPLATE || "").trim();
  if (name === "NEXID_MAP_STYLE_URL") return String(process.env.NEXID_MAP_STYLE_URL || "").trim();
  if (name === "NEXID_DARK_MAP_STYLE_URL") return String(process.env.NEXID_DARK_MAP_STYLE_URL || "").trim();
  if (name === "NEXID_PMTILES_URL") return String(process.env.NEXID_PMTILES_URL || "").trim();
  if (name === "NEXID_MAP_ATTRIBUTION") return String(process.env.NEXID_MAP_ATTRIBUTION || "").trim();
  return "";
}

function isSelfHostedUrl(value: string) {
  return value.startsWith("/") || value.startsWith("./") || value.startsWith("../") || /^https?:\/\/(localhost|127\.0\.0\.1|[^/]+\.nexid\.lat)/i.test(value);
}

function isLocalDevelopmentHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function isNoKeyRasterTileTemplate(value: unknown) {
  const template = String(value || "").trim();
  if (!template || !REQUIRED_TILE_TOKENS.every((token) => template.includes(token))) return false;
  if (KEYED_TILE_PATTERN.test(template)) return false;
  if (template.startsWith("/") || template.startsWith("./") || template.startsWith("../")) return true;
  try {
    const parsed = new URL(template);
    if (KEY_REQUIRED_HOST_PATTERN.test(parsed.hostname)) return false;
    return parsed.protocol === "https:" || (parsed.protocol === "http:" && isLocalDevelopmentHost(parsed.hostname));
  } catch {
    return false;
  }
}

export function normalizeNoKeyRasterTileTemplate(value: unknown) {
  const template = String(value || "").trim();
  return isNoKeyRasterTileTemplate(template) ? template : undefined;
}

export function isNoKeyMapStyleUrl(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw || KEYED_TILE_PATTERN.test(raw)) return false;
  if (raw.startsWith("/") || raw.startsWith("./") || raw.startsWith("../")) return true;
  try {
    const parsed = new URL(raw);
    if (KEY_REQUIRED_HOST_PATTERN.test(parsed.hostname)) return false;
    return parsed.protocol === "https:" || (parsed.protocol === "http:" && isLocalDevelopmentHost(parsed.hostname));
  } catch {
    return false;
  }
}

export function normalizeNoKeyMapStyleUrl(value: unknown, fallback = DEFAULT_PUBLIC_MAP_STYLE_URL) {
  const raw = String(value || "").trim();
  return isNoKeyMapStyleUrl(raw) ? raw : fallback;
}

export function resolveTrustMapSource(overrides: TrustMapSourceOverrides = {}): TrustMapSourceConfig {
  const pmtilesUrl = overrides.pmtilesUrl
    || publicEnv("NEXT_PUBLIC_NEXID_PMTILES_URL")
    || publicEnv("NEXID_PMTILES_URL");
  const requestedStyleUrl = overrides.styleUrl
    || publicEnv("NEXT_PUBLIC_NEXID_MAP_STYLE_URL")
    || publicEnv("NEXID_MAP_STYLE_URL")
    || DEFAULT_PUBLIC_MAP_STYLE_URL;
  const requestedDarkStyleUrl = overrides.darkStyleUrl
    || publicEnv("NEXT_PUBLIC_NEXID_DARK_MAP_STYLE_URL")
    || publicEnv("NEXID_DARK_MAP_STYLE_URL")
    || DEFAULT_PUBLIC_DARK_MAP_STYLE_URL;
  const styleUrl = normalizeNoKeyMapStyleUrl(requestedStyleUrl);
  const darkStyleUrl = normalizeNoKeyMapStyleUrl(requestedDarkStyleUrl, DEFAULT_PUBLIC_DARK_MAP_STYLE_URL);
  const requestedRasterTileTemplate = overrides.rasterTileTemplate
    || publicEnv("NEXT_PUBLIC_NEXID_RASTER_TILE_TEMPLATE")
    || publicEnv("NEXID_RASTER_TILE_TEMPLATE");
  const rasterTileTemplate = normalizeNoKeyRasterTileTemplate(requestedRasterTileTemplate);
  const usedPublicFallback = styleUrl !== String(requestedStyleUrl || "").trim()
    || darkStyleUrl !== String(requestedDarkStyleUrl || "").trim()
    || (Boolean(requestedRasterTileTemplate) && !rasterTileTemplate);

  const mode: TrustMapSourceMode = pmtilesUrl
    ? "pmtiles-ready"
    : rasterTileTemplate
      ? isSelfHostedUrl(rasterTileTemplate) ? "self-hosted-raster" : "public-raster"
      : isSelfHostedUrl(styleUrl) ? "self-hosted-vector" : "public-vector";

  const badge = overrides.badge
    || (mode === "pmtiles-ready"
      ? "PMTiles ready"
      : mode.startsWith("self-hosted")
        ? "Self-hosted map"
        : mode === "public-vector"
          ? "OpenFreeMap · OpenStreetMap"
          : "No-key raster map");
  const detail = overrides.detail
    || (mode === "pmtiles-ready"
      ? "Contrato preparado para tiles propios por tenant; raster fallback activo hasta montar el renderer vectorial."
      : mode.startsWith("self-hosted")
        ? "Mapa propio servido desde nexID o infraestructura del tenant."
        : mode === "public-vector"
          ? "Mapa vectorial real de OpenFreeMap con datos OpenStreetMap, sin API key; reemplazable por PMTiles o infraestructura propia."
          : "Mapa raster real configurado sin API key; reemplazable por PMTiles o infraestructura propia.");

  return {
    id: mode,
    mode,
    styleUrl,
    darkStyleUrl,
    rasterTileTemplate,
    pmtilesUrl: pmtilesUrl || undefined,
    attribution: usedPublicFallback
      ? DEFAULT_ATTRIBUTION
      : overrides.attribution || publicEnv("NEXT_PUBLIC_NEXID_MAP_ATTRIBUTION") || publicEnv("NEXID_MAP_ATTRIBUTION") || DEFAULT_ATTRIBUTION,
    badge,
    detail,
  };
}

export function formatTrustTileUrl(template: string, zoom: number, x: number, y: number) {
  return template
    .replaceAll("{z}", String(zoom))
    .replaceAll("{x}", String(x))
    .replaceAll("{y}", String(y));
}

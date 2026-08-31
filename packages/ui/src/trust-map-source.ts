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
export const DEFAULT_PUBLIC_RASTER_TEMPLATE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
export const DEFAULT_PUBLIC_RASTER_ATTRIBUTION = "Esri, HERE, Garmin, USGS, OpenStreetMap contributors, GIS User Community";
const DEFAULT_VECTOR_ATTRIBUTION = "OpenFreeMap © OpenMapTiles · Data from OpenStreetMap";
const REQUIRED_TILE_TOKENS = ["{z}", "{x}", "{y}"] as const;
const KEYED_TILE_PATTERN = /(?:[?&](?:api[_-]?key|apikey|access[_-]?token|token|key)=|\{(?:api[_-]?key|apikey|access[_-]?token|token|key)\})/i;
const KEY_REQUIRED_HOST_PATTERN = /(?:^|\.)(?:basemaps\.cartocdn\.com|cartocdn\.com|stadiamaps\.com|maptiler\.com|mapbox\.com)$/i;
const LEGACY_LOW_FIDELITY_RASTER_TEMPLATE = "voyager_nolabels";
const LEGACY_CARTO_RASTER_HOST = "basemaps.cartocdn.com";
const LEGACY_CARTO_ATTRIBUTION = /(?:^|\s|\/)carto(?:\s|\/|$)/i;

function publicEnv(name: string) {
  if (typeof process === "undefined") return "";
  // Next.js only exposes browser variables when access is statically analyzable.
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

function replaceLegacyRaster(value: string) {
  const isLegacyAnonymousCarto = value.includes(LEGACY_CARTO_RASTER_HOST)
    && /\/(?:dark_all|light_all)\//i.test(value);
  return value.includes(LEGACY_LOW_FIDELITY_RASTER_TEMPLATE) || isLegacyAnonymousCarto
    ? DEFAULT_PUBLIC_RASTER_TEMPLATE
    : value;
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
  const template = replaceLegacyRaster(String(value || "").trim());
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
  const rawRasterTileTemplate = overrides.rasterTileTemplate
    || publicEnv("NEXT_PUBLIC_NEXID_RASTER_TILE_TEMPLATE")
    || publicEnv("NEXID_RASTER_TILE_TEMPLATE");
  const requestedRasterTileTemplate = replaceLegacyRaster(String(rawRasterTileTemplate || "").trim());
  const rasterTileTemplate = normalizeNoKeyRasterTileTemplate(requestedRasterTileTemplate);
  const configuredAttribution = overrides.attribution
    || publicEnv("NEXT_PUBLIC_NEXID_MAP_ATTRIBUTION")
    || publicEnv("NEXID_MAP_ATTRIBUTION");
  const usesDefaultPublicRaster = rasterTileTemplate === DEFAULT_PUBLIC_RASTER_TEMPLATE;
  const usedPublicFallback = styleUrl !== String(requestedStyleUrl || "").trim()
    || darkStyleUrl !== String(requestedDarkStyleUrl || "").trim()
    || (Boolean(rawRasterTileTemplate) && !rasterTileTemplate);

  const mode: TrustMapSourceMode = pmtilesUrl
    ? "pmtiles-ready"
    : rasterTileTemplate
      ? isSelfHostedUrl(rasterTileTemplate) ? "self-hosted-raster" : "public-raster"
      : isSelfHostedUrl(styleUrl) ? "self-hosted-vector" : "public-vector";

  const badge = overrides.badge
    || (mode === "pmtiles-ready"
      ? "PMTiles ready"
      : mode === "self-hosted-raster"
        ? "Self-hosted tiles"
        : mode === "self-hosted-vector"
          ? "Self-hosted map"
          : usesDefaultPublicRaster
            ? "Esri public raster"
            : mode === "public-raster"
              ? "Public raster source"
              : "OpenFreeMap · OpenStreetMap");
  const detail = overrides.detail
    || (mode === "pmtiles-ready"
      ? "Contrato preparado para tiles propios por tenant; el renderer usa su fuente configurada hasta activar PMTiles."
      : mode.startsWith("self-hosted")
        ? "Mapa propio servido desde nexID o infraestructura del tenant."
        : usesDefaultPublicRaster
          ? "Endpoint raster publico de Esri sin token de aplicacion configurado, con atribucion visible; reemplazable por PMTiles o tiles propios."
          : mode === "public-raster"
            ? "Fuente raster publica configurada por entorno; disponibilidad, licencia y atribucion dependen del proveedor configurado."
            : "Mapa vectorial real de OpenFreeMap con datos OpenStreetMap, sin API key; reemplazable por PMTiles o infraestructura propia.");

  const attribution = usesDefaultPublicRaster && (!configuredAttribution || LEGACY_CARTO_ATTRIBUTION.test(configuredAttribution))
    ? DEFAULT_PUBLIC_RASTER_ATTRIBUTION
    : configuredAttribution
      || (rasterTileTemplate
        ? isSelfHostedUrl(rasterTileTemplate) ? "nexID / tenant tiles" : "External raster provider (configure attribution)"
        : DEFAULT_VECTOR_ATTRIBUTION);

  return {
    id: mode,
    mode,
    styleUrl,
    darkStyleUrl,
    rasterTileTemplate,
    pmtilesUrl: pmtilesUrl || undefined,
    attribution: usedPublicFallback && !rasterTileTemplate ? DEFAULT_VECTOR_ATTRIBUTION : attribution,
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

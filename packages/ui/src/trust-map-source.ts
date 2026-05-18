export type TrustMapSourceMode = "public-raster" | "self-hosted-raster" | "pmtiles-ready";

export type TrustMapSourceConfig = {
  id: string;
  mode: TrustMapSourceMode;
  rasterTileTemplate: string;
  pmtilesUrl?: string;
  attribution: string;
  badge: string;
  detail: string;
};

export type TrustMapSourceOverrides = Partial<Pick<TrustMapSourceConfig, "rasterTileTemplate" | "pmtilesUrl" | "attribution" | "badge" | "detail">>;

const DEFAULT_PUBLIC_RASTER_TEMPLATE = "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png";
const LEGACY_LOW_FIDELITY_RASTER_TEMPLATE = "voyager_nolabels";
const DEFAULT_ATTRIBUTION = "CARTO / OpenStreetMap";

function publicEnv(name: string) {
  if (typeof process === "undefined") return "";
  return String(process.env?.[name] || "").trim();
}

function isSelfHostedUrl(value: string) {
  return value.startsWith("/") || value.startsWith("./") || value.startsWith("../") || /^https?:\/\/(localhost|127\.0\.0\.1|[^/]+\.nexid\.lat)/i.test(value);
}

function normalizeRasterTileTemplate(value: string) {
  return value.includes(LEGACY_LOW_FIDELITY_RASTER_TEMPLATE) ? DEFAULT_PUBLIC_RASTER_TEMPLATE : value;
}

export function resolveTrustMapSource(overrides: TrustMapSourceOverrides = {}): TrustMapSourceConfig {
  const pmtilesUrl = overrides.pmtilesUrl
    || publicEnv("NEXT_PUBLIC_NEXID_PMTILES_URL")
    || publicEnv("NEXID_PMTILES_URL");
  const rasterTileTemplate = normalizeRasterTileTemplate(overrides.rasterTileTemplate
    || publicEnv("NEXT_PUBLIC_NEXID_RASTER_TILE_TEMPLATE")
    || publicEnv("NEXID_RASTER_TILE_TEMPLATE")
    || DEFAULT_PUBLIC_RASTER_TEMPLATE);

  const mode: TrustMapSourceMode = pmtilesUrl
    ? "pmtiles-ready"
    : isSelfHostedUrl(rasterTileTemplate)
      ? "self-hosted-raster"
      : "public-raster";

  const badge = overrides.badge
    || (mode === "pmtiles-ready" ? "PMTiles ready" : mode === "self-hosted-raster" ? "Self-hosted tiles" : "Free raster fallback");
  const detail = overrides.detail
    || (mode === "pmtiles-ready"
      ? "Contrato preparado para tiles propios por tenant; raster fallback activo hasta montar el renderer vectorial."
      : mode === "self-hosted-raster"
        ? "Tiles propios servidos desde nexID o infraestructura del tenant."
        : "Fallback publico sin API key con calles y etiquetas reales; reemplazable por PMTiles o tiles propios.");

  return {
    id: mode,
    mode,
    rasterTileTemplate,
    pmtilesUrl: pmtilesUrl || undefined,
    attribution: overrides.attribution || publicEnv("NEXT_PUBLIC_NEXID_MAP_ATTRIBUTION") || publicEnv("NEXID_MAP_ATTRIBUTION") || DEFAULT_ATTRIBUTION,
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

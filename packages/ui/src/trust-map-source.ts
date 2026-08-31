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

export const DEFAULT_PUBLIC_RASTER_TEMPLATE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
export const DEFAULT_PUBLIC_RASTER_ATTRIBUTION = "Esri, HERE, Garmin, USGS, OpenStreetMap contributors, GIS User Community";
const LEGACY_LOW_FIDELITY_RASTER_TEMPLATE = "voyager_nolabels";
const LEGACY_CARTO_RASTER_HOST = "basemaps.cartocdn.com";
const LEGACY_CARTO_ATTRIBUTION = /(?:^|\s|\/)carto(?:\s|\/|$)/i;

function publicEnv(name: string) {
  if (typeof process === "undefined") return "";
  return String(process.env?.[name] || "").trim();
}

function isSelfHostedUrl(value: string) {
  return value.startsWith("/") || value.startsWith("./") || value.startsWith("../") || /^https?:\/\/(localhost|127\.0\.0\.1|[^/]+\.nexid\.lat)/i.test(value);
}

function normalizeRasterTileTemplate(value: string) {
  const isLegacyAnonymousCarto = value.includes(LEGACY_CARTO_RASTER_HOST)
    && /\/(?:dark_all|light_all)\//i.test(value);
  return value.includes(LEGACY_LOW_FIDELITY_RASTER_TEMPLATE) || isLegacyAnonymousCarto
    ? DEFAULT_PUBLIC_RASTER_TEMPLATE
    : value;
}

export function resolveTrustMapSource(overrides: TrustMapSourceOverrides = {}): TrustMapSourceConfig {
  const pmtilesUrl = overrides.pmtilesUrl
    || publicEnv("NEXT_PUBLIC_NEXID_PMTILES_URL")
    || publicEnv("NEXID_PMTILES_URL");
  const rasterTileTemplate = normalizeRasterTileTemplate(overrides.rasterTileTemplate
    || publicEnv("NEXT_PUBLIC_NEXID_RASTER_TILE_TEMPLATE")
    || publicEnv("NEXID_RASTER_TILE_TEMPLATE")
    || DEFAULT_PUBLIC_RASTER_TEMPLATE);
  const configuredAttribution = overrides.attribution
    || publicEnv("NEXT_PUBLIC_NEXID_MAP_ATTRIBUTION")
    || publicEnv("NEXID_MAP_ATTRIBUTION");
  const usesDefaultPublicRaster = rasterTileTemplate === DEFAULT_PUBLIC_RASTER_TEMPLATE;

  const mode: TrustMapSourceMode = pmtilesUrl
    ? "pmtiles-ready"
    : isSelfHostedUrl(rasterTileTemplate)
      ? "self-hosted-raster"
      : "public-raster";

  const badge = overrides.badge
    || (mode === "pmtiles-ready"
      ? "PMTiles ready"
      : mode === "self-hosted-raster"
        ? "Self-hosted tiles"
        : usesDefaultPublicRaster
          ? "Esri public raster"
          : "Public raster source");
  const detail = overrides.detail
    || (mode === "pmtiles-ready"
      ? "Contrato preparado para tiles propios por tenant; raster fallback activo hasta montar el renderer vectorial."
      : mode === "self-hosted-raster"
        ? "Tiles propios servidos desde nexID o infraestructura del tenant."
        : usesDefaultPublicRaster
          ? "Endpoint raster publico de Esri sin token de aplicacion configurado, con atribucion visible; reemplazable por PMTiles o tiles propios."
          : "Fuente raster publica configurada por entorno; disponibilidad, licencia y atribucion dependen del proveedor configurado.");

  const attribution = usesDefaultPublicRaster && (!configuredAttribution || LEGACY_CARTO_ATTRIBUTION.test(configuredAttribution))
    ? DEFAULT_PUBLIC_RASTER_ATTRIBUTION
    : configuredAttribution
      || (isSelfHostedUrl(rasterTileTemplate) ? "nexID / tenant tiles" : "External raster provider (configure attribution)");

  return {
    id: mode,
    mode,
    rasterTileTemplate,
    pmtilesUrl: pmtilesUrl || undefined,
    attribution,
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

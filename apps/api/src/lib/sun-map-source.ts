export const DEFAULT_PUBLIC_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
export const DEFAULT_PUBLIC_DARK_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
export const DEFAULT_PUBLIC_MAP_ATTRIBUTION = "OpenFreeMap © OpenMapTiles · Data from OpenStreetMap";

const KEY_REQUIRED_HOSTS = [
  "basemaps.cartocdn.com",
  "cartocdn.com",
  "stadiamaps.com",
  "maptiler.com",
  "mapbox.com",
] as const;

export function isNoKeyPublicRasterTileTemplate(value: unknown): boolean {
  const raw = String(value || "").trim();
  if (!raw || !raw.includes("{z}") || !raw.includes("{x}") || !raw.includes("{y}")) return false;
  if (/[?&](?:api[_-]?key|access[_-]?token|token|key)=/i.test(raw) || /\{(?:api[_-]?key|access[_-]?token|token|key)\}/i.test(raw)) return false;
  if (raw.startsWith("/") || raw.startsWith("./") || raw.startsWith("../")) return true;
  try {
    const parsed = new URL(raw);
    const hostname = parsed.hostname.toLowerCase();
    if (KEY_REQUIRED_HOSTS.some((blocked) => hostname === blocked || hostname.endsWith(`.${blocked}`))) return false;
    return parsed.protocol === "https:"
      || (parsed.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(hostname));
  } catch {
    return false;
  }
}

export function normalizePublicRasterTileTemplate(value: unknown): string {
  return isNoKeyPublicRasterTileTemplate(value) ? String(value).trim() : "";
}

export function isNoKeyPublicMapStyleUrl(value: unknown): boolean {
  const raw = String(value || "").trim();
  if (!raw) return false;
  if (/[?&](?:api[_-]?key|access[_-]?token|token|key)=/i.test(raw) || /\{(?:api[_-]?key|access[_-]?token|token|key)\}/i.test(raw)) return false;
  if (raw.startsWith("/") || raw.startsWith("./") || raw.startsWith("../")) return true;
  try {
    const parsed = new URL(raw);
    const hostname = parsed.hostname.toLowerCase();
    if (KEY_REQUIRED_HOSTS.some((blocked) => hostname === blocked || hostname.endsWith(`.${blocked}`))) return false;
    return parsed.protocol === "https:"
      || (parsed.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(hostname));
  } catch {
    return false;
  }
}

export function normalizePublicMapStyleUrl(value: unknown, fallback = DEFAULT_PUBLIC_MAP_STYLE_URL): string {
  return isNoKeyPublicMapStyleUrl(value) ? String(value).trim() : fallback;
}

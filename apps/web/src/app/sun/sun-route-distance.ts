export type SunGeoRoute = {
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
};

export function haversineKm(
  fromLat?: number | null,
  fromLng?: number | null,
  toLat?: number | null,
  toLng?: number | null,
) {
  if (fromLat == null || fromLng == null || toLat == null || toLng == null) return null;
  const radiusKm = 6371;
  const dLat = ((toLat - fromLat) * Math.PI) / 180;
  const dLng = ((toLng - fromLng) * Math.PI) / 180;
  const lat1 = (fromLat * Math.PI) / 180;
  const lat2 = (toLat * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function fmtDistance(value: number | null, locale: Intl.LocalesArgument = "es-AR") {
  if (value == null || !Number.isFinite(value)) return "N/A";
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: value >= 100 ? 0 : 1 }).format(value)} km`;
}

/**
 * The SUN summary describes origin -> current tap. If that route is available,
 * the map must use the same canonical leg instead of selecting an intermediate
 * timeline segment that happens to share the product UID.
 */
export function selectCanonicalSunMapRoutes<T extends SunGeoRoute>(
  originToCurrentTapRoute: T | null,
  fallbackRoutes: readonly T[],
) {
  return originToCurrentTapRoute ? [originToCurrentTapRoute] : [...fallbackRoutes];
}

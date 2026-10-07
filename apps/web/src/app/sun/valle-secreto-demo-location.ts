/** Demo observations are separate from SUN evidence and never enter /sun/context. */
export const MENDOZA_DEMO_POINT = { lat: -32.89, lng: -68.84 } as const;

export function approximateDemoPosition(coords: Pick<GeolocationCoordinates, "latitude" | "longitude" | "accuracy">) {
  const { latitude, longitude, accuracy } = coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 85 || Math.abs(longitude) > 180
    || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 1_000_000) return null;
  return { lat: Math.round(latitude * 100) / 100, lng: Math.round(longitude * 100) / 100, accuracyM: Math.max(150, accuracy) };
}

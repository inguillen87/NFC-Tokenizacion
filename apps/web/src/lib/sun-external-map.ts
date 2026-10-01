type MapPoint = { lat: number; lng: number; source?: string | null };
const consented = new Set(['browser_geolocation_approximate_consent', 'browser_gps_approximate_consent']);
function valid(point: MapPoint | null | undefined): point is MapPoint {
  return Boolean(point && Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180);
}
function coordinate(point: MapPoint, approximate: boolean) {
  return `${Number(point.lat.toFixed(approximate ? 2 : 6))},${Number(point.lng.toFixed(approximate ? 2 : 6))}`;
}
/** Only public coordinates are exported, never the SUN URL, event, capability, UID or labels. */
export function googlePointLink(point: MapPoint | null, kind: 'origin' | 'tap'): string | null {
  if (!valid(point) || point.source === 'demo') return null;
  if (kind === 'origin') {
    const url = new URL('https://www.google.com/maps/search/');
    url.search = new URLSearchParams({ api: '1', query: coordinate(point, false) }).toString();
    return url.href;
  }
  if (consented.has(point.source || '')) {
    const url = new URL('https://www.google.com/maps/search/');
    url.search = new URLSearchParams({ api: '1', query: coordinate(point, true) }).toString();
    return url.href;
  }
  if (['ip_geo', 'edge_ip_approx'].includes(point.source || '')) {
    const url = new URL('https://www.google.com/maps/@');
    url.search = new URLSearchParams({ api: '1', map_action: 'map', center: coordinate(point, true), zoom: '6' }).toString();
    return url.href;
  }
  return null;
}

/** Google represents two endpoints as suggested directions, not an observed product journey. */
export function googleComparisonLink(origin: MapPoint | null, tap: MapPoint | null): string | null {
  if (!valid(origin) || !valid(tap) || origin.source === 'demo' || !consented.has(tap.source || '')) return null;
  const url = new URL('https://www.google.com/maps/dir/');
  url.search = new URLSearchParams({ api: '1', origin: coordinate(origin, false), destination: coordinate(tap, true) }).toString();
  return url.href;
}

/** Insets use the actual map canvas so expansion does not keep phone-sized framing. */
export function sunMapInsets(width: number, height: number) {
  const compact = width < 640;
  return { top: Math.min(compact ? 76 : 82, Math.max(36, height * 0.3)), right: Math.min(compact ? 48 : 72, Math.max(24, width * 0.22)), bottom: Math.min(compact ? 76 : 72, Math.max(36, height * 0.3)), left: Math.min(compact ? 48 : 72, Math.max(24, width * 0.22)) };
}

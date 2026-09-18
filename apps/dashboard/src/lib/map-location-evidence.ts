import { strictCoordinatePair } from "./geo-coordinates";
import { classifyLocationProvenance } from "./location-provenance";
export type MapSourceFilter = "all" | "phone" | "network" | "other";
export type LocationEvent = { lat?: number | null; lng?: number | null; locationSource?: string | null };
const DECLARED_SOURCES = new Set(["tenant_default","tenant_origin","product_origin","declared_origin","product_passport_declared","default_location","fallback_city"]);
export function isDeclaredMapOrigin(source?: string | null) { return DECLARED_SOURCES.has(String(source || "").trim().toLowerCase()); }
export function mapLocationClass(event: LocationEvent): MapSourceFilter | "none" {
  if (isDeclaredMapOrigin(event.locationSource) || !strictCoordinatePair(event.lat,event.lng)) return "none";
  const kind=classifyLocationProvenance(event.locationSource);
  return kind==="consented_gps" ? "phone" : kind==="network_approx" ? "network" : "other";
}
export function summarizeMapLocations<T extends LocationEvent>(events: readonly T[]) {
  const counts={phone:0,network:0,other:0,none:0};
  for(const event of events) counts[mapLocationClass(event) as keyof typeof counts]++;
  return counts;
}
export function filterMapLocations<T extends LocationEvent>(events: readonly T[],filter:MapSourceFilter):T[] {
  return events.filter(event=>{const kind=mapLocationClass(event);return kind!=="none" && (filter==="all" || kind===filter);});
}
export function mapLocationDescription(event:LocationEvent) {
  const kind=mapLocationClass(event);
  if(kind==="phone")return "Teléfono · zona aproximada compartida con permiso";
  if(kind==="network")return "Red/IP · puede corresponder a otra ciudad, no al teléfono";
  if(kind==="other")return "Coordenada reportada · fuente o consentimiento sin verificar";
  return "Sin ubicación del evento verificable";
}

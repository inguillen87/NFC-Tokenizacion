import { publishTenantTapRealtimeProjection } from "./realtime-tap-projection";
import { persistSunRequestLocation } from "./sun-tap-location";

type LocationInput = Parameters<typeof persistSunRequestLocation>[0];
type LocationRealtimeDependencies = {
  persist: typeof persistSunRequestLocation;
  publish: typeof publishTenantTapRealtimeProjection;
  warn: (reason: string) => void;
};

const dependencies: LocationRealtimeDependencies = {
  persist: persistSunRequestLocation,
  publish: publishTenantTapRealtimeProjection,
  warn: (reason) => console.warn("[sun_location_realtime_unavailable]", JSON.stringify({ reason })),
};

/**
 * The SUN scan has already committed and published its initial projection.
 * Request-location enrichment happens later. Publish that persisted revision
 * under the same event id so live consumers replace it instead of counting
 * another tap. No coordinates or tenant scope are taken from the notification.
 */
export async function persistSunRequestLocationAndPublish(
  input: LocationInput,
  services: LocationRealtimeDependencies = dependencies,
): Promise<boolean> {
  const persisted = await services.persist(input);
  if (!persisted) return false;

  try {
    const publication = await services.publish(input.eventId);
    if (!publication.projected || !publication.distributed) {
      services.warn(publication.projected ? "distribution_unavailable" : "projection_unavailable");
    }
  } catch {
    // Realtime failure cannot undo successful location enrichment or turn the
    // already recorded physical tap into an apparent scan failure.
    services.warn("publication_failed");
  }
  return true;
}

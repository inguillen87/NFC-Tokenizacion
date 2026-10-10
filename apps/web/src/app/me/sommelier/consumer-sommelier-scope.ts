import { parseConsumerTap } from "../_components/consumer-taps-model";
import { parseTenantActionConfiguration } from "../../sun/tenant-action-availability";

export function consumerSommelierEventId(value: unknown): string | null {
  return typeof value === "string" && /^[1-9]\d{0,15}$/.test(value) && Number.isSafeInteger(Number(value)) ? value : null;
}

export type ConsumerSommelierScope =
  | { state: "ready"; eventId?: string; productName: string; brandName: string }
  | { state: "unavailable" | "unpublished" };

/** Product names in the URL never authorize a brand conversation. */
export function consumerSommelierScope(hasEventContext: boolean, eventId: string | null, readingPayload: unknown, configuration: unknown): ConsumerSommelierScope {
  if (!hasEventContext) return { state: "ready", productName: "", brandName: "" };
  if (!eventId || !readingPayload || typeof readingPayload !== "object" || Array.isArray(readingPayload)) return { state: "unavailable" };
  const payload = readingPayload as Record<string, unknown>;
  const reading = payload.ok === true ? parseConsumerTap(payload.item) : null;
  const settings = parseTenantActionConfiguration(configuration);
  if (reading?.id !== eventId || !reading.tenantSlug || !settings || settings.status === "unavailable" || settings.tenantSlug !== reading.tenantSlug) return { state: "unavailable" };
  if (settings.status !== "published" || !settings.allowedActions.includes("sommelier")) return { state: "unpublished" };
  return { state: "ready", eventId, productName: reading.productName || "Producto guardado", brandName: reading.brandName || reading.tenantName || reading.tenantSlug };
}

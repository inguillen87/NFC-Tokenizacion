import { parseTenantActionConfiguration } from "../../sun/tenant-action-availability";

export type ConsumerFeedbackAvailability = "available" | "unpublished" | "unavailable";

/** Historical evidence permits feedback, not a purchase or a new NFC claim.
 * Only the current published setting of that evidence's brand enables it. */
export function consumerFeedbackAvailability(configuration: unknown, expectedTenant: unknown): ConsumerFeedbackAvailability {
  const parsed = parseTenantActionConfiguration(configuration);
  if (typeof expectedTenant !== "string" || !/^[a-z0-9][a-z0-9._-]{0,119}$/.test(expectedTenant)
    || !parsed || parsed.status === "unavailable" || parsed.tenantSlug !== expectedTenant) return "unavailable";
  return parsed.status === "published" && parsed.allowedActions.includes("feedback") ? "available" : "unpublished";
}

export const CONSUMER_FEEDBACK_UNAVAILABLE = {
  checking: "Consultando las opciones actuales de la marca…",
  unpublished: "La marca no está recibiendo opiniones desde este producto en este momento.",
  unavailable: "No pudimos confirmar si la marca recibe opiniones. Podés volver a consultar la ficha.",
} as const;

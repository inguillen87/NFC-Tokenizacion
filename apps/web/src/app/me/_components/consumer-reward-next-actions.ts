import { brandTenantSlug } from "../brands/brands-model";
import { REWARD_UNAVAILABLE_REASONS, rewardTenant, type ConsumerReward } from "./consumer-rewards-model";

/** Consultation only. A next step never authorizes a reservation or prepares a TAP. */
export function rewardNextActions(item: ConsumerReward, { busy, hasQuote }: { busy: boolean; hasQuote: boolean }) {
  if (busy || hasQuote || item.reservation || item.hasClaim || item.reservationNeedsRefresh
    || (item.state !== "locked" && item.state !== "reported")) return null;

  const reasons = item.claimUnavailableReasons;
  if (!Array.isArray(reasons) || reasons.length > REWARD_UNAVAILABLE_REASONS.length) return null;
  for (const reason of reasons) {
    if (typeof reason !== "string" || !(REWARD_UNAVAILABLE_REASONS as readonly string[]).includes(reason)) return null;
  }
  const needsConnection = reasons.includes("brand_connection_required");
  const needsParticipation = reasons.includes("program_participation_required");
  if (!needsConnection && !needsParticipation) return null;

  const tenant = brandTenantSlug(item.tenant);
  // Legacy identifiers are not an inferred slug. Keep the exact reported scope.
  if (!tenant || rewardTenant(tenant) !== item.tenant
    || /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(tenant)) return null;

  return {
    href: "/me/brands?" + new URLSearchParams({ tenant }).toString(),
    label: `Ver mi relación con ${item.brand}`,
    guidance: [
      ...(needsConnection ? ["Revisá el estado de tu relación con la marca. Para solicitar un vínculo, volvé a acercar el teléfono a la etiqueta del producto y elegí «Vincularme con la empresa», sólo si la marca habilita esa opción. Un vínculo pausado o bloqueado puede necesitar revisión de la marca."] : []),
      ...(needsParticipation ? ["Para solicitar participación, volvé a acercar el teléfono a la etiqueta del producto y elegí «Inscribirme en beneficios», sólo si la marca habilita esa opción. La inscripción no confirma que este beneficio ya esté disponible."] : []),
    ],
  };
}

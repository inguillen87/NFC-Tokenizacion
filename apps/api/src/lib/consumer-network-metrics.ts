export function resolveConsumerNetworkTenant(input: { forcedTenantSlug?: string | null; requestedTenantSlug?: string | null }) {
  const forced = String(input.forcedTenantSlug || "").trim().toLowerCase();
  if (forced) return forced;
  return String(input.requestedTenantSlug || "").trim().toLowerCase();
}

export function safeRate(numerator: number, denominator: number) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

export function computeConsumerNetworkOverview(input: {
  totalTaps: number;
  customerActions: number;
  tapsWithKnownActor: number;
  actionsWithKnownActor: number;
  recognizedUnits: number;
  knownActors: number;
  verifiedIdentityActors: number;
  activeTenantMembers: number;
  consentedEmailActors: number;
  consentedWhatsappActors: number;
  consentedPhoneActors: number;
  savedProducts: number;
  riskBlockedClaims: number;
}) {
  const count = (value: unknown) => Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);
  const totalTaps = count(input.totalTaps);
  const customerActions = count(input.customerActions);
  const totalActivity = totalTaps + customerActions;
  const activityWithKnownActor = Math.min(
    totalActivity,
    count(input.tapsWithKnownActor) + count(input.actionsWithKnownActor),
  );
  return {
    totalActivity,
    totalTaps,
    customerActions,
    activityWithKnownActor,
    activityWithoutActor: Math.max(0, totalActivity - activityWithKnownActor),
    actorLinkedActivityRate: safeRate(activityWithKnownActor, totalActivity),
    recognizedUnits: count(input.recognizedUnits),
    knownActors: count(input.knownActors),
    verifiedIdentityActors: count(input.verifiedIdentityActors),
    activeTenantMembers: count(input.activeTenantMembers),
    consentPurpose: "marketing" as const,
    consentedActorsByChannel: {
      email: count(input.consentedEmailActors),
      whatsapp: count(input.consentedWhatsappActors),
      phone: count(input.consentedPhoneActors),
    },
    savedProducts: count(input.savedProducts),
    riskBlockedClaims: count(input.riskBlockedClaims),
  };
}

export function maskConsumerEmail(value: string | null | undefined) {
  const email = String(value || "").trim().toLowerCase();
  if (!email.includes("@")) return "";
  const [name, domain] = email.split("@");
  if (!name || !domain) return "";
  const visible = name.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(2, name.length - 2))}@${domain}`;
}

export function segmentConsumerNetworkMember(row: Record<string, unknown>) {
  const taps = Number(row.tap_count || 0);
  const points = Number(row.lifetime_points || 0);
  const risk = Number(row.risk_taps || 0);
  const whatsapp = Boolean(row.whatsapp_opt_in);
  if (risk > 0) return "needs_trust_recovery";
  if (points >= 500 || taps >= 10) return "vip_loyalist";
  if (whatsapp && taps >= 2) return "promo_ready";
  if (taps > 0) return "post_tap_warm";
  return "new_contact";
}

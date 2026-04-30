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
  anonymousTappers: number;
  registeredConsumers: number;
  tenantMembers: number;
  savedProducts: number;
  riskBlockedClaims: number;
}) {
  const anonymousTappers = Number(input.anonymousTappers || 0);
  const registeredConsumers = Number(input.registeredConsumers || 0);
  const tenantMembers = Number(input.tenantMembers || 0);
  const savedProducts = Number(input.savedProducts || 0);
  const riskBlockedClaims = Number(input.riskBlockedClaims || 0);
  return {
    anonymousTappers,
    registeredConsumers,
    tenantMembers,
    tapToRegistrationRate: safeRate(registeredConsumers, anonymousTappers + registeredConsumers),
    registrationToMembershipRate: safeRate(tenantMembers, registeredConsumers),
    savedProducts,
    riskBlockedClaims,
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

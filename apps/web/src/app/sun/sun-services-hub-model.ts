export type SunServicesRiskState = "clear" | "observed" | "blocked";

export type SunServicesFreshnessState = "fresh" | "stale" | "snapshot" | "demo" | "unknown";

export type SunServicesPolicyAvailability = {
  promotion: boolean;
  purchase: boolean;
  subscribe: boolean;
  claimOrManage: boolean;
  warranty: boolean;
};

type SunServicesHubAvailabilityInput = {
  riskState: SunServicesRiskState;
  policyAvailability: SunServicesPolicyAvailability;
  promotionPublished: boolean;
  purchaseHref?: string | null;
  subscribeHref?: string | null;
  claimOrManageHref?: string | null;
  warrantyHref?: string | null;
};

function hasSafeHref(href?: string | null) {
  const value = href?.trim() || "";
  if (!value) return false;
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return false;
  if (value.startsWith("#")) return /^#[A-Za-z][A-Za-z0-9:_.-]*$/.test(value);
  if (value.startsWith("/") && !value.startsWith("//")) {
    const parsed = new URL(value, "https://nexid.invalid");
    return parsed.origin === "https://nexid.invalid";
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

export function resolveSunServicesHubAvailability({
  riskState,
  policyAvailability,
  promotionPublished,
  purchaseHref,
  subscribeHref,
  claimOrManageHref,
  warrantyHref,
}: SunServicesHubAvailabilityInput) {
  const isBlocked = riskState === "blocked";

  return {
    promotionVisible: promotionPublished && policyAvailability.promotion && !isBlocked,
    promotionSuppressed: promotionPublished && (!policyAvailability.promotion || isBlocked),
    promotionDegraded: promotionPublished && policyAvailability.promotion && riskState === "observed",
    purchase: policyAvailability.purchase && hasSafeHref(purchaseHref),
    subscribe: policyAvailability.subscribe && hasSafeHref(subscribeHref),
    claimOrManage: !isBlocked && policyAvailability.claimOrManage && hasSafeHref(claimOrManageHref),
    warranty: !isBlocked && policyAvailability.warranty && hasSafeHref(warrantyHref),
  };
}

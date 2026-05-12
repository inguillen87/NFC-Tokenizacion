export type MarketplaceCheckoutSignals = {
  activeMembership?: boolean;
  claimedOwnership?: boolean;
  verifiedTap?: boolean;
  demoOverride?: boolean;
  publicNetworkCheckout?: boolean;
};

export function normalizeMarketplaceTenantSlug(input: unknown) {
  return String(input || "").trim().toLowerCase();
}

export function shouldListMarketplaceProduct(input: {
  productStatus?: unknown;
  brandStatus?: unknown;
  brandVisible?: unknown;
  tenantSlug?: unknown;
  tenantFilter?: unknown;
}) {
  const statusOk = String(input.productStatus || "").toLowerCase() === "active";
  const brandStatusOk = String(input.brandStatus || "").toLowerCase() === "active";
  const brandVisible = input.brandVisible === true;
  if (!statusOk || !brandStatusOk || !brandVisible) return false;

  const tenantFilter = normalizeMarketplaceTenantSlug(input.tenantFilter);
  if (!tenantFilter) return true;
  return normalizeMarketplaceTenantSlug(input.tenantSlug) === tenantFilter;
}

export function parseRequestToBuyPayload(payload: Record<string, unknown> | null | undefined) {
  const quantity = Number.parseInt(String(payload?.quantity ?? 1), 10);
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 24) {
    return { ok: false as const, error: "invalid_quantity" };
  }

  const rawMessage = typeof payload?.message === "string" ? payload.message.trim() : "";
  if (rawMessage.length > 500) {
    return { ok: false as const, error: "message_too_long" };
  }

  return {
    ok: true as const,
    value: {
      quantity,
      message: rawMessage || null,
      ageGateAccepted: payload?.ageGateAccepted === true,
    },
  };
}

export function evaluateMarketplaceCheckoutAccess(input: MarketplaceCheckoutSignals) {
  if (input.demoOverride) {
    return { ok: true as const, mode: "demo_passport_context" as const };
  }
  if (input.claimedOwnership) {
    return { ok: true as const, mode: "claimed_owner" as const };
  }
  if (input.activeMembership) {
    return { ok: true as const, mode: "tenant_member" as const };
  }
  if (input.verifiedTap) {
    return { ok: true as const, mode: "verified_tapper" as const };
  }
  if (input.publicNetworkCheckout) {
    return { ok: true as const, mode: "public_network_checkout" as const };
  }
  return {
    ok: false as const,
    error: "passport_context_required" as const,
    requirement: "request_to_buy_requires_membership_claim_or_verified_tap" as const,
  };
}

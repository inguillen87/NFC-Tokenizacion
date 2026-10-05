type SunTenantIdentityInput = {
  identity?: { tenantSlug?: string | null };
  tenant?: { slug?: string | null; name?: string | null };
  product?: { winery?: string | null };
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() && !/[\u0000-\u001f\u007f]/.test(value)
    ? value.trim().slice(0, 200)
    : null;
}

/** Only the server's reported identity can select a company or route a lead. */
export function resolveSunTenantIdentity(contract: SunTenantIdentityInput) {
  const identitySlug = text(contract.identity?.tenantSlug);
  const profileSlug = text(contract.tenant?.slug);
  const reportedSlug = identitySlug || profileSlug;
  const tenantSlug = reportedSlug && /^[a-z0-9][a-z0-9._-]{0,119}$/.test(reportedSlug)
    && !(identitySlug && profileSlug && identitySlug !== profileSlug)
      ? reportedSlug
      : null;
  return {
    tenantSlug,
    brandName: text(contract.product?.winery) || text(contract.tenant?.name) || tenantSlug,
  };
}

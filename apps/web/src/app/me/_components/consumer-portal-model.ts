type ConsumerProduct = { tenant_slug?: string | null; ownership_status?: string | null; ownership_record_status?: string | null };
type ConsumerSessionPayload = { ok?: boolean; authenticated?: boolean } | null | undefined;

export function shouldRedirectToConsumerAuth(session: ConsumerSessionPayload) {
  return !session?.ok || !session?.authenticated;
}

export function resolveMarketplaceTenant(input: { tenantFromQuery?: string; products?: ConsumerProduct[] }) {
  const tenantFromQuery = String(input.tenantFromQuery || "").trim();
  if (tenantFromQuery) return tenantFromQuery;
  const products = Array.isArray(input.products) ? input.products : [];
  const preferredOwned = products.find((item) => String(item.ownership_record_status || item.ownership_status || "").toLowerCase() === "claimed");
  return String(preferredOwned?.tenant_slug || products[0]?.tenant_slug || "").trim();
}

export function ownershipTone(status: string) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "claimed") return "success";
  if (normalized === "blocked_replay" || normalized === "revoked" || normalized === "disputed") return "danger";
  return "neutral";
}

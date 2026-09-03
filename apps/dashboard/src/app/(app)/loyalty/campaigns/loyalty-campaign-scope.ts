export function buildLoyaltyAdminUrl(path: string, tenantScope: string) {
  const tenant = String(tenantScope || "").trim().toLowerCase();
  if (!tenant) return null;
  const normalizedPath = String(path || "").trim().replace(/^\/+/, "");
  if (!normalizedPath || normalizedPath.includes("?") || normalizedPath.includes("#")) return null;
  return `/api/admin/${normalizedPath}?tenant=${encodeURIComponent(tenant)}`;
}

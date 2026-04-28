export function normalizeAlertSeverity(value: string | null | undefined) {
  const severity = String(value || "").trim().toLowerCase();
  if (severity === "low" || severity === "medium" || severity === "high" || severity === "critical") return severity;
  return "";
}

export function normalizeAlertType(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

export function resolveAlertsTenant(params: { forcedTenantSlug?: string | null; requestedTenantSlug?: string | null }) {
  const forced = String(params.forcedTenantSlug || "").trim().toLowerCase();
  if (forced) return forced;
  return String(params.requestedTenantSlug || "").trim().toLowerCase();
}

export function normalizeAlertSeverity(value: string | null | undefined) {
  const severity = String(value || "").trim().toLowerCase();
  if (severity === "low" || severity === "medium" || severity === "high" || severity === "critical") return severity;
  return "";
}

export function normalizeAlertType(value: string | null | undefined) {
  const type = String(value || "").trim().toLowerCase();
  if (
    type === "replay_spike"
    || type === "tamper_rate"
    || type === "invalid_rate"
    || type === "geo_velocity"
    || type === "new_country_for_uid"
    || type === "suspicious_device_cluster"
  ) return type;
  return "";
}

export function resolveAlertsTenant(params: { forcedTenantSlug?: string | null; requestedTenantSlug?: string | null }) {
  const forced = String(params.forcedTenantSlug || "").trim().toLowerCase();
  if (forced) return forced;
  return String(params.requestedTenantSlug || "").trim().toLowerCase();
}

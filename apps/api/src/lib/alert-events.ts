export type AlertType = "replay_spike" | "tamper_rate" | "invalid_rate" | "geo_velocity" | "new_country_for_uid" | "suspicious_device_cluster";

export function normalizeTypeFromResult(result: string): AlertType | null {
  const r = String(result || "").toUpperCase();
  if (r === "REPLAY_SUSPECT" || r === "DUPLICATE") return "replay_spike";
  if (r === "TAMPER" || r === "TAMPERED" || r === "BROKEN") return "tamper_rate";
  if (r && r !== "VALID" && r !== "VALID_CLOSED") return "invalid_rate";
  return null;
}

export function toRealtimeAlertEvent(input: {
  alertId: string;
  tenantId?: string | null;
  tenantSlug?: string | null;
  type: AlertType;
  severity: "low" | "medium" | "high" | "critical";
  createdAt: string;
}) {
  return {
    id: input.alertId,
    event_type: "security_alert.created",
    alert_id: input.alertId,
    tenant_id: input.tenantId || undefined,
    tenant_slug: input.tenantSlug || undefined,
    severity: input.severity,
    type: input.type,
    created_at: input.createdAt,
    result: "SECURITY_ALERT",
    source: "alerts",
  } as const;
}

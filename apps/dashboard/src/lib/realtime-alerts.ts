export type SecurityAlertRealtimePayload = {
  event_type: "security_alert.created";
  alert_id: string;
  tenant_id?: string | null;
  tenant_slug?: string | null;
  type: string;
  severity: "low" | "medium" | "high" | "critical" | string;
  created_at: string;
};

export type AlertCenterItem = {
  id: string;
  event_id?: string | number | null;
  type: string;
  severity: "low" | "medium" | "high" | "critical" | string;
  status: "open" | "acknowledged" | string;
  tenant_slug?: string;
  title?: string;
  created_at?: string;
};

export function isSecurityAlertCreatedEvent(payload: Record<string, unknown>) {
  return String(payload.event_type || "") === "security_alert.created" && Boolean(payload.alert_id);
}

export function toAlertCenterItem(payload: SecurityAlertRealtimePayload): AlertCenterItem {
  return {
    id: String(payload.alert_id),
    type: String(payload.type || "unknown"),
    severity: String(payload.severity || "medium"),
    status: "open",
    tenant_slug: payload.tenant_slug ? String(payload.tenant_slug) : undefined,
    title: `Alert ${String(payload.type || "security_event")}`,
    created_at: String(payload.created_at || new Date().toISOString()),
  };
}

export function mergeAlertCenterItems(current: AlertCenterItem[], incoming: AlertCenterItem, limit = 12) {
  return [incoming, ...current.filter((item) => item.id !== incoming.id)]
    .sort((a, b) => new Date(String(b.created_at || 0)).getTime() - new Date(String(a.created_at || 0)).getTime())
    .slice(0, limit);
}

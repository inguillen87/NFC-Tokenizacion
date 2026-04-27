import { sql } from "./db";
import { publishRealtimeEvent } from "./realtime-events";

type EvaluateInput = {
  eventId: number;
  tenantId?: string | null;
  tenantSlug?: string | null;
  uidHex?: string | null;
  result?: string | null;
  countryCode?: string | null;
  deviceLabel?: string | null;
};

type AlertType = "replay_spike" | "tamper_rate" | "invalid_rate" | "geo_velocity" | "new_country_for_uid" | "suspicious_device_cluster";

function normalizeTypeFromResult(result: string): AlertType | null {
  const r = String(result || "").toUpperCase();
  if (r === "REPLAY_SUSPECT" || r === "DUPLICATE") return "replay_spike";
  if (r === "TAMPER" || r === "TAMPERED" || r === "BROKEN") return "tamper_rate";
  if (r && r !== "VALID" && r !== "VALID_CLOSED") return "invalid_rate";
  return null;
}

async function getRule(tenantId: string | null, type: AlertType) {
  const rows = await sql/*sql*/`
    SELECT *
    FROM alert_rules
    WHERE type = ${type}
      AND enabled = true
      AND (tenant_id = ${tenantId || null} OR tenant_id IS NULL)
    ORDER BY tenant_id NULLS LAST
    LIMIT 1
  `;
  return rows[0] || null;
}

async function createAlert(input: {
  tenantId?: string | null;
  eventId: number;
  type: AlertType;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  details: Record<string, unknown>;
  ruleId?: string | null;
  tenantSlug?: string | null;
}) {
  const rows = await sql/*sql*/`
    INSERT INTO security_alerts (tenant_id, event_id, rule_id, type, severity, title, details)
    VALUES (${input.tenantId || null}, ${input.eventId}, ${input.ruleId || null}, ${input.type}, ${input.severity}, ${input.title}, ${JSON.stringify(input.details)}::jsonb)
    RETURNING id, created_at
  `;
  const alert = rows[0];
  publishRealtimeEvent({
    id: String(alert?.id || ""),
    tenant_slug: input.tenantSlug || undefined,
    result: "SECURITY_ALERT",
    reason: input.type,
    source: "alerts",
    created_at: String(alert?.created_at || new Date().toISOString()),
    trace_id: String(input.eventId),
  });
}

export async function evaluateSecurityAlerts(input: EvaluateInput) {
  if (!input.eventId || !input.tenantId) return;
  const baseType = normalizeTypeFromResult(String(input.result || ""));
  if (baseType) {
    const rule = await getRule(input.tenantId, baseType);
    const threshold = Number(rule?.threshold || 1);
    const windowMinutes = Number(rule?.window_minutes || 60);
    const recentRows = await sql/*sql*/`
      SELECT COUNT(*)::int AS cnt
      FROM events
      WHERE tenant_id = ${input.tenantId}
        AND created_at >= now() - (${windowMinutes} || ' minutes')::interval
        AND UPPER(result) = ${String(input.result || "").toUpperCase()}
    `;
    const count = Number(recentRows[0]?.cnt || 0);
    if (count >= threshold) {
      await createAlert({
        tenantId: input.tenantId,
        eventId: input.eventId,
        type: baseType,
        severity: String(rule?.severity || "high") as "low" | "medium" | "high" | "critical",
        title: `Alert ${baseType} threshold reached`,
        details: { count, threshold, window_minutes: windowMinutes, uid_hex: input.uidHex || null },
        ruleId: rule?.id || null,
        tenantSlug: input.tenantSlug || null,
      });
    }
  }

  if (input.uidHex && input.countryCode) {
    const countryRows = await sql/*sql*/`
      SELECT DISTINCT COALESCE(NULLIF(country_code, ''), NULLIF(geo_country, ''), '--') AS country
      FROM events
      WHERE tenant_id = ${input.tenantId}
        AND uid_hex = ${input.uidHex}
        AND id <> ${input.eventId}
      LIMIT 10
    `;
    const seen = new Set(countryRows.map((row) => String(row.country || "--")));
    if (seen.size > 0 && !seen.has(String(input.countryCode))) {
      const rule = await getRule(input.tenantId, "new_country_for_uid");
      await createAlert({
        tenantId: input.tenantId,
        eventId: input.eventId,
        type: "new_country_for_uid",
        severity: String(rule?.severity || "medium") as "low" | "medium" | "high" | "critical",
        title: "UID seen in a new country",
        details: { uid_hex: input.uidHex, country: input.countryCode, seen_countries: Array.from(seen) },
        ruleId: rule?.id || null,
        tenantSlug: input.tenantSlug || null,
      });
    }
  }
}

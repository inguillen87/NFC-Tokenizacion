export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminTenantScope } from "../../../../lib/auth";
import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
import { normalizeAlertSeverity } from "../../../../lib/alerts-query";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = checkAdmin(req);
  if (auth) return auth;
  const { forcedTenantSlug } = getAdminTenantScope(req);
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const threshold = Number(body.threshold);
  const windowMinutes = Number(body.window_minutes);
  const severity = body.severity == null ? null : normalizeAlertSeverity(String(body.severity));
  if (body.severity != null && !severity) return json({ ok: false, error: "invalid_severity" }, 400);
  if (body.threshold != null && (!Number.isFinite(threshold) || threshold <= 0)) return json({ ok: false, error: "invalid_threshold" }, 400);
  if (body.window_minutes != null && (!Number.isFinite(windowMinutes) || windowMinutes <= 0)) return json({ ok: false, error: "invalid_window_minutes" }, 400);
  const rows = await sql/*sql*/`
    UPDATE alert_rules
    SET severity = COALESCE(${severity}, severity),
        threshold = COALESCE(${Number.isFinite(threshold) ? threshold : null}, threshold),
        window_minutes = COALESCE(${Number.isFinite(windowMinutes) ? windowMinutes : null}, window_minutes),
        enabled = COALESCE(${body.enabled as boolean | null}, enabled),
        config = COALESCE(${body.config ? JSON.stringify(body.config) : null}::jsonb, config),
        updated_at = now()
    WHERE id = ${id}
      AND (
        ${forcedTenantSlug} = ''
        OR tenant_id = (SELECT id FROM tenants WHERE slug = ${forcedTenantSlug} LIMIT 1)
      )
    RETURNING *
  `;
  if (!rows[0]) return json({ ok: false, error: "not_found" }, 404);
  return json({ ok: true, item: rows[0] });
}

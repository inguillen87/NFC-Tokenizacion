export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../../lib/auth";
import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = checkAdmin(req);
  if (auth) return auth;
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const rows = await sql/*sql*/`
    UPDATE alert_rules
    SET severity = COALESCE(${body.severity as string | null}, severity),
        threshold = COALESCE(${Number(body.threshold || NaN)}, threshold),
        window_minutes = COALESCE(${Number(body.window_minutes || NaN)}, window_minutes),
        enabled = COALESCE(${body.enabled as boolean | null}, enabled),
        config = COALESCE(${body.config ? JSON.stringify(body.config) : null}::jsonb, config),
        updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  if (!rows[0]) return json({ ok: false, error: "not_found" }, 404);
  return json({ ok: true, item: rows[0] });
}

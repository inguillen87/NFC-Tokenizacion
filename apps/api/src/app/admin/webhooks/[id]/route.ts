export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../../lib/auth";
import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const enabled = body?.enabled;
  const events = Array.isArray(body?.events) ? body.events : null;

  const rows = await sql/*sql*/`
    UPDATE webhook_endpoints
    SET
      enabled = COALESCE(${typeof enabled === "boolean" ? enabled : null}, enabled),
      events = COALESCE(${events ? JSON.stringify(events) : null}::jsonb, events),
      updated_at = now()
    WHERE id = ${id}
    RETURNING id, tenant_id, url, enabled, events, updated_at
  `;

  if (!rows[0]) return json({ error: "webhook not found" }, 404);
  return json({ ok: true, endpoint: rows[0] });
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const { id } = await context.params;
  const rows = await sql/*sql*/`DELETE FROM webhook_endpoints WHERE id = ${id} RETURNING id`;
  if (!rows[0]) return json({ error: "webhook not found" }, 404);
  return json({ ok: true, deleted: rows[0].id });
}

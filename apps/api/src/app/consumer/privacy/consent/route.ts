export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { getConsumerFromRequest } from "../../../../lib/consumer-auth";
import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
import { ensureConsumerPortalSchema } from "../../../../lib/commercial-runtime-schema";

export async function PATCH(req: Request) {
  await ensureConsumerPortalSchema();
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  const body = await req.json().catch(() => ({}));
  if (!body.tenantId || !body.scope) return json({ ok: false, error: "tenantId_scope_required" }, 400);
  const granted = Boolean(body.granted);
  const rows = await sql/*sql*/`
    INSERT INTO consumer_tenant_consents (tenant_id, consumer_id, scope, granted, granted_at, revoked_at, source)
    VALUES (${body.tenantId}, ${consumer.id}, ${body.scope}, ${granted}, ${granted ? new Date().toISOString() : null}, ${granted ? null : new Date().toISOString()}, 'consumer_privacy')
    ON CONFLICT (tenant_id, consumer_id, scope)
    DO UPDATE SET granted = EXCLUDED.granted, granted_at = EXCLUDED.granted_at, revoked_at = EXCLUDED.revoked_at
    RETURNING *
  `;
  return json({ ok: true, consent: rows[0] });
}

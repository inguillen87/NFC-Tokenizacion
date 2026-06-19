export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminTenantScope } from "../../../../lib/auth";
import { ensureSdkSchema } from "../../../../lib/commercial-runtime-schema";
import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";

function clean(value: unknown) {
  return String(value || "").trim();
}

async function tenantScopeId(req: Request) {
  const tenantScope = getAdminTenantScope(req).forcedTenantSlug;
  if (!tenantScope) return null;
  const rows = await sql/*sql*/`SELECT id::text AS id FROM tenants WHERE slug = ${tenantScope} LIMIT 1`;
  return rows[0]?.id ? String(rows[0].id) : "__missing__";
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = checkAdmin(req);
  if (auth) return auth;
  await ensureSdkSchema();

  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const tenantId = await tenantScopeId(req);
  if (tenantId === "__missing__") return json({ error: "tenant not found" }, 404);
  const name = clean(body?.name);
  const url = clean(body?.url);
  const signingSecret = clean(body?.signingSecret || body?.signing_secret);
  const enabled = body?.enabled;
  const events = Array.isArray(body?.events) ? body.events.map(clean).filter(Boolean) : null;

  const rows = await sql/*sql*/`
    UPDATE webhook_endpoints
    SET
      name = COALESCE(${name || null}, name),
      url = COALESCE(${url || null}, url),
      signing_secret = COALESCE(${signingSecret || null}, signing_secret),
      enabled = COALESCE(${typeof enabled === "boolean" ? enabled : null}, enabled),
      events = COALESCE(${events ? JSON.stringify(events) : null}::jsonb, events),
      updated_at = now()
    WHERE id = ${id}
      AND (${tenantId}::text IS NULL OR tenant_id::text = ${tenantId})
    RETURNING id::text AS id, tenant_id::text AS tenant_id, name, url, enabled, events, (signing_secret IS NOT NULL AND signing_secret <> '') AS has_signing_secret, updated_at
  `;

  if (!rows[0]) return json({ error: "webhook not found" }, 404);
  return json({ ok: true, endpoint: rows[0] });
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = checkAdmin(req);
  if (auth) return auth;
  await ensureSdkSchema();

  const { id } = await context.params;
  const tenantId = await tenantScopeId(req);
  if (tenantId === "__missing__") return json({ error: "tenant not found" }, 404);
  const rows = await sql/*sql*/`
    DELETE FROM webhook_endpoints
    WHERE id = ${id}
      AND (${tenantId}::text IS NULL OR tenant_id::text = ${tenantId})
    RETURNING id
  `;
  if (!rows[0]) return json({ error: "webhook not found" }, 404);
  return json({ ok: true, deleted: rows[0].id });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminTenantScope } from "../../../../../lib/auth";
import { ensureSdkSchema } from "../../../../../lib/commercial-runtime-schema";
import { sql } from "../../../../../lib/db";
import { json } from "../../../../../lib/http";

function clean(value: unknown) {
  return String(value || "").trim();
}

async function tenantScopeFilter(req: Request) {
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
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const tenantId = await tenantScopeFilter(req);
  if (tenantId === "__missing__") return json({ ok: false, reason: "tenant_not_found" }, 404);
  const status = clean(body.status);
  const name = clean(body.name);
  const scopes = Array.isArray(body.scopes) ? body.scopes.map(clean).filter(Boolean) : null;

  const rows = await sql/*sql*/`
    UPDATE tenant_api_keys
    SET
      name = COALESCE(${name || null}, name),
      scopes = COALESCE(${scopes ? JSON.stringify(scopes) : null}::jsonb, scopes),
      status = COALESCE(${status || null}, status),
      updated_at = now()
    WHERE id = ${id}
      AND (${tenantId}::text IS NULL OR tenant_id::text = ${tenantId})
    RETURNING id::text AS id, name, key_prefix, scopes, status, last_used_at, expires_at, updated_at
  `;
  if (!rows[0]) return json({ ok: false, reason: "api_key_not_found" }, 404);
  return json({ ok: true, key: rows[0] });
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = checkAdmin(req);
  if (auth) return auth;
  await ensureSdkSchema();

  const { id } = await context.params;
  const tenantId = await tenantScopeFilter(req);
  if (tenantId === "__missing__") return json({ ok: false, reason: "tenant_not_found" }, 404);
  const rows = await sql/*sql*/`
    UPDATE tenant_api_keys
    SET status = 'revoked', updated_at = now()
    WHERE id = ${id}
      AND (${tenantId}::text IS NULL OR tenant_id::text = ${tenantId})
    RETURNING id::text AS id
  `;
  if (!rows[0]) return json({ ok: false, reason: "api_key_not_found" }, 404);
  return json({ ok: true, revoked: rows[0].id });
}

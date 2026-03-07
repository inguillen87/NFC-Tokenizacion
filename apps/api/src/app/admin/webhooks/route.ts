export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../lib/auth";
import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";

export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const tenant = searchParams.get("tenant") || "";

  const rows = tenant
    ? await sql/*sql*/`
      SELECT we.id, tn.slug AS tenant_slug, we.url, we.enabled, we.events, we.created_at, we.updated_at
      FROM webhook_endpoints we
      JOIN tenants tn ON tn.id = we.tenant_id
      WHERE tn.slug = ${tenant}
      ORDER BY we.updated_at DESC
    `
    : await sql/*sql*/`
      SELECT we.id, tn.slug AS tenant_slug, we.url, we.enabled, we.events, we.created_at, we.updated_at
      FROM webhook_endpoints we
      JOIN tenants tn ON tn.id = we.tenant_id
      ORDER BY we.updated_at DESC
      LIMIT 200
    `;

  return json(rows);
}

export async function POST(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const body = await req.json().catch(() => ({}));
  const tenantSlug = String(body?.tenant || "").trim();
  const url = String(body?.url || "").trim();
  const events = Array.isArray(body?.events) ? body.events : ["scan.valid", "scan.risk"];
  const enabled = Boolean(body?.enabled);

  if (!tenantSlug || !url) {
    return json({ error: "tenant and url are required" }, 400);
  }

  const tenantRows = await sql/*sql*/`SELECT id FROM tenants WHERE slug = ${tenantSlug} LIMIT 1`;
  const tenantId = tenantRows[0]?.id;
  if (!tenantId) return json({ error: "tenant not found" }, 404);

  const rows = await sql/*sql*/`
    INSERT INTO webhook_endpoints (tenant_id, url, enabled, events, updated_at)
    VALUES (${tenantId}, ${url}, ${enabled}, ${JSON.stringify(events)}::jsonb, now())
    ON CONFLICT (tenant_id, url)
    DO UPDATE SET enabled = EXCLUDED.enabled, events = EXCLUDED.events, updated_at = now()
    RETURNING id, url, enabled, events, created_at, updated_at
  `;

  return json({ ok: true, endpoint: rows[0] }, 201);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminPrincipal } from "../../../lib/auth";
import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";
import { ensureTicketsSchema } from "../../../lib/commercial-runtime-schema";

function isMissingRelation(error: unknown) {
  const code = String((error as { code?: unknown })?.code || "");
  const message = String((error as Error)?.message || "");
  return code === "42P01" || message.includes("does not exist") || message.includes("relation ");
}

export async function GET(req: Request) {
  const auth = await checkAdmin(req, ["super_admin", "tenant_admin", "tenant_operator", "reseller"]);
  if (auth) return auth;
  const principal = getAdminPrincipal(req);
  await ensureTicketsSchema();
  let rows;
  try {
    rows = principal.scope === "super_admin"
      ? await sql/*sql*/`
          SELECT ticket.*, tenant.slug AS tenant_slug, tenant.name AS tenant_name
          FROM tickets ticket
          LEFT JOIN tenants tenant ON tenant.id = ticket.tenant_id
          ORDER BY ticket.created_at DESC
          LIMIT 300
        `
      : await sql/*sql*/`
          SELECT ticket.*, tenant.slug AS tenant_slug, tenant.name AS tenant_name
          FROM tickets ticket
          LEFT JOIN tenants tenant ON tenant.id = ticket.tenant_id
          WHERE ticket.tenant_id = ${principal.tenantId}::uuid
          ORDER BY ticket.created_at DESC
          LIMIT 300
        `;
  } catch (error) {
    if (!isMissingRelation(error)) throw error;
    await ensureTicketsSchema();
    rows = principal.scope === "super_admin"
      ? await sql/*sql*/`
          SELECT ticket.*, tenant.slug AS tenant_slug, tenant.name AS tenant_name
          FROM tickets ticket
          LEFT JOIN tenants tenant ON tenant.id = ticket.tenant_id
          ORDER BY ticket.created_at DESC
          LIMIT 300
        `
      : await sql/*sql*/`
          SELECT ticket.*, tenant.slug AS tenant_slug, tenant.name AS tenant_name
          FROM tickets ticket
          LEFT JOIN tenants tenant ON tenant.id = ticket.tenant_id
          WHERE ticket.tenant_id = ${principal.tenantId}::uuid
          ORDER BY ticket.created_at DESC
          LIMIT 300
        `;
  }
  return json(rows);
}

export async function POST(req: Request) {
  const auth = await checkAdmin(req, ["super_admin"]);
  if (auth) return auth;
  const body: Record<string, unknown> = await req.json().catch(() => ({}));
  const locale = String(body.locale || "es-AR");
  const contact = String(body.contact || "");
  const title = String(body.title || "General inquiry");
  const detail = String(body.detail || "");
  if (!contact) return json({ ok: false, reason: "contact required" }, 400);

  await ensureTicketsSchema();
  let rows;
  try {
    rows = await sql/*sql*/`
      INSERT INTO tickets (locale, contact, title, detail, status)
      VALUES (${locale}, ${contact}, ${title}, ${detail}, 'open')
      RETURNING *
    `;
  } catch (error) {
    if (!isMissingRelation(error)) throw error;
    await ensureTicketsSchema();
    rows = await sql/*sql*/`
      INSERT INTO tickets (locale, contact, title, detail, status)
      VALUES (${locale}, ${contact}, ${title}, ${detail}, 'open')
      RETURNING *
    `;
  }

  return json(rows[0], 201);
}

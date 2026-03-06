export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../lib/auth";
import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";

export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;
  const rows = await sql/*sql*/`SELECT * FROM tickets ORDER BY created_at DESC LIMIT 300`;
  return json(rows);
}

export async function POST(req: Request) {
  const body: Record<string, unknown> = await req.json().catch(() => ({}));
  const locale = String(body.locale || "es-AR");
  const contact = String(body.contact || "");
  const title = String(body.title || "General inquiry");
  const detail = String(body.detail || "");
  if (!contact) return json({ ok: false, reason: "contact required" }, 400);

  const rows = await sql/*sql*/`
    INSERT INTO tickets (locale, contact, title, detail, status)
    VALUES (${locale}, ${contact}, ${title}, ${detail}, 'open')
    RETURNING *
  `;

  return json(rows[0], 201);
}

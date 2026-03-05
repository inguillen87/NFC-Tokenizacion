export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../lib/auth";
import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";

export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;
  const rows = await sql/*sql*/`SELECT * FROM leads ORDER BY created_at DESC LIMIT 300`;
  return json(rows);
}

export async function POST(req: Request) {
  const body: Record<string, unknown> = await req.json().catch(() => ({}));
  const locale = String(body.locale || "es-AR");
  const contact = String(body.contact || "");
  const company = String(body.company || "");
  const country = String(body.country || "");
  const vertical = String(body.vertical || "other");
  const tagType = String(body.tag_type || "basic");
  const volume = Number(body.volume || 0);
  const source = String(body.source || "assistant");
  const notes = String(body.notes || "");

  if (!contact) return json({ ok: false, reason: "contact required" }, 400);

  const rows = await sql/*sql*/`
    INSERT INTO leads (locale, contact, company, country, vertical, tag_type, volume, source, status, notes)
    VALUES (${locale}, ${contact}, ${company}, ${country}, ${vertical}, ${tagType}, ${volume}, ${source}, 'new', ${notes})
    RETURNING *
  `;

  return json(rows[0], 201);
}

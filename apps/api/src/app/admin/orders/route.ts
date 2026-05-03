export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../lib/auth";
import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";
import { ensureOrderRequestsSchema } from "../../../lib/commercial-runtime-schema";

export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;
  await ensureOrderRequestsSchema();
  const rows = await sql/*sql*/`SELECT * FROM order_requests ORDER BY created_at DESC LIMIT 300`;
  return json(rows);
}

export async function POST(req: Request) {
  const body: Record<string, unknown> = await req.json().catch(() => ({}));
  const locale = String(body.locale || "es-AR");
  const contact = String(body.contact || "");
  const company = String(body.company || "");
  const tagType = String(body.tag_type || "basic");
  const volume = Number(body.volume || 0);
  const notes = String(body.notes || "");
  if (!contact) return json({ ok: false, reason: "contact required" }, 400);

  await ensureOrderRequestsSchema();
  const rows = await sql/*sql*/`
    INSERT INTO order_requests (locale, contact, company, tag_type, volume, notes, status)
    VALUES (${locale}, ${contact}, ${company}, ${tagType}, ${volume}, ${notes}, 'new')
    RETURNING *
  `;

  return json(rows[0], 201);
}

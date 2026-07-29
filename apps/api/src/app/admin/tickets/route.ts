export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../lib/auth";
import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";
import { ensureTicketsSchema } from "../../../lib/commercial-runtime-schema";

function isMissingRelation(error: unknown) {
  const code = String((error as { code?: unknown })?.code || "");
  const message = String((error as Error)?.message || "");
  return code === "42P01" || message.includes("does not exist") || message.includes("relation ");
}

export async function GET(req: Request) {
  const auth = await checkAdmin(req, ["super_admin"]);
  if (auth) return auth;
  await ensureTicketsSchema();
  let rows;
  try {
    rows = await sql/*sql*/`SELECT * FROM tickets ORDER BY created_at DESC LIMIT 300`;
  } catch (error) {
    if (!isMissingRelation(error)) throw error;
    await ensureTicketsSchema();
    rows = await sql/*sql*/`SELECT * FROM tickets ORDER BY created_at DESC LIMIT 300`;
  }
  return json(rows);
}

export async function POST(req: Request) {
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

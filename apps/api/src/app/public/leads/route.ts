export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";

function clean(value: unknown) {
  return String(value || "").trim();
}

export async function POST(req: Request) {
  const body: Record<string, unknown> = await req.json().catch(() => ({}));
  const locale = clean(body.locale) || "es-AR";
  const name = clean(body.name);
  const email = clean(body.email);
  const phone = clean(body.phone || body.whatsapp);
  const company = clean(body.company);
  const country = clean(body.country);
  const vertical = clean(body.vertical) || "other";
  const roleInterest = clean(body.role_interest || body.role);
  const estimatedVolume = clean(body.estimated_volume || body.volume);
  const volume = Number(body.volume || 0);
  const source = clean(body.source) || "public";
  const message = clean(body.message);
  const contact = clean(body.contact) || [email, phone, name].filter(Boolean).join(" | ");
  const tagType = clean(body.tag_type) || (vertical === "events" ? "basic" : "secure");
  const notes = clean(body.notes) || [
    roleInterest ? `role=${roleInterest}` : "",
    message ? `message=${message}` : "",
    estimatedVolume ? `estimated_volume=${estimatedVolume}` : "",
  ].filter(Boolean).join(" | ");

  if (!contact) return json({ ok: false, reason: "contact required" }, 400);

  try {
    const rows = await sql/*sql*/`
      INSERT INTO leads (locale, contact, name, email, phone, company, country, vertical, role_interest, estimated_volume, tag_type, volume, source, status, message, notes)
      VALUES (${locale}, ${contact}, ${name}, ${email}, ${phone}, ${company}, ${country}, ${vertical}, ${roleInterest}, ${estimatedVolume}, ${tagType}, ${volume}, ${source}, 'new', ${message}, ${notes})
      RETURNING *
    `;

    return json({ ok: true, lead: rows[0] }, 201);
  } catch {
    return json({ ok: false, reason: "lead insert failed" }, 500);
  }
}

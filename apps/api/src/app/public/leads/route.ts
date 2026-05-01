export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";
import { publishRealtimeEvent } from "../../../lib/realtime-events";

function clean(value: unknown) {
  return String(value || "").trim();
}

async function postJson(url: string, payload: unknown, token?: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return { ok: response.ok, status: response.status };
  } catch {
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(timeout);
  }
}

async function notifyLead(payload: { lead: Record<string, unknown>; sourceBody: Record<string, unknown> }) {
  const webhookUrl = clean(process.env.LEADS_WEBHOOK_URL);
  const whatsappUrl = clean(process.env.WHATSAPP_API_URL || process.env.WHATSAPP_WEBHOOK_URL);
  const whatsappToken = clean(process.env.WHATSAPP_API_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN);
  const salesWhatsappTo = clean(process.env.SALES_WHATSAPP_TO);
  const lead = payload.lead;
  const message = [
    "Nuevo lead nexID",
    `Nombre: ${clean(lead.name) || "n/a"}`,
    `Empresa: ${clean(lead.company) || "n/a"}`,
    `Contacto: ${clean(lead.email) || clean(lead.phone) || clean(lead.contact) || "n/a"}`,
    `Vertical: ${clean(lead.vertical) || "n/a"}`,
    `Interes: ${clean(lead.role_interest) || clean(lead.tag_type) || "n/a"}`,
  ].join("\n");

  const deliveries = await Promise.all([
    webhookUrl
      ? postJson(webhookUrl, { type: "lead.created", lead, sourceBody: payload.sourceBody })
      : Promise.resolve({ ok: false, status: 0 }),
    whatsappUrl
      ? postJson(whatsappUrl, {
        type: "lead.created",
        to: salesWhatsappTo || clean(lead.phone),
        text: message,
        lead,
      }, whatsappToken)
      : Promise.resolve({ ok: false, status: 0 }),
  ]);

  return {
    webhook: webhookUrl ? deliveries[0] : null,
    whatsapp: whatsappUrl ? deliveries[1] : null,
  };
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

    publishRealtimeEvent({
      event_type: "lead.created",
      lead_id: String((rows[0] as Record<string, unknown>).id || ""),
      contact,
      company,
      source,
      status: "new",
      created_at: String((rows[0] as Record<string, unknown>).created_at || new Date().toISOString()),
    });

    const delivery = await notifyLead({ lead: rows[0] as Record<string, unknown>, sourceBody: body });
    return json({ ok: true, lead: rows[0], delivery }, 201);
  } catch {
    try {
      const rows = await sql/*sql*/`
        INSERT INTO leads (locale, contact, company, country, vertical, tag_type, volume, source, status, notes)
        VALUES (${locale}, ${contact}, ${company || name}, ${country}, ${vertical}, ${tagType}, ${volume}, ${source}, 'new', ${notes || message})
        RETURNING *
      `;

      publishRealtimeEvent({
        event_type: "lead.created",
        lead_id: String((rows[0] as Record<string, unknown>).id || ""),
        contact,
        company,
        source,
        status: "new",
        created_at: String((rows[0] as Record<string, unknown>).created_at || new Date().toISOString()),
      });

      const delivery = await notifyLead({ lead: rows[0] as Record<string, unknown>, sourceBody: body });
      return json({ ok: true, lead: rows[0], delivery, compatibilityMode: true }, 201);
    } catch {
      return json({ ok: false, reason: "lead insert failed" }, 500);
    }
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";
import { publishRealtimeEvent } from "../../../lib/realtime-events";
import { ensureCrmOpsSchema } from "../../../lib/commercial-runtime-schema";

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

function isMissingRelation(error: unknown) {
  const code = String((error as { code?: unknown })?.code || "");
  const message = error instanceof Error ? error.message : String(error || "");
  return code === "42P01" || /relation .* does not exist|does not exist/i.test(message);
}

function publishLead(lead: Record<string, unknown>, context: { contact: string; company: string; source: string }) {
  publishRealtimeEvent({
    event_type: "lead.created",
    lead_id: String(lead.id || ""),
    contact: context.contact,
    company: context.company,
    source: context.source,
    status: "new",
    created_at: String(lead.created_at || new Date().toISOString()),
  });
}

async function createCompanionTicket(context: {
  locale: string;
  contact: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  country: string;
  vertical: string;
  roleInterest: string;
  estimatedVolume: string;
  source: string;
  message: string;
  tagType: string;
  notes: string;
}) {
  const title = context.company
    ? `Lead comercial - ${context.company}`
    : `Lead comercial - ${context.contact}`;
  const detail = [
    context.name ? `Nombre: ${context.name}` : "",
    context.email ? `Email: ${context.email}` : "",
    context.phone ? `WhatsApp: ${context.phone}` : "",
    context.country ? `Pais: ${context.country}` : "",
    context.vertical ? `Vertical: ${context.vertical}` : "",
    context.roleInterest ? `Rol/interes: ${context.roleInterest}` : "",
    context.estimatedVolume ? `Volumen estimado: ${context.estimatedVolume}` : "",
    context.tagType ? `Perfil sugerido: ${context.tagType}` : "",
    context.message ? `Mensaje: ${context.message}` : "",
    context.notes ? `Notas: ${context.notes}` : "",
  ].filter(Boolean).join("\n");

  try {
    const rows = await sql/*sql*/`
      INSERT INTO tickets (locale, contact, title, detail, status, source)
      VALUES (${context.locale}, ${context.contact}, ${title}, ${detail}, 'open', ${context.source || "public_lead"})
      RETURNING *
    `;
    const ticket = rows[0] as Record<string, unknown> | undefined;
    if (ticket) {
      publishRealtimeEvent({
        event_type: "ticket.created",
        ticket_id: String(ticket.id || ""),
        contact: context.contact,
        source: context.source,
        status: "open",
        created_at: String(ticket.created_at || new Date().toISOString()),
      });
    }
    return ticket || null;
  } catch (error) {
    console.warn("[public_leads] companion ticket failed", error);
    return null;
  }
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

  const context = {
    locale,
    contact,
    name,
    email,
    phone,
    company,
    country,
    vertical,
    roleInterest,
    estimatedVolume,
    source,
    message,
    tagType,
    notes,
  };

  async function finishLead(lead: Record<string, unknown>, compatibilityMode = false) {
    publishLead(lead, { contact, company, source });
    const ticket = await createCompanionTicket(context);
    const delivery = await notifyLead({ lead, sourceBody: body });
    return json({ ok: true, lead, ticket, delivery, compatibilityMode }, 201);
  }

  async function insertFullLead() {
    return sql/*sql*/`
      INSERT INTO leads (locale, contact, name, email, phone, company, country, vertical, role_interest, estimated_volume, tag_type, volume, source, status, message, notes)
      VALUES (${locale}, ${contact}, ${name}, ${email}, ${phone}, ${company}, ${country}, ${vertical}, ${roleInterest}, ${estimatedVolume}, ${tagType}, ${volume}, ${source}, 'new', ${message}, ${notes})
      RETURNING *
    `;
  }

  async function insertCompatibilityLead() {
    return sql/*sql*/`
      INSERT INTO leads (locale, contact, company, country, vertical, tag_type, volume, source, status, notes)
      VALUES (${locale}, ${contact}, ${company || name}, ${country}, ${vertical}, ${tagType}, ${volume}, ${source}, 'new', ${notes || message})
      RETURNING *
    `;
  }

  await ensureCrmOpsSchema();
  try {
    const rows = await insertFullLead();
    return finishLead(rows[0] as Record<string, unknown>);
  } catch (error) {
    if (isMissingRelation(error)) await ensureCrmOpsSchema();
    try {
      const rows = await insertCompatibilityLead();
      return finishLead(rows[0] as Record<string, unknown>, true);
    } catch (compatibilityError) {
      if (isMissingRelation(compatibilityError)) {
        await ensureCrmOpsSchema();
        const rows = await insertCompatibilityLead();
        return finishLead(rows[0] as Record<string, unknown>, true);
      }
      console.error("[public_leads] insert failed", compatibilityError);
      return json({ ok: false, reason: "lead insert failed" }, 500);
    }
  }
}

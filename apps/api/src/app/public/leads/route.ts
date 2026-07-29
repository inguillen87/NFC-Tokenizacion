export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createHash } from "node:crypto";
import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";
import { publishRealtimeEvent } from "../../../lib/realtime-events";
import { ensureCrmOpsSchema } from "../../../lib/commercial-runtime-schema";
import { enforceCriticalRateLimit } from "../../../lib/critical-rate-limit";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../lib/bounded-request-body";
import { hitSunRateLimit } from "../../../lib/sun-rate-limit-store";
import { normalizeConsentedApproximateLocation } from "../../../lib/approximate-location";

const MAX_LEAD_BODY_BYTES = 32 * 1024;
const LEAD_CONTACT_WINDOW_SECONDS = 60 * 60;
const LEAD_CONTACT_MAX = 5;
const LOCALES = new Set(["es-AR", "pt-BR", "en"]);
const VERTICALS = new Set(["wine", "spirits", "events", "cosmetics", "agro", "pharma", "luxury", "art", "documents", "retail", "logistics", "other"]);
const TAG_TYPES = new Set(["basic", "secure", "ntag213", "ntag215", "ntag216", "ntag424_dna", "ntag424_dna_tt", "qr", "gs1", "uhf"]);

function clean(value: unknown) {
  return String(value || "").trim();
}

function limitedText(value: unknown, maximum: number) {
  return clean(value).slice(0, maximum);
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function validEmail(value: string) {
  return !value || /^[^\s@]{1,120}@[^\s@]{1,190}\.[^\s@]{2,63}$/.test(value);
}

function validPhone(value: string) {
  return !value || /^\+?[0-9 ()-]{7,30}$/.test(value);
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

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

async function resolveTenantId(input: { tenantId: string; tenantSlug: string }) {
  if (input.tenantId) return input.tenantId;
  if (!input.tenantSlug) return null;
  const rows = await sql/*sql*/`
    SELECT id::text AS id
    FROM tenants
    WHERE slug = ${input.tenantSlug}
    LIMIT 1
  `;
  return rows[0]?.id ? String(rows[0].id) : null;
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
  const sourceLimited = await enforceCriticalRateLimit(req, {
    rateClass: "public_write",
    tenantId: "platform",
    subjectId: "public-leads:source",
  });
  if (sourceLimited) return sourceLimited;

  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonBody<Record<string, unknown>>(req, MAX_LEAD_BODY_BYTES);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, reason: tooLarge ? "request_body_too_large" : "invalid_json" }, tooLarge ? 413 : 400);
  }

  const requestedLocale = limitedText(body.locale, 12);
  const locale = LOCALES.has(requestedLocale) ? requestedLocale : "es-AR";
  const name = limitedText(body.name, 120);
  const email = limitedText(body.email, 320).toLowerCase();
  const phone = limitedText(body.phone || body.whatsapp, 32);
  const company = limitedText(body.company, 160);
  const country = limitedText(body.country, 80);
  const requestedVertical = limitedText(body.vertical, 40).toLowerCase();
  const vertical = VERTICALS.has(requestedVertical) ? requestedVertical : "other";
  const roleInterest = limitedText(body.role_interest || body.role, 120);
  const estimatedVolume = limitedText(body.estimated_volume || body.volume, 80);
  const rawVolume = Number(body.volume || 0);
  const volume = Number.isFinite(rawVolume) ? Math.max(0, Math.min(Math.trunc(rawVolume), 10_000_000)) : 0;
  const requestedSource = limitedText(body.source, 60).toLowerCase();
  const source = /^[a-z0-9][a-z0-9._-]{0,59}$/.test(requestedSource) ? requestedSource : "public";
  const message = limitedText(body.message, 2_000);
  const tenantSlugCandidate = limitedText(body.tenantSlug || body.tenant_slug || body.tenant, 120).toLowerCase();
  const tenantSlug = /^[a-z0-9][a-z0-9._-]{1,119}$/.test(tenantSlugCandidate) ? tenantSlugCandidate : "";
  const tenantIdInput = "";
  const eventIdCandidate = limitedText(body.eventId || body.event_id, 24);
  const eventId = /^[1-9]\d{0,19}$/.test(eventIdCandidate) ? eventIdCandidate : "";
  const bidCandidate = limitedText(body.bid, 120);
  const bid = /^[A-Za-z0-9._:-]{3,120}$/.test(bidCandidate) ? bidCandidate : "";
  const uidCandidate = limitedText(body.uidHex || body.uid_hex, 20).toUpperCase();
  const uidHex = /^[0-9A-F]{8,20}$/.test(uidCandidate) ? uidCandidate : "";
  const productName = limitedText(body.productName || body.product_name, 200);
  const gender = limitedText(body.gender, 40);
  const occasion = limitedText(body.occasion, 80);
  const explicitContact = limitedText(body.contact, 320);
  const contact = explicitContact || [email, phone, name].filter(Boolean).join(" | ").slice(0, 320);
  const requestedTagType = limitedText(body.tag_type, 40).toLowerCase();
  const tagType = TAG_TYPES.has(requestedTagType) ? requestedTagType : vertical === "events" ? "basic" : "secure";
  const baseMeta = asRecord(body.meta);
  const requestedGps = asRecord(body.gps || baseMeta.gps);
  const approximateGps = normalizeConsentedApproximateLocation({
    consent: requestedGps.consent,
    precision: requestedGps.precision,
    lat: requestedGps.lat ?? requestedGps.latitude,
    lng: requestedGps.lng ?? requestedGps.longitude,
    accuracy: requestedGps.accuracy,
  });
  const gps = approximateGps.accepted
    ? {
        consent: true,
        precision: "approximate",
        source: "browser_gps_approximate_consent",
        lat: approximateGps.lat,
        lng: approximateGps.lng,
        accuracy: approximateGps.accuracy,
      }
    : {
        consent: false,
        precision: "none",
        source: "not_persisted",
        reason: approximateGps.reason,
      };
  const meta: Record<string, unknown> = {
    ...baseMeta,
    tenantSlug: tenantSlug || baseMeta.tenantSlug || null,
    eventId: eventId || baseMeta.eventId || null,
    bid: bid || baseMeta.bid || null,
    uidHex: uidHex || baseMeta.uidHex || null,
    productName: productName || baseMeta.productName || null,
    gender: gender || baseMeta.gender || null,
    occasion: occasion || baseMeta.occasion || null,
    gps,
    device: asRecord(body.device || baseMeta.device),
    engagement: asRecord(body.engagement || baseMeta.engagement),
  };
  const notes = limitedText(body.notes, 2_000) || [
    tenantSlug ? `tenant=${tenantSlug}` : "",
    eventId ? `event=${eventId}` : "",
    bid ? `bid=${bid}` : "",
    productName ? `product=${productName}` : "",
    gender ? `gender=${gender}` : "",
    occasion ? `occasion=${occasion}` : "",
    roleInterest ? `role=${roleInterest}` : "",
    message ? `message=${message}` : "",
    estimatedVolume ? `estimated_volume=${estimatedVolume}` : "",
  ].filter(Boolean).join(" | ");

  if (!contact) return json({ ok: false, reason: "contact_required" }, 400);
  if (!validEmail(email)) return json({ ok: false, reason: "email_invalid" }, 400);
  if (!validPhone(phone)) return json({ ok: false, reason: "phone_invalid" }, 400);

  const contactDigest = sha256(contact.toLowerCase());
  const antiSpam = await hitSunRateLimit(
    "public_lead_contact",
    contactDigest,
    LEAD_CONTACT_WINDOW_SECONDS,
    LEAD_CONTACT_MAX,
  ).catch(() => null);
  if (!antiSpam || antiSpam.unavailable) return json({ ok: false, reason: "lead_rate_limit_unavailable" }, 503);
  if (antiSpam.limited) {
    return json({ ok: false, reason: "lead_rate_limited" }, 429, {
      "cache-control": "no-store",
      "retry-after": String(antiSpam.retryAfterSeconds),
    });
  }

  const requestedIdempotencyKey = limitedText(req.headers.get("idempotency-key") || body.idempotency_key, 128);
  const timeBucket = Math.floor(Date.now() / (10 * 60 * 1000));
  const idempotencyKey = /^[A-Za-z0-9._:-]{8,128}$/.test(requestedIdempotencyKey)
    ? requestedIdempotencyKey
    : sha256(`${contact.toLowerCase()}\0${company.toLowerCase()}\0${message}\0${source}\0${timeBucket}`);
  meta.idempotencyKey = idempotencyKey;

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
  const sanitizedSourceBody = {
    locale,
    name,
    email,
    phone,
    company,
    country,
    vertical,
    role_interest: roleInterest,
    estimated_volume: estimatedVolume,
    volume,
    source,
    message,
    tenant_slug: tenantSlug || null,
    event_id: eventId || null,
    bid: bid || null,
    uid_hex: uidHex || null,
    product_name: productName || null,
    meta,
  };

  async function finishLead(lead: Record<string, unknown>, compatibilityMode = false) {
    publishLead(lead, { contact, company, source });
    const ticket = await createCompanionTicket(context);
    const delivery = await notifyLead({ lead, sourceBody: sanitizedSourceBody });
    const warnings = [
      !ticket ? "companion_ticket_not_created" : "",
      delivery.webhook && !delivery.webhook.ok ? "lead_webhook_delivery_failed" : "",
      delivery.whatsapp && !delivery.whatsapp.ok ? "lead_whatsapp_delivery_failed" : "",
    ].filter(Boolean);
    return json({
      ok: true,
      persisted: true,
      lead,
      ticket,
      delivery,
      warnings,
      follow_up_required: warnings.length > 0,
      compatibilityMode,
      idempotency_key: idempotencyKey,
      anti_automation: { distributed_rate_limit: true, turnstile: "not_configured" },
    }, 201);
  }

  await ensureCrmOpsSchema();
  const tenantId = await resolveTenantId({ tenantId: tenantIdInput, tenantSlug }).catch(() => null);
  try {
    const existing = await sql/*sql*/`
      SELECT *
      FROM leads
      WHERE meta->>'idempotencyKey' = ${idempotencyKey}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    if (existing[0]) {
      return json({
        ok: true,
        persisted: true,
        lead: existing[0],
        idempotentReplay: true,
        idempotency_key: idempotencyKey,
        anti_automation: { distributed_rate_limit: true, turnstile: "not_configured" },
      }, 200);
    }
  } catch (error) {
    console.warn("[public_leads] idempotency lookup unavailable; continuing with persisted insert", error);
  }

  async function insertFullLead() {
    return sql/*sql*/`
      INSERT INTO leads (locale, contact, name, email, phone, company, country, vertical, role_interest, estimated_volume, tag_type, volume, source, status, message, notes, tenant_id, meta)
      VALUES (${locale}, ${contact}, ${name}, ${email}, ${phone}, ${company}, ${country}, ${vertical}, ${roleInterest}, ${estimatedVolume}, ${tagType}, ${volume}, ${source}, 'new', ${message}, ${notes}, ${tenantId}, ${JSON.stringify(meta)}::jsonb)
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

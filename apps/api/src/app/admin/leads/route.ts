export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../lib/auth";
import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";
import { publishRealtimeEvent } from "../../../lib/realtime-events";
import { ensureLeadsSchema } from "../../../lib/commercial-runtime-schema";

function clean(value: unknown) {
  return String(value || "").trim();
}

function isMissingRelation(error: unknown) {
  const code = String((error as { code?: unknown })?.code || "");
  const message = String((error as Error)?.message || "");
  return code === "42P01" || message.includes("does not exist") || message.includes("relation ");
}

export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;
  const { searchParams } = new URL(req.url);
  const tenant = clean(searchParams.get("tenant"));
  await ensureLeadsSchema();
  let rows;
  try {
    rows = await sql/*sql*/`
      SELECT l.*, tn.slug AS tenant_slug, tn.name AS tenant_name
      FROM leads l
      LEFT JOIN tenants tn ON tn.id = l.tenant_id
      WHERE (${tenant} = '' OR tn.slug = ${tenant})
      ORDER BY l.created_at DESC
      LIMIT 500
    `;
  } catch (error) {
    if (!isMissingRelation(error)) throw error;
    await ensureLeadsSchema();
    rows = await sql/*sql*/`
      SELECT l.*, NULL::text AS tenant_slug, NULL::text AS tenant_name
      FROM leads l
      ORDER BY l.created_at DESC
      LIMIT 500
    `;
  }
  return json(rows);
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
  const source = clean(body.source) || "assistant";
  const message = clean(body.message);
  const tenantSlug = clean(body.tenantSlug || body.tenant_slug || body.tenant);
  const tenantIdInput = clean(body.tenantId || body.tenant_id);
  const eventId = clean(body.eventId || body.event_id);
  const bid = clean(body.bid);
  const uidHex = clean(body.uidHex || body.uid_hex);
  const productName = clean(body.productName || body.product_name);
  const gender = clean(body.gender);
  const occasion = clean(body.occasion);
  const contact = clean(body.contact) || [email, phone, name].filter(Boolean).join(" | ");
  const tagType = clean(body.tag_type) || (vertical === "events" ? "basic" : "secure");
  const bodyMeta = body.meta && typeof body.meta === "object" && !Array.isArray(body.meta)
    ? body.meta as Record<string, unknown>
    : {};
  const meta = {
    ...bodyMeta,
    tenantSlug: tenantSlug || bodyMeta.tenantSlug || null,
    eventId: eventId || bodyMeta.eventId || null,
    bid: bid || bodyMeta.bid || null,
    uidHex: uidHex || bodyMeta.uidHex || null,
    productName: productName || bodyMeta.productName || null,
    gender: gender || bodyMeta.gender || null,
    occasion: occasion || bodyMeta.occasion || null,
    gps: body.gps && typeof body.gps === "object" ? body.gps : bodyMeta.gps || {},
    device: body.device && typeof body.device === "object" ? body.device : bodyMeta.device || {},
    engagement: body.engagement && typeof body.engagement === "object" ? body.engagement : bodyMeta.engagement || {},
  };
  const notes = clean(body.notes) || [
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

  if (!contact) return json({ ok: false, reason: "contact required" }, 400);

  await ensureLeadsSchema();
  const tenantId = tenantIdInput || (tenantSlug
    ? String((await sql/*sql*/`SELECT id::text AS id FROM tenants WHERE slug = ${tenantSlug} LIMIT 1`)[0]?.id || "")
    : "");
  try {
    const rows = await sql/*sql*/`
      INSERT INTO leads (locale, contact, name, email, phone, company, country, vertical, role_interest, estimated_volume, tag_type, volume, source, status, message, notes, tenant_id, meta)
      VALUES (${locale}, ${contact}, ${name}, ${email}, ${phone}, ${company}, ${country}, ${vertical}, ${roleInterest}, ${estimatedVolume}, ${tagType}, ${volume}, ${source}, 'new', ${message}, ${notes}, ${tenantId || null}, ${JSON.stringify(meta)}::jsonb)
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

    return json({ ok: true, lead: rows[0], ...(rows[0] as Record<string, unknown>) }, 201);
  } catch (error) {
    if (isMissingRelation(error)) await ensureLeadsSchema();
    const rows = await sql/*sql*/`
      INSERT INTO leads (locale, contact, company, country, vertical, tag_type, volume, source, status, notes)
      VALUES (${locale}, ${contact}, ${company}, ${country}, ${vertical}, ${tagType}, ${volume}, ${source}, 'new', ${notes})
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
    return json({ ok: true, lead: rows[0], ...(rows[0] as Record<string, unknown>) }, 201);
  }
}

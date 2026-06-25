export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createHash, randomBytes } from "node:crypto";
import nodemailer from "nodemailer";
import { sql } from "../../../../lib/db";
import { ensureConsumerPortalSchema, ensureLeadsSchema } from "../../../../lib/commercial-runtime-schema";
import { publishRealtimeEvent } from "../../../../lib/realtime-events";
import { ensureRewardPublicToken, publicRewardPassUrl, publicRewardUrl } from "../../../../lib/reward-public-links";

const DEFAULT_NEXID_WHATSAPP_MEDIA_URL = "https://app.nexid.lat/nexid-mark-pulse-512.png";
const PUBLIC_CONSUMER_WEB_FALLBACK = "https://nexid.lat";
const CRM_VOUCHER_CODE = "CRM-WELCOME-2X1";
const PRIMARY_TENANT_SLUG = "bodegabalmec";
const LEGACY_TENANT_SLUG = "demobodega";
const PUBLIC_TENANT_NAME = "Bodega Balmec";
const WELCOME_REWARD_TITLE = `2x1 copa bienvenida ${PUBLIC_TENANT_NAME}`;

function env(name: string) {
  return String(process.env[name] || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .trim();
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function publicWebBase() {
  const candidates = [
    env("CONSUMER_PORTAL_URL"),
    env("NEXID_PUBLIC_WEB_URL"),
    env("NEXT_PUBLIC_WEB_URL"),
    env("NEXT_PUBLIC_WEB_BASE_URL"),
    env("WEB_BASE_URL"),
    env("VERCEL_URL"),
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const raw = candidate.startsWith("http") ? candidate : `https://${candidate}`;
    try {
      const url = new URL(raw);
      if (url.protocol !== "https:") continue;
      if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/i.test(url.hostname)) continue;
      return url.origin;
    } catch {
      continue;
    }
  }
  return PUBLIC_CONSUMER_WEB_FALLBACK;
}

function getLogoUrl() {
  return normalizeHttpsUrl(env("NEXID_WHATSAPP_MEDIA_URL")) || DEFAULT_NEXID_WHATSAPP_MEDIA_URL;
}

function xml(message: string, status = 200, mediaUrl?: string) {
  const media = mediaUrl ? `<Media>${escapeXml(mediaUrl)}</Media>` : "";
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}${media}</Message></Response>`, {
    status,
    headers: { "content-type": "text/xml; charset=utf-8" },
  });
}

function clean(value: unknown) {
  return String(value || "").trim();
}

function displayTenantName(value: unknown) {
  const raw = clean(value);
  if (!raw || /^demo\b/i.test(raw) || raw.toLowerCase() === LEGACY_TENANT_SLUG) return PUBLIC_TENANT_NAME;
  return raw;
}

function normalizePhone(input: string) {
  const raw = input.replace(/^whatsapp:/i, "").trim();
  const digits = raw.replace(/[^\d]/g, "");
  return digits ? `+${digits}` : raw;
}

function classifyIntent(body: string, buttonText: string, buttonPayload: string) {
  const normalized = `${buttonPayload} ${buttonText} ${body}`.toLowerCase();
  if (/(promo_yes|quiero|si quiero|reclamar|voucher|acepto|activar)/.test(normalized)) return "promo_yes";
  if (/(promo_no|no gracias|no quiero|baja|stop|salir)/.test(normalized)) return "promo_no";
  return "unknown";
}

function extractEmail(value: string) {
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].trim().toLowerCase() : "";
}

function redemptionCode() {
  const value = 10000000 + (randomBytes(4).readUInt32BE(0) % 90000000);
  return String(value);
}

function redemptionSeal(code: string, consumerId: string, tenantId: string) {
  const secret = env("NEXID_REDEMPTION_SECRET") || env("AUTH_SECRET") || env("JWT_SECRET") || "nexid-local-redemption";
  return createHash("sha256").update(`${code}:${consumerId}:${tenantId}:${secret}`).digest("hex").slice(0, 12).toUpperCase();
}

function portalUrl(input?: { code?: string; tenantSlug?: string }) {
  const url = new URL(`${publicWebBase()}/me/rewards`);
  return url.toString();
}

function publicApiBase(req: Request) {
  const configured = env("NEXT_PUBLIC_API_URL") || env("NEXT_PUBLIC_API_BASE_URL") || env("API_BASE_URL");
  if (configured && configured.startsWith("https://")) return configured.replace(/\/$/, "");
  const forwardedHost = clean(req.headers.get("x-forwarded-host")).split(",")[0]?.trim();
  const forwardedProto = clean(req.headers.get("x-forwarded-proto")).split(",")[0]?.trim();
  if (forwardedHost) {
    const proto = forwardedProto === "http" ? "http" : "https";
    return `${proto}://${forwardedHost.replace(/\/$/, "")}`;
  }
  const host = clean(req.headers.get("host"));
  if (host && !/localhost|127\.0\.0\.1|\[::1\]/i.test(host)) return `https://${host.replace(/\/$/, "")}`;
  const url = new URL(req.url);
  return url.origin;
}

function formatArDate(iso: string) {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

async function generateUniqueVoucherCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = redemptionCode();
    const existing = await sql/*sql*/`SELECT id FROM consumer_reward_claims WHERE redemption_code = ${code} LIMIT 1`;
    if (!existing[0]) return code;
  }
  return String(Date.now()).slice(-8);
}

async function resolveConsumerTenant(phone: string) {
  const rows = await sql/*sql*/`
    SELECT
      c.id AS consumer_id,
      c.display_name,
      c.email,
      c.phone,
      t.id AS tenant_id,
      t.slug AS tenant_slug,
      t.name AS tenant_name,
      m.last_tap_event_id,
      m.points_balance
    FROM consumers c
    LEFT JOIN tenant_consumer_memberships m ON m.consumer_id = c.id
    LEFT JOIN tenants t ON t.id = m.tenant_id
    WHERE c.phone = ${phone}
    ORDER BY (t.slug = ${PRIMARY_TENANT_SLUG}) DESC, (t.slug = ${LEGACY_TENANT_SLUG}) DESC, m.last_activity_at DESC NULLS LAST
    LIMIT 1
  `;
  if (rows[0]?.consumer_id) {
    if (rows[0]?.tenant_id) return rows[0];
    const tenantRows = await sql/*sql*/`
      SELECT id AS tenant_id, slug AS tenant_slug, name AS tenant_name
      FROM tenants
      WHERE slug IN (${PRIMARY_TENANT_SLUG}, ${LEGACY_TENANT_SLUG})
      ORDER BY (slug = ${PRIMARY_TENANT_SLUG}) DESC
      LIMIT 1
    `;
    return { ...rows[0], ...(tenantRows[0] || {}) };
  }
  const tenantRows = await sql/*sql*/`
    SELECT id AS tenant_id, slug AS tenant_slug, name AS tenant_name
    FROM tenants
    WHERE slug IN (${PRIMARY_TENANT_SLUG}, ${LEGACY_TENANT_SLUG})
    ORDER BY (slug = ${PRIMARY_TENANT_SLUG}) DESC
    LIMIT 1
  `;
  return tenantRows[0] ? { consumer_id: null, display_name: null, email: null, phone, ...tenantRows[0] } : null;
}

async function updateConsent(input: { consumerId: string; tenantId: string; granted: boolean }) {
  const scopes = ["whatsapp", "whatsapp_marketing", "promotions", "campaigns"];
  for (const scope of scopes) {
    await sql/*sql*/`
      INSERT INTO consumer_tenant_consents (tenant_id, consumer_id, scope, granted, granted_at, revoked_at, source)
      VALUES (${input.tenantId}, ${input.consumerId}, ${scope}, ${input.granted}, ${input.granted ? new Date().toISOString() : null}, ${input.granted ? null : new Date().toISOString()}, 'twilio_whatsapp_button')
      ON CONFLICT (tenant_id, consumer_id, scope)
      DO UPDATE SET granted = EXCLUDED.granted, granted_at = EXCLUDED.granted_at, revoked_at = EXCLUDED.revoked_at, source = EXCLUDED.source
    `;
  }
}

async function recordCampaignIntent(input: {
  phone: string;
  profileName: string;
  body: string;
  buttonText: string;
  buttonPayload: string;
  messageSid: string;
  intent: string;
  consumerId?: string | null;
  tenantId?: string | null;
  tenantSlug?: string | null;
  voucher?: {
    claimId?: string | null;
    redemptionCode?: string | null;
    rewardTitle?: string | null;
    expiresAt?: string | null;
    emailDelivery?: string | null;
  } | null;
}) {
  await ensureLeadsSchema();
  const exists = input.messageSid
    ? (await sql/*sql*/`
        SELECT id FROM leads
        WHERE source = 'twilio_whatsapp_campaign'
          AND meta->>'messageSid' = ${input.messageSid}
        LIMIT 1
      `)[0]
    : null;
  if (exists?.id) return exists;

  const status = input.intent === "promo_no" ? "closed" : "new";
  const message = input.buttonText || input.body || input.intent;
  const rows = await sql/*sql*/`
    INSERT INTO leads (locale, contact, name, phone, company, vertical, role_interest, source, status, message, notes, tenant_id, meta)
    VALUES (
      'es-AR',
      ${input.phone},
      ${input.profileName || null},
      ${input.phone},
      ${displayTenantName(input.tenantSlug)},
      'loyalty',
      ${input.intent === "promo_yes" ? "voucher_claim" : input.intent},
      'twilio_whatsapp_campaign',
      ${status},
      ${message},
      ${`intent=${input.intent} | button=${input.buttonText || input.buttonPayload || "text"} | phone=${input.phone}`},
      ${input.tenantId || null},
      ${JSON.stringify({
        messageSid: input.messageSid || null,
        buttonText: input.buttonText || null,
        buttonPayload: input.buttonPayload || null,
        consumerId: input.consumerId || null,
        tenantSlug: input.tenantSlug || null,
        channel: "whatsapp",
        voucher: input.voucher || null,
      })}::jsonb
    )
    RETURNING *
  `;
  publishRealtimeEvent({
    event_type: "lead.created",
    lead_id: String(rows[0]?.id || ""),
    contact: input.phone,
    company: displayTenantName(input.tenantSlug),
    source: "twilio_whatsapp_campaign",
    status,
    created_at: String(rows[0]?.created_at || new Date().toISOString()),
  });
  return rows[0];
}

async function ensureCampaignReward(tenantId: string, tenantSlug: string) {
  const programRows = await sql/*sql*/`
    SELECT id
    FROM loyalty_programs
    WHERE tenant_id = ${tenantId}
      AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const programId = programRows[0]?.id || (await sql/*sql*/`
    INSERT INTO loyalty_programs (tenant_id, name, vertical, status, mode, points_name, default_locale, allow_experience_booking, rules_json)
    VALUES (${tenantId}, ${`Club CRM ${displayTenantName(tenantSlug)}`}, 'winery', 'active', 'production', 'Puntos', 'es-AR', true, '{"source":"twilio_whatsapp_campaign"}'::jsonb)
    RETURNING id
  `)[0]?.id;

  const rewardRows = await sql/*sql*/`
    INSERT INTO rewards (
      tenant_id,
      program_id,
      code,
      title,
      description,
      type,
      status,
      points_cost,
      stock_total,
      stock_remaining,
      starts_at,
      ends_at,
      redemption_limit_per_member,
      eligibility_json,
      fulfillment_json,
      image_url,
      requires_age_gate,
      network_visible
    )
    VALUES (
      ${tenantId},
      ${programId},
      ${CRM_VOUCHER_CODE},
      ${WELCOME_REWARD_TITLE},
      'Voucher post-tap emitido por nexID CRM para convertir un tap real en visita, lead y fidelizacion.',
      'TASTING'::reward_type,
      'active',
      0,
      5000,
      5000,
      now(),
      now() + interval '365 days',
      1,
      '{"requiresVerifiedPhone":true,"requiresTenantMembership":true,"source":"whatsapp"}'::jsonb,
      '{"mode":"staff_code_validation","channel":"crm","instructions":"Validar codigo, telefono y sello nexID en bodega."}'::jsonb,
      ${getLogoUrl()},
      false,
      true
    )
    ON CONFLICT (program_id, code) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      status = 'active',
      points_cost = 0,
      stock_total = GREATEST(COALESCE(rewards.stock_total, 0), EXCLUDED.stock_total),
      stock_remaining = GREATEST(COALESCE(rewards.stock_remaining, 0), EXCLUDED.stock_remaining),
      ends_at = GREATEST(COALESCE(rewards.ends_at, now()), EXCLUDED.ends_at),
      eligibility_json = EXCLUDED.eligibility_json,
      fulfillment_json = EXCLUDED.fulfillment_json,
      image_url = EXCLUDED.image_url,
      network_visible = true,
      updated_at = now()
    RETURNING *
  `;
  return rewardRows[0];
}

async function sendVoucherEmail(input: {
  to?: string | null;
  displayName?: string | null;
  code: string;
  seal: string;
  rewardTitle: string;
  tenantSlug: string;
  expiresAt: string;
  qrImageUrl?: string | null;
  publicToken?: string | null;
}) {
  const to = String(input.to || "").trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return "skipped_no_email";

  const from = env("CONSUMER_AUTH_FROM_EMAIL") || env("OTP_FROM_EMAIL") || env("SMTP_FROM_EMAIL") || env("SMTP_USER");
  if (!from) return "skipped_missing_from";

  const subject = `Tu voucher nexID ${input.code}`;
  const rewardUrl = input.publicToken ? publicRewardUrl(input.publicToken) : portalUrl({ code: input.code, tenantSlug: input.tenantSlug });
  const text = [
    `Hola ${input.displayName || "cliente"},`,
    "",
    `Tu voucher ${input.rewardTitle} quedo activado.`,
    `Codigo de canje: ${input.code}`,
    `Sello nexID: ${input.seal}`,
    `Valido hasta: ${formatArDate(input.expiresAt)}.`,
    "",
    "Mostra este codigo cuando llegues a la bodega o empresa. El staff lo valida desde el CRM nexID.",
    `Portal: ${rewardUrl}`,
  ].join("\n");
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;background:#020617;color:#f8fafc;padding:32px">
      <div style="max-width:560px;margin:0 auto;border:1px solid rgba(34,211,238,.25);border-radius:22px;overflow:hidden;background:#07111f">
        <div style="padding:28px;text-align:center;background:linear-gradient(135deg,#07111f,#0f172a)">
          <img src="${getLogoUrl()}" width="72" height="72" alt="nexID" style="border-radius:18px;display:block;margin:0 auto 14px" />
          <div style="font-size:24px;font-weight:900">Reward Pass nexID activado</div>
          <div style="margin-top:6px;color:#67e8f9;font-size:12px;letter-spacing:.16em;text-transform:uppercase">beneficio verificado</div>
        </div>
        <div style="padding:28px">
          <p style="margin:0 0 18px;color:#cbd5e1">Tu beneficio <b>${input.rewardTitle}</b> quedo reservado por 48h.</p>
          <div style="border:1px solid rgba(34,211,238,.35);background:#020617;border-radius:18px;padding:22px;text-align:center">
            <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.14em">Codigo de canje</div>
            <div style="font-size:34px;font-weight:900;letter-spacing:.12em;color:#67e8f9;margin-top:8px">${input.code}</div>
            <div style="margin-top:10px;font-size:12px;color:#94a3b8">Sello nexID: <b style="color:#fff">${input.seal}</b></div>
          </div>
          ${input.qrImageUrl ? `<div style="margin-top:18px;text-align:center"><img src="${input.qrImageUrl}" width="260" alt="Voucher nexID" style="max-width:100%;height:auto;border-radius:18px;border:1px solid rgba(34,211,238,.25)" /></div>` : ""}
          <p style="margin:18px 0 0;color:#cbd5e1">Valido hasta <b>${formatArDate(input.expiresAt)}</b>. Mostra este email o WhatsApp en el comercio para validar el premio, cena, experiencia o descuento.</p>
          <a href="${rewardUrl}" style="display:block;margin-top:22px;text-align:center;background:#22d3ee;color:#020617;text-decoration:none;font-weight:900;border-radius:14px;padding:14px">Abrir reward pass</a>
        </div>
      </div>
    </div>
  `;

  const resendKey = env("RESEND_API_KEY") || env("OTP_PROVIDER_API_KEY");
  if (resendKey) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, text, html }),
    });
    return response.ok ? "sent_resend" : `failed_resend_${response.status}`;
  }

  const smtpUser = env("SMTP_USER");
  const smtpPass = env("SMTP_PASSWORD");
  if (!smtpUser || !smtpPass) return "skipped_missing_provider";
  const host = env("SMTP_HOST") || "mail.privateemail.com";
  const configuredPort = Number(env("SMTP_PORT") || "465");
  const configs = [
    {
      port: configuredPort,
      secure: env("SMTP_SECURE") === "false" ? false : configuredPort === 465 || env("SMTP_SECURE") === "true",
    },
    { port: 587, secure: false },
  ].filter((config, index, all) => all.findIndex((item) => item.port === config.port && item.secure === config.secure) === index);
  try {
    let lastError = "";
    for (const config of configs) {
      try {
        const transporter = nodemailer.createTransport({
          host,
          port: config.port,
          secure: config.secure,
          auth: { user: smtpUser, pass: smtpPass },
        });
        await transporter.sendMail({ from, to, subject, text, html });
        return config.port === configuredPort ? "sent_smtp" : `sent_smtp_${config.port}`;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }
    console.warn("[nexid-voucher-email] smtp delivery failed", {
      host,
      ports: configs.map((config) => config.port),
      error: lastError.slice(0, 180),
    });
    return "failed_smtp";
  } catch (err) {
    console.warn("[nexid-voucher-email] smtp delivery crashed", {
      error: err instanceof Error ? err.message.slice(0, 180) : String(err).slice(0, 180),
    });
    return "failed_smtp";
  }
}

async function getLatestActiveVoucher(consumerId: string, tenantId: string) {
  const rows = await sql/*sql*/`
    SELECT c.*, r.title AS reward_title, t.slug AS tenant_slug
    FROM consumer_reward_claims c
    JOIN rewards r ON r.id = c.reward_id
    JOIN tenants t ON t.id = c.tenant_id
    WHERE c.consumer_id = ${consumerId}
      AND c.tenant_id = ${tenantId}
      AND c.status = 'claimed'
      AND c.created_at > now() - interval '48 hours'
    ORDER BY c.created_at DESC
    LIMIT 1
  `;
  const claim = rows[0];
  if (!claim) return null;
  const metadata = claim.metadata_json || {};
  const code = String(claim.redemption_code || "");
  const publicToken = await ensureRewardPublicToken(String(claim.id), metadata);
  return {
    claim,
    code,
    seal: String(metadata.verification_seal || redemptionSeal(code, consumerId, tenantId)),
    expiresAt: String(metadata.expires_at || new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()),
    rewardTitle: String(claim.reward_title || "Voucher nexID"),
    tenantSlug: String(claim.tenant_slug || PRIMARY_TENANT_SLUG),
    publicToken,
  };
}

async function attachEmailAndSendVoucherCopy(input: {
  req: Request;
  context: Record<string, any>;
  email: string;
}) {
  const consumerId = String(input.context.consumer_id || "");
  const tenantId = String(input.context.tenant_id || "");
  if (!consumerId || !tenantId) return { ok: false, reason: "consumer_not_found" };

  const email = input.email.trim().toLowerCase();
  const conflict = (await sql/*sql*/`
    SELECT id
    FROM consumers
    WHERE lower(email) = ${email}
      AND id <> ${consumerId}
    LIMIT 1
  `)[0];
  if (conflict?.id) return { ok: false, reason: "email_in_use" };

  await sql/*sql*/`
    UPDATE consumers
    SET email = ${email},
        status = CASE WHEN status = 'anonymous' THEN 'registered'::consumer_status ELSE status END,
        updated_at = now()
    WHERE id = ${consumerId}
  `;
  await sql/*sql*/`
    INSERT INTO consumer_identities (consumer_id, provider, provider_subject, verified_at)
    VALUES (${consumerId}, 'email_voucher_copy', ${email}, now())
    ON CONFLICT (provider, provider_subject) DO UPDATE SET consumer_id = EXCLUDED.consumer_id, verified_at = now(), updated_at = now()
  `;

  const voucher = await getLatestActiveVoucher(consumerId, tenantId);
  if (!voucher) {
    return { ok: true, reason: "email_saved_no_active_voucher", email };
  }

  const emailDelivery = await sendVoucherEmail({
    to: email,
    displayName: input.context.display_name || null,
    code: voucher.code,
    seal: voucher.seal,
    rewardTitle: voucher.rewardTitle,
    tenantSlug: voucher.tenantSlug,
    expiresAt: voucher.expiresAt,
    qrImageUrl: publicRewardPassUrl(input.req, voucher.publicToken),
    publicToken: voucher.publicToken,
  });

  await sql/*sql*/`
    UPDATE consumer_reward_claims
    SET metadata_json = metadata_json || ${JSON.stringify({
      voucher_email: email,
      voucher_email_delivery: emailDelivery,
      voucher_email_captured_at: new Date().toISOString(),
    })}::jsonb,
        updated_at = now()
    WHERE id = ${voucher.claim.id}
  `;

  return {
    ok: true,
    reason: emailDelivery,
    email,
    voucher,
  };
}

async function claimCampaignVoucher(input: {
  req: Request;
  context: Record<string, any>;
  phone: string;
  messageSid: string;
  buttonText: string;
  buttonPayload: string;
}) {
  const consumerId = String(input.context.consumer_id || "");
  const tenantId = String(input.context.tenant_id || "");
  const tenantSlug = String(input.context.tenant_slug || PRIMARY_TENANT_SLUG);
  if (!consumerId || !tenantId) return null;

  const reward = await ensureCampaignReward(tenantId, tenantSlug);
  const activeRows = await sql/*sql*/`
    SELECT c.*, r.title AS reward_title
    FROM consumer_reward_claims c
    JOIN rewards r ON r.id = c.reward_id
    WHERE c.consumer_id = ${consumerId}
      AND c.tenant_id = ${tenantId}
      AND r.code = ${CRM_VOUCHER_CODE}
      AND c.status = 'claimed'
      AND c.created_at > now() - interval '48 hours'
    ORDER BY c.created_at DESC
    LIMIT 1
  `;
  if (activeRows[0]) {
    const existing = activeRows[0];
    const metadata = existing.metadata_json || {};
    let code = String(existing.redemption_code);
    let seal = String(metadata.verification_seal || redemptionSeal(code, consumerId, tenantId));
    if (!/^\d{8}$/.test(code)) {
      code = await generateUniqueVoucherCode();
      seal = redemptionSeal(code, consumerId, tenantId);
      await sql/*sql*/`
        UPDATE consumer_reward_claims
        SET redemption_code = ${code},
            metadata_json = metadata_json || ${JSON.stringify({
              verification_seal: seal,
              previous_redemption_code: existing.redemption_code,
              upgraded_to_eight_digit_at: new Date().toISOString(),
            })}::jsonb,
            updated_at = now()
        WHERE id = ${existing.id}
      `;
      existing.redemption_code = code;
      existing.metadata_json = { ...metadata, verification_seal: seal };
    }
    const expiresAt = String(metadata.expires_at || new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString());
    const publicToken = await ensureRewardPublicToken(String(existing.id), existing.metadata_json || metadata);
    let emailDelivery = String(metadata.voucher_email_delivery || "previous");
    if (input.context.email) {
      emailDelivery = await sendVoucherEmail({
        to: input.context.email || null,
        displayName: input.context.display_name || null,
        code,
        seal,
        rewardTitle: String(existing.reward_title || reward.title),
        tenantSlug,
        expiresAt,
        qrImageUrl: publicRewardPassUrl(input.req, publicToken),
        publicToken,
      });
      await sql/*sql*/`
        UPDATE consumer_reward_claims
        SET metadata_json = metadata_json || ${JSON.stringify({
          voucher_email_delivery: emailDelivery,
          voucher_email_resent_at: new Date().toISOString(),
        })}::jsonb,
            updated_at = now()
        WHERE id = ${existing.id}
      `;
    }
    return {
      claim: existing,
      code,
      seal,
      expiresAt,
      rewardTitle: String(existing.reward_title || reward.title),
      duplicate: true,
      emailDelivery,
      publicToken,
    };
  }

  const stockRows = await sql/*sql*/`
    UPDATE rewards
    SET stock_remaining = CASE
      WHEN stock_remaining IS NULL THEN NULL
      WHEN stock_remaining > 0 THEN stock_remaining - 1
      ELSE stock_remaining
    END,
    updated_at = now()
    WHERE id = ${reward.id}
      AND (stock_remaining IS NULL OR stock_remaining > 0)
    RETURNING stock_remaining
  `;
  if (reward.stock_remaining !== null && !stockRows[0]) throw new Error("voucher_out_of_stock");

  const code = await generateUniqueVoucherCode();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const seal = redemptionSeal(code, consumerId, tenantId);
  const idempotencyKey = `twilio:${tenantId}:${consumerId}:${input.messageSid || randomBytes(8).toString("hex")}`;
  const metadata = {
    source: "twilio_whatsapp_campaign",
    channel: "whatsapp",
    campaign: "post_tap_mendoza_2x1",
    messageSid: input.messageSid || null,
    buttonText: input.buttonText || null,
    buttonPayload: input.buttonPayload || null,
    phone: input.phone,
    expires_at: expiresAt,
    verification_seal: seal,
    staff_instruction: "Validar codigo, telefono y sello nexID antes de entregar beneficio.",
  };
  const claimRows = await sql/*sql*/`
    INSERT INTO consumer_reward_claims (consumer_id, tenant_id, reward_id, tap_event_id, status, points_spent, redemption_code, idempotency_key, metadata_json)
    VALUES (${consumerId}, ${tenantId}, ${reward.id}, ${input.context.last_tap_event_id || null}, 'claimed', 0, ${code}, ${idempotencyKey}, ${JSON.stringify(metadata)}::jsonb)
    ON CONFLICT (idempotency_key) DO UPDATE SET updated_at = now()
    RETURNING *
  `;
  const publicToken = await ensureRewardPublicToken(String(claimRows[0].id), claimRows[0].metadata_json || metadata);

  await sql/*sql*/`
    INSERT INTO consumer_notifications (consumer_id, tenant_id, type, title, body, action_url)
    VALUES (${consumerId}, ${tenantId}, 'reward_claimed', 'Voucher nexID activado', ${`Codigo ${code} - ${reward.title}`}, ${publicRewardUrl(publicToken)})
  `;

  const emailDelivery = await sendVoucherEmail({
    to: input.context.email || null,
    displayName: input.context.display_name || null,
    code,
    seal,
    rewardTitle: String(reward.title),
    tenantSlug,
    expiresAt,
    qrImageUrl: publicRewardPassUrl(input.req, publicToken),
    publicToken,
  });

  await sql/*sql*/`
    UPDATE consumer_reward_claims
    SET metadata_json = metadata_json || ${JSON.stringify({ voucher_email_delivery: emailDelivery })}::jsonb,
        updated_at = now()
    WHERE id = ${claimRows[0].id}
  `;

  return { claim: claimRows[0], code, seal, expiresAt, rewardTitle: String(reward.title), duplicate: false, emailDelivery, publicToken };
}

export async function POST(req: Request) {
  await ensureConsumerPortalSchema();
  const form = await req.formData();
  const from = normalizePhone(clean(form.get("From")));
  const body = clean(form.get("Body"));
  const profileName = clean(form.get("ProfileName"));
  const buttonText = clean(form.get("ButtonText"));
  const buttonPayload = clean(form.get("ButtonPayload"));
  const messageSid = clean(form.get("MessageSid") || form.get("SmsMessageSid"));
  const intent = classifyIntent(body, buttonText, buttonPayload);
  const context = await resolveConsumerTenant(from);
  const submittedEmail = extractEmail(body);

  if (context?.consumer_id && profileName && profileName.length > 1) {
    await sql/*sql*/`
      UPDATE consumers
      SET display_name = CASE
            WHEN phone = ${from} OR display_name IS NULL OR display_name = '' OR lower(display_name) IN ('consumidor nexid', 'demo consumer', 'guillermo demo')
            THEN ${profileName}
            ELSE display_name
          END,
          updated_at = now()
      WHERE id = ${context.consumer_id}
    `;
    context.display_name = profileName || context.display_name;
  }

  if (submittedEmail) {
    const delivery = await attachEmailAndSendVoucherCopy({ req, context: context || {}, email: submittedEmail });
    await recordCampaignIntent({
      phone: from,
      profileName,
      body,
      buttonText,
      buttonPayload,
      messageSid,
      intent: "voucher_email_capture",
      consumerId: context?.consumer_id ? String(context.consumer_id) : null,
      tenantId: context?.tenant_id ? String(context.tenant_id) : null,
      tenantSlug: context?.tenant_slug ? String(context.tenant_slug) : PRIMARY_TENANT_SLUG,
      voucher: delivery && "voucher" in delivery && delivery.voucher ? {
        claimId: String(delivery.voucher.claim?.id || ""),
        redemptionCode: delivery.voucher.code,
        rewardTitle: delivery.voucher.rewardTitle,
        expiresAt: delivery.voucher.expiresAt,
        emailDelivery: String(delivery.reason || ""),
      } : null,
    });
    if (!delivery.ok) {
      return xml("No pude asociar ese email a tu cuenta nexID. Proba con otro correo o abri tu portal para actualizarlo.");
    }
    if (delivery.reason === "email_saved_no_active_voucher") {
      return xml("Listo, guardamos tu email para respaldo de beneficios. Cuando quieras activar esta promo, toca Quiero y emitimos el codigo por WhatsApp y email.");
    }
    const voucher = "voucher" in delivery ? delivery.voucher : null;
    const media = voucher ? publicRewardPassUrl(req, voucher.publicToken) : undefined;
    return xml([
      "Listo, guardamos tu email y reenviamos una copia segura del voucher.",
      voucher ? `Codigo: ${voucher.code}` : "",
      voucher ? `Sello: ${voucher.seal}` : "",
      voucher ? `Abrir reward pass: ${publicRewardUrl(voucher.publicToken)}` : "",
      "Tambien lo podes mostrar desde este WhatsApp.",
    ].filter(Boolean).join("\n"), 200, media);
  }

  if (context?.consumer_id && context?.tenant_id && (intent === "promo_yes" || intent === "promo_no")) {
    await updateConsent({ consumerId: String(context.consumer_id), tenantId: String(context.tenant_id), granted: intent === "promo_yes" });
    await sql/*sql*/`
      UPDATE tenant_consumer_memberships
      SET metadata_json = metadata_json || ${JSON.stringify({
        last_whatsapp_campaign_intent: intent,
        last_whatsapp_campaign_at: new Date().toISOString(),
      })}::jsonb,
      last_activity_at = now(),
      updated_at = now()
      WHERE consumer_id = ${context.consumer_id}
        AND tenant_id = ${context.tenant_id}
    `;
  }

  const voucher = intent === "promo_yes"
    ? await claimCampaignVoucher({
        req,
        context: context || {},
        phone: from,
        messageSid,
        buttonText,
        buttonPayload,
      })
    : null;

  await recordCampaignIntent({
    phone: from,
    profileName,
    body,
    buttonText,
    buttonPayload,
    messageSid,
    intent,
    consumerId: context?.consumer_id ? String(context.consumer_id) : null,
    tenantId: context?.tenant_id ? String(context.tenant_id) : null,
    tenantSlug: context?.tenant_slug ? String(context.tenant_slug) : PRIMARY_TENANT_SLUG,
    voucher: voucher ? {
      claimId: String(voucher.claim?.id || ""),
      redemptionCode: voucher.code,
      rewardTitle: voucher.rewardTitle,
      expiresAt: voucher.expiresAt,
      emailDelivery: voucher.emailDelivery,
    } : null,
  });

  if (intent === "promo_yes") {
    if (!context?.consumer_id) {
      return xml("Para emitir tu codigo de canje necesito que completes la verificacion nexID con este telefono. Abri tu portal, validalo y volve a tocar QUIERO.");
    }
    if (!voucher) {
      return xml(`No pude emitir el voucher ahora. Tu interes quedo registrado para ${PUBLIC_TENANT_NAME} y un operador puede reintentar desde CRM.`);
    }
    const emailLine = voucher.emailDelivery?.startsWith("sent")
      ? "Tambien te lo enviamos por email."
      : context?.email
        ? "Lo dejamos guardado en tu wallet nexID; si el email falla, este WhatsApp tambien sirve como comprobante."
        : "Para tener una copia segura por email, responde tu correo. Es opcional; este WhatsApp ya sirve como comprobante.";
    const media = publicRewardPassUrl(req, voucher.publicToken);
    return xml([
      "Voucher nexID activado",
      `Codigo de canje: ${voucher.code}`,
      `Sello: ${voucher.seal}`,
      `Beneficio: ${voucher.rewardTitle}`,
      `Valido hasta: ${formatArDate(voucher.expiresAt)}.`,
      `Abrir reward pass: ${publicRewardUrl(voucher.publicToken)}`,
      "Mostra este WhatsApp o el QR al llegar. El staff valida codigo y telefono en CRM.",
      emailLine,
    ].join("\n"), 200, media);
  }
  if (intent === "promo_no") {
    return xml(`Gracias. No te enviaremos esta promo. Si mas adelante queres beneficios de ${PUBLIC_TENANT_NAME}, responde QUIERO.`);
  }
  return xml("Soy nexID CRM. Para activar el voucher con codigo de canje responde QUIERO o toca el boton Quiero. Para rechazar esta promo, responde NO GRACIAS.");
}

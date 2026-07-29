import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!match) continue;
    let value = match[2] || "";
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

function sha(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function maskPhone(value) {
  return String(value || "").replace(/(\+\d{5})\d+(\d{3})/, "$1***$2");
}

function basicAuth(user, pass) {
  return Buffer.from(`${user}:${pass}`).toString("base64");
}

function unescapeXml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractMessageXml(xml) {
  const media = [...xml.matchAll(/<Media>([\s\S]*?)<\/Media>/g)].map((match) => unescapeXml(match[1]));
  const body = xml
    .replace(/^([\s\S]*?<Message>)/, "")
    .replace(/<Media>[\s\S]*?<\/Media>/g, "")
    .replace(/<\/Message>[\s\S]*$/, "");
  return { body: unescapeXml(body).trim(), media };
}

async function requestJson(apiBase, pathname, options = {}) {
  const res = await fetch(`${apiBase}${pathname}`, { cache: "no-store", ...options });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // Some endpoints return TwiML.
  }
  return { res, text, json };
}

async function requireOk(label, result) {
  if (result.res.ok) return result;
  throw new Error(`${label} failed ${result.res.status}: ${result.text.slice(0, 600)}`);
}

async function latestOtp(sql, contact) {
  const rows = await sql`
    SELECT code_hash
    FROM consumer_auth_challenges
    WHERE contact = ${contact}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  if (!rows[0]) throw new Error("otp_not_found_in_db_after_delivery");
  const target = rows[0].code_hash;
  for (let i = 100000; i <= 999999; i += 1) {
    const candidate = String(i);
    if (sha(candidate) === target) return candidate;
  }
  throw new Error("otp_bruteforce_failed");
}

async function sendTwilioDirect({ to, body, mediaUrl }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const configuredFrom = process.env.TWILIO_WHATSAPP_FROM || process.env.TWILIO_FROM_WHATSAPP || "+14155238886";
  if (!accountSid || !authToken) throw new Error("twilio_credentials_missing_for_direct_send");

  const form = new URLSearchParams();
  form.set("To", `whatsapp:${to}`);
  form.set("From", `whatsapp:${configuredFrom.replace(/^whatsapp:/, "")}`);
  form.set("Body", body);
  if (mediaUrl) form.append("MediaUrl", mediaUrl);

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth(accountSid, authToken)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`twilio_direct_failed ${res.status}: ${JSON.stringify({ code: payload.code, message: payload.message })}`);
  }
  return payload;
}

async function main() {
  loadEnv(path.resolve("apps/api/.env.local"));
  const apiBase = process.env.LIVE_API_BASE || "https://api.nexid.lat";
  const adminSessionToken = process.env.NEXID_ADMIN_SESSION_TOKEN || process.env.LIVE_ADMIN_SESSION_TOKEN;
  const twilioPreviewKey = process.env.TWILIO_PREVIEW_INTERNAL_KEY;
  const databaseUrl = process.env.DATABASE_URL;
  if (!adminSessionToken || !databaseUrl) throw new Error("NEXID_ADMIN_SESSION_TOKEN_or_DATABASE_URL_missing");

  const sql = neon(databaseUrl);
  const phone = process.env.LIVE_PROD_PHONE || process.env.LIVE_DEMO_PHONE || "+5492613168608";
  const bid = process.env.LIVE_PROD_BID || process.env.LIVE_DEMO_BID || "DEMO-2026-02";
  const uidHex = process.env.LIVE_PROD_UID || process.env.LIVE_DEMO_UID || "0474856A0B1090";
  const automateFlow = process.env.LIVE_AUTOMATE_FLOW === "1";
  const automateLogin = automateFlow || process.env.LIVE_AUTOMATE_LOGIN === "1";
  const automateReply = automateFlow || process.env.LIVE_AUTOMATE_REPLY === "1";
  const location = {
    city: process.env.LIVE_PROD_CITY || process.env.LIVE_DEMO_CITY || "Mendoza",
    countryCode: process.env.LIVE_PROD_COUNTRY || process.env.LIVE_DEMO_COUNTRY || "AR",
    lat: Number(process.env.LIVE_PROD_LAT || process.env.LIVE_DEMO_LAT || "-32.8895"),
    lng: Number(process.env.LIVE_PROD_LNG || process.env.LIVE_DEMO_LNG || "-68.8458"),
    label: process.env.LIVE_PROD_LOCATION_LABEL || process.env.LIVE_DEMO_LOCATION_LABEL || "Feria de Vinos Mendoza - stand Bodega Balmec",
  };

  const summary = {
    api: apiBase,
    phone: maskPhone(phone),
    bid,
    uidHex,
    location: location.label,
    automation: {
      login: automateLogin,
      replyQuiero: automateReply,
      mode: automateFlow ? "full-automation" : automateLogin ? "login-only" : "human-safe",
    },
  };

  const beforeConsumer = await sql`
    SELECT id, display_name, email, phone
    FROM consumers
    WHERE phone = ${phone}
    LIMIT 1
  `;
  summary.consumerBefore = beforeConsumer[0]
    ? {
        id: beforeConsumer[0].id,
        displayName: beforeConsumer[0].display_name,
        email: beforeConsumer[0].email,
        phone: maskPhone(beforeConsumer[0].phone),
      }
    : null;

  const tap = await requireOk("live scan", await requestJson(apiBase, "/internal/demo/scan", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${adminSessionToken}` },
    body: JSON.stringify({
      bid,
      uidHex,
      action: "verify",
      city: location.city,
      countryCode: location.countryCode,
      lat: location.lat,
      lng: location.lng,
      deviceLabel: `iPhone feria/vinoteca - ${location.label}`,
    }),
  }));
  summary.tapResponse = {
    status: tap.res.status,
    result: tap.json?.result || tap.json?.verdict || tap.json?.status,
    cmacValid: tap.json?.cmacValid ?? tap.json?.cmac_valid ?? null,
    source: tap.json?.source,
  };

  const eventRows = await sql`
    SELECT id, result, verdict, risk_level, city, country_code, lat, lng, created_at
    FROM events
    WHERE bid = ${bid}
      AND uid_hex = ${uidHex}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const event = eventRows[0];
  if (!event) throw new Error("tap_event_not_found_after_scan");
  summary.event = {
    id: event.id,
    result: event.result,
    verdict: event.verdict,
    riskLevel: event.risk_level,
    city: event.city,
    countryCode: event.country_code,
    createdAt: event.created_at,
  };

  const authStart = await requireOk("consumer auth start", await requestJson(apiBase, "/consumer/auth/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone }),
  }));
  summary.authStart = {
    status: authStart.res.status,
    deliveryChannel: authStart.json?.deliveryChannel,
    twoFactor: authStart.json?.twoFactor,
    ttlMinutes: authStart.json?.ttlMinutes,
  };

  if (!automateLogin) {
    summary.nextHumanStep = [
      "OTP enviado al usuario. El script se detuvo antes de leer/consumir el codigo.",
      "Abrir el link recibido por WhatsApp/email y completar login manual.",
      "Para automatizar login en un entorno controlado: LIVE_AUTOMATE_LOGIN=1.",
      "Para automatizar tambien la respuesta Quiero y emitir voucher: LIVE_AUTOMATE_FLOW=1.",
    ];
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const otp = await latestOtp(sql, phone);
  summary.otpRetrievedFromDbHash = true;

  const verify = await requireOk("consumer auth verify", await requestJson(apiBase, "/consumer/auth/verify", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 nexID-live-flow",
    },
    body: JSON.stringify({ phone, code: otp }),
  }));
  const setCookie = verify.res.headers.get("set-cookie") || "";
  const cookieMatch = setCookie.match(/nexid_consumer_session=([^;]+)/);
  if (!cookieMatch) throw new Error("consumer_session_cookie_missing");
  const cookieHeader = `nexid_consumer_session=${cookieMatch[1]}`;
  summary.authVerify = {
    status: verify.res.status,
    consumerId: verify.json?.consumer?.id,
    displayName: verify.json?.consumer?.display_name || null,
  };

  const join = await requireOk("join tenant", await requestJson(apiBase, `/mobile/passport/${event.id}/consumer/join-tenant`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookieHeader },
    body: JSON.stringify({ bid, marketingConsent: true }),
  }));
  summary.joinTenant = {
    status: join.res.status,
    membershipId: join.json?.membership?.id || null,
    pointsBalance: join.json?.membership?.points_balance ?? null,
  };

  const promptBody = [
    "Hola Marcelo, tu tap verificado en Feria de Vinos Mendoza sobre Gran Reserva Malbec de Bodega Balmec activo un beneficio:",
    "2x1 en copa de bienvenida por 48h.",
    "Toca Quiero para emitir código de canje con QR; toca No gracias para pausar esta promo. Stop para salir.",
  ].join(" ");
  const campaign = await requireOk("whatsapp campaign prompt", await requestJson(apiBase, "/admin/campaigns/test-whatsapp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${adminSessionToken}` },
    body: JSON.stringify({
      to: phone,
      confirmRecipientOptIn: true,
      sandbox: true,
      body: promptBody,
      quickReplies: [
        { title: "Quiero", id: "promo_yes" },
        { title: "No gracias", id: "promo_no" },
      ],
    }),
  }));
  summary.whatsappPrompt = {
    status: campaign.res.status,
    sid: campaign.json?.sid,
    contentSid: campaign.json?.contentSid,
    twilioStatus: campaign.json?.status,
    to: campaign.json?.to,
  };

  if (!automateReply) {
    summary.nextHumanStep = [
      "Prompt enviado por WhatsApp con botones Quiero/No gracias.",
      "El script se detuvo antes de simular Quiero para que el voucher solo salga por accion humana.",
      "Para automatizar el click Quiero en un entorno controlado: LIVE_AUTOMATE_REPLY=1.",
    ];
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  if (!twilioPreviewKey) throw new Error("TWILIO_PREVIEW_INTERNAL_KEY_missing_for_automated_reply");

  const inboundForm = new URLSearchParams();
  inboundForm.set("From", `whatsapp:${phone}`);
  inboundForm.set("To", "whatsapp:+14155238886");
  inboundForm.set("Body", "Quiero");
  inboundForm.set("ProfileName", "Marcelo Guillen");
  inboundForm.set("ButtonText", "Quiero");
  inboundForm.set("ButtonPayload", "promo_yes");
  inboundForm.set("MessageSid", `SM_codex_live_${Date.now()}`);
  const inboundRes = await fetch(`${apiBase}/twilio/whatsapp/inbound`, {
    method: "POST",
    headers: { "x-nexid-internal-key": twilioPreviewKey },
    body: inboundForm,
  });
  const inboundText = await inboundRes.text();
  if (!inboundRes.ok) throw new Error(`twilio inbound failed ${inboundRes.status}: ${inboundText.slice(0, 600)}`);
  const inbound = extractMessageXml(inboundText);
  summary.inboundWebhook = {
    status: inboundRes.status,
    bodyPreview: inbound.body.slice(0, 180),
    media: inbound.media,
  };

  const voucherSend = await sendTwilioDirect({ to: phone, body: inbound.body, mediaUrl: inbound.media[0] });
  summary.voucherWhatsapp = {
    sid: voucherSend.sid,
    status: voucherSend.status,
    mediaSent: Boolean(inbound.media[0]),
  };

  const claimRows = await sql`
    SELECT c.id, c.redemption_code, c.status, c.tap_event_id, c.created_at, c.metadata_json,
      r.title AS reward_title, t.slug AS tenant_slug
    FROM consumer_reward_claims c
    JOIN rewards r ON r.id = c.reward_id
    JOIN tenants t ON t.id = c.tenant_id
    WHERE c.consumer_id = ${verify.json.consumer.id}
      AND t.slug IN ('bodegabalmec', 'demobodega')
    ORDER BY c.created_at DESC
    LIMIT 1
  `;
  const claim = claimRows[0];
  if (!claim) throw new Error("voucher_claim_not_found");
  summary.voucherClaim = {
    id: claim.id,
    code: claim.redemption_code,
    status: claim.status,
    rewardTitle: claim.reward_title,
    tenantSlug: claim.tenant_slug,
    seal: claim.metadata_json?.verification_seal || null,
    expiresAt: claim.metadata_json?.expires_at || null,
    emailDelivery: claim.metadata_json?.voucher_email_delivery || null,
  };

  const validate = await requireOk("admin voucher lookup", await requestJson(apiBase, "/admin/rewards/redemptions/validate", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${adminSessionToken}` },
    body: JSON.stringify({ code: claim.redemption_code, action: "lookup" }),
  }));
  summary.voucherValidation = {
    status: validate.res.status,
    ok: validate.json?.ok,
    action: validate.json?.action,
    redemptionStatus: validate.json?.redemption?.status,
    phoneMasked: validate.json?.redemption?.consumer?.phone_masked,
  };

  const tapHistory = await sql`
    SELECT tap_event_id, verdict, city, country, created_at
    FROM consumer_tap_history
    WHERE consumer_id = ${verify.json.consumer.id}
    ORDER BY created_at DESC
    LIMIT 3
  `;
  summary.consumerTapHistory = tapHistory;

  const membership = await sql`
    SELECT points_balance, last_tap_event_id, last_activity_at
    FROM tenant_consumer_memberships
    WHERE consumer_id = ${verify.json.consumer.id}
      AND tenant_id = (SELECT id FROM tenants WHERE slug IN ('bodegabalmec', 'demobodega') ORDER BY (slug='bodegabalmec') DESC LIMIT 1)
    LIMIT 1
  `;
  summary.membershipAfter = membership[0] || null;

  const leads = await sql`
    SELECT id, status, role_interest, source, message, created_at, meta
    FROM leads
    WHERE phone = ${phone}
    ORDER BY created_at DESC
    LIMIT 3
  `;
  summary.crmLeads = leads.map((lead) => ({
    id: lead.id,
    status: lead.status,
    roleInterest: lead.role_interest,
    source: lead.source,
    message: lead.message,
    createdAt: lead.created_at,
    voucher: lead.meta?.voucher || null,
  }));

  const rewards = await fetch(`${apiBase}/consumer/rewards`, { headers: { cookie: cookieHeader }, cache: "no-store" });
  const rewardsPayload = await rewards.json().catch(() => ({}));
  summary.consumerRewards = {
    status: rewards.status,
    sample: rewardsPayload.items?.slice?.(0, 5)?.map((reward) => ({
      title: reward.title,
      state: reward.state,
      code: reward.redemption_code || null,
    })) || [],
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("LIVE_PRODUCTION_FLOW_ERROR", error?.stack || error);
  process.exit(1);
});

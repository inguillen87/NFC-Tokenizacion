export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, checkAdminPermission, getAdminPrincipal } from "../../../../lib/auth";
import { json } from "../../../../lib/http";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../lib/bounded-request-body";
import { adminCriticalRateLimitIdentity, enforceCriticalRateLimit } from "../../../../lib/critical-rate-limit";
import { resolveAdminWriteTenant, tenantReference } from "../../../../lib/admin-commercial-policy";
import { ensureConsumerPortalSchema } from "../../../../lib/commercial-runtime-schema";
import { sql } from "../../../../lib/db";
import { logAuditEvent } from "../../../../lib/audit-logger";
import { getRequestMeta } from "../../../../lib/request-meta";

function env(name: string) {
  return String(process.env[name] || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .trim();
}

function normalizePhone(input: unknown) {
  const raw = String(input || "").trim();
  const digits = raw.replace(/[^\d]/g, "");
  if (!/^[1-9]\d{7,14}$/.test(digits)) return "";
  return raw.startsWith("+") ? `+${digits}` : `+${digits}`;
}

function maskPhone(phone: string) {
  return `${phone.slice(0, 5)}***${phone.slice(-3)}`;
}

function clampBody(input: unknown) {
  return String(input || "").trim().slice(0, 1024);
}

function normalizeQuickReplies(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const raw = item as Record<string, unknown>;
      const title = String(raw.title || "").trim().slice(0, 20);
      const id = String(raw.id || title.toLowerCase().replace(/[^a-z0-9]+/g, "_")).trim().slice(0, 200);
      return title && id ? { title, id } : null;
    })
    .filter(Boolean)
    .slice(0, 3) as Array<{ title: string; id: string }>;
}

async function createInteractiveContent(input: {
  accountSid: string;
  authToken: string;
  body: string;
  actions: Array<{ title: string; id: string }>;
}) {
  const basic = Buffer.from(`${input.accountSid}:${input.authToken}`).toString("base64");
  const actionItems = input.actions.map((item) => ({
    type: "QUICK_REPLY",
    title: item.title,
    id: item.id,
  }));
  const types: Record<string, unknown> = {
    "twilio/text": {
      body: `${input.body}\nResponde ${input.actions.map((item) => item.title.toUpperCase()).join(" o ")}.`,
    },
  };
  types["twilio/quick-reply"] = {
    body: input.body,
    actions: input.actions,
  };

  const response = await fetch("https://content.twilio.com/v1/Content", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      friendly_name: `nexid_sandbox_quick_reply_${Date.now()}`,
      language: "es",
      types,
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`twilio_content_failed:${response.status}:${result?.message || result?.code || "unknown"}`);
  }
  return String(result?.sid || "");
}

async function sendTwilioMessage(input: {
  accountSid: string;
  authToken: string;
  form: URLSearchParams;
}) {
  const basic = Buffer.from(`${input.accountSid}:${input.authToken}`).toString("base64");
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${input.accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: input.form,
  });
  const result = await response.json().catch(() => ({}));
  return { response, result };
}

export async function POST(req: Request) {
  const auth = await checkAdmin(req, ["super_admin", "tenant_admin"]);
  if (auth) return auth;
  const permission = checkAdminPermission(req, "campaigns:test_whatsapp");
  if (permission) return permission;
  const principal = getAdminPrincipal(req);
  const rateLimited = await enforceCriticalRateLimit(req, {
    rateClass: "ai_expensive",
    ...adminCriticalRateLimitIdentity(req),
  });
  if (rateLimited) return rateLimited;

  let payload: Record<string, unknown>;
  try {
    payload = await readBoundedJsonBody<Record<string, unknown>>(req, 16 * 1024);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, reason: tooLarge ? "request_body_too_large" : "invalid_json" }, tooLarge ? 413 : 400);
  }
  const toPhone = normalizePhone(payload?.to);
  const body = clampBody(payload?.body);
  const sandbox = payload?.sandbox !== false;
  const quickReplies = normalizeQuickReplies(payload?.quickReplies);

  if (!toPhone) {
    return json({ ok: false, reason: "recipient_phone_required" }, 400);
  }
  if (!body || body.length < 20) {
    return json({ ok: false, reason: "message_body_too_short" }, 400);
  }
  if (!sandbox) {
    return json({ ok: false, reason: "sandbox_only_endpoint" }, 400);
  }

  await ensureConsumerPortalSchema();
  const requestUrl = new URL(req.url);
  const explicitTenantValues = [
    payload.tenantId,
    payload.tenant_id,
    payload.tenantSlug,
    payload.tenant_slug,
    payload.tenant,
    requestUrl.searchParams.get("tenant"),
  ].map((value) => String(value || "").trim()).filter(Boolean);
  const tenantReferences = [
    { tenantId: payload.tenantId },
    { tenantId: payload.tenant_id },
    { tenantSlug: payload.tenantSlug },
    { tenantSlug: payload.tenant_slug },
    tenantReference(payload.tenant),
    tenantReference(requestUrl.searchParams.get("tenant")),
  ];
  let tenantId = "";
  if (principal.scope !== "super_admin" || explicitTenantValues.length) {
    const tenantResult = await resolveAdminWriteTenant({
      principal,
      references: tenantReferences,
      lookup: async ({ tenantId: requestedId, tenantSlug }) => (await sql/*sql*/`
        SELECT id::text AS id, lower(slug) AS slug
        FROM tenants
        WHERE (${requestedId} = '' OR id::text = ${requestedId})
          AND (${tenantSlug} = '' OR lower(slug) = ${tenantSlug})
        LIMIT 2
      `) as Array<{ id: unknown; slug: unknown }>,
    });
    if (!tenantResult.ok) return json({ ok: false, reason: tenantResult.reason }, tenantResult.status);
    tenantId = tenantResult.tenant.tenantId;
  }

  const consentRows = await sql/*sql*/`
    SELECT DISTINCT
      consumer.id::text AS consumer_id,
      tenant.id::text AS tenant_id,
      lower(tenant.slug) AS tenant_slug
    FROM consumers consumer
    JOIN tenant_consumer_memberships membership
      ON membership.consumer_id = consumer.id
     AND membership.status = 'active'
    JOIN tenants tenant ON tenant.id = membership.tenant_id
    WHERE consumer.phone = ${toPhone}
      AND (${tenantId} = '' OR tenant.id::text = ${tenantId})
      AND EXISTS (
        SELECT 1
        FROM consumer_tenant_consents consent
        WHERE consent.tenant_id = tenant.id
          AND consent.consumer_id = consumer.id
          AND consent.granted = true
          AND consent.revoked_at IS NULL
          AND lower(consent.scope) IN ('whatsapp', 'whatsapp_marketing', 'phone_marketing')
      )
    ORDER BY tenant_id, consumer_id
    LIMIT 3
  `;
  if (consentRows.length !== 1) {
    const reason = consentRows.length > 1 ? "recipient_consent_ambiguous" : "recipient_persisted_opt_in_required";
    const requestMeta = getRequestMeta(req);
    const audit = await logAuditEvent({
      actorId: principal.userId,
      tenantId: tenantId || null,
      action: "campaign_test_whatsapp_denied",
      resourceType: "consumer",
      afterData: { reason, sandbox: true },
      ipAddress: requestMeta.ip,
      userAgent: requestMeta.userAgent,
      requestId: requestMeta.traceId,
    });
    return json({ ok: false, reason, warning: audit.ok ? null : audit.reason }, consentRows.length > 1 ? 409 : 403);
  }
  const consent = consentRows[0] as Record<string, unknown>;
  tenantId = String(consent.tenant_id || "");
  const consumerId = String(consent.consumer_id || "");

  const accountSid = env("TWILIO_ACCOUNT_SID");
  const authToken = env("TWILIO_AUTH_TOKEN");
  const configuredFrom = env("TWILIO_WHATSAPP_FROM") || env("TWILIO_FROM_WHATSAPP");
  const from = configuredFrom ? `whatsapp:${configuredFrom.replace(/^whatsapp:/, "")}` : "whatsapp:+14155238886";

  if (!accountSid || !authToken) {
    return json({ ok: false, reason: "twilio_credentials_missing" }, 503);
  }

  const form = new URLSearchParams();
  form.set("To", `whatsapp:${toPhone}`);
  form.set("From", from);
  let contentSid: string | null = null;
  let response: Response;
  let result: Record<string, unknown>;
  try {
    if (quickReplies.length) {
      contentSid = await createInteractiveContent({ accountSid, authToken, body, actions: quickReplies });
      form.set("ContentSid", contentSid);
    } else {
      form.set("Body", body);
    }
    const delivery = await sendTwilioMessage({ accountSid, authToken, form });
    response = delivery.response;
    result = delivery.result as Record<string, unknown>;
  } catch {
    const requestMeta = getRequestMeta(req);
    const audit = await logAuditEvent({
      actorId: principal.userId,
      tenantId,
      action: "campaign_test_whatsapp_failed",
      resourceType: "consumer",
      resourceId: consumerId,
      afterData: { reason: "twilio_delivery_failed", sandbox: true },
      ipAddress: requestMeta.ip,
      userAgent: requestMeta.userAgent,
      requestId: requestMeta.traceId,
    });
    return json({ ok: false, reason: "twilio_delivery_failed", warning: audit.ok ? null : audit.reason }, 502);
  }
  if (!response.ok) {
    const requestMeta = getRequestMeta(req);
    const audit = await logAuditEvent({
      actorId: principal.userId,
      tenantId,
      action: "campaign_test_whatsapp_failed",
      resourceType: "consumer",
      resourceId: consumerId,
      afterData: { reason: "twilio_delivery_failed", provider_status: response.status, sandbox: true },
      ipAddress: requestMeta.ip,
      userAgent: requestMeta.userAgent,
      requestId: requestMeta.traceId,
    });
    return json({
      ok: false,
      reason: "twilio_delivery_failed",
      status: response.status,
      to: maskPhone(toPhone),
      from,
      twilio: {
        code: result?.code || null,
        message: result?.message || null,
        moreInfo: result?.more_info || null,
      },
      warning: audit.ok ? null : audit.reason,
    }, 502);
  }

  const requestMeta = getRequestMeta(req);
  const audit = await logAuditEvent({
    actorId: principal.userId,
    tenantId,
    action: "campaign_test_whatsapp_queued",
    resourceType: "consumer",
    resourceId: consumerId,
    afterData: {
      provider_status: result?.status || "queued",
      provider_message_id: result?.sid || null,
      content_id: contentSid,
      sandbox: true,
    },
    ipAddress: requestMeta.ip,
    userAgent: requestMeta.userAgent,
    requestId: requestMeta.traceId,
  });

  return json({
    ok: true,
    sid: result?.sid || null,
    contentSid,
    mediaUrl: null,
    status: result?.status || "queued",
    to: maskPhone(toPhone),
    from,
    warning: audit.ok ? null : audit.reason,
  });
}

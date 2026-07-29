export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminTenantScope } from "../../../../lib/auth";
import { ensureSdkSchema } from "../../../../lib/commercial-runtime-schema";
import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";
import { normalizeWebhookUrl, resolveWebhookDestination, safeWebhookError } from "../../../../lib/webhook-egress";
import {
  decryptWebhookSigningSecret,
  encryptWebhookSigningSecret,
  WebhookSecretCipherError,
} from "../../../../lib/webhook-secret-cipher";
import {
  normalizeWebhookSignatureVersion,
  webhookSigningSecretIssue,
} from "../../../../lib/webhook-signing";
import { adminCriticalRateLimitIdentity, enforceCriticalRateLimit } from "../../../../lib/critical-rate-limit";

function clean(value: unknown) {
  return String(value || "").trim();
}

function secretStorageError(error: unknown) {
  const reason = error instanceof WebhookSecretCipherError
    ? error.code
    : "webhook_signing_secret_storage_unavailable";
  return json({ error: "webhook signing secret storage unavailable", reason }, 503);
}

async function tenantScopeId(req: Request) {
  const tenantScope = getAdminTenantScope(req).forcedTenantSlug;
  if (!tenantScope) return null;
  const rows = await sql/*sql*/`SELECT id::text AS id FROM tenants WHERE slug = ${tenantScope} LIMIT 1`;
  return rows[0]?.id ? String(rows[0].id) : "__missing__";
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await checkAdmin(req);
  if (auth) return auth;
  const rateLimited = await enforceCriticalRateLimit(req, {
    rateClass: "webhook",
    ...adminCriticalRateLimitIdentity(req),
  });
  if (rateLimited) return rateLimited;
  await ensureSdkSchema();

  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const tenantId = await tenantScopeId(req);
  if (tenantId === "__missing__") return json({ error: "tenant not found" }, 404);
  const name = clean(body?.name);
  const rawUrl = clean(body?.url);
  const signingSecret = clean(body?.signingSecret || body?.signing_secret);
  const rawSignatureVersion = clean(body?.signatureVersion || body?.signature_version);
  const signatureVersion = rawSignatureVersion
    ? normalizeWebhookSignatureVersion(rawSignatureVersion)
    : null;
  const enabled = body?.enabled;
  const events = Array.isArray(body?.events) ? body.events.map(clean).filter(Boolean) : null;

  const currentRows = await sql/*sql*/`
    SELECT tenant_id::text AS tenant_id, url, enabled, signing_secret, signature_version
    FROM webhook_endpoints
    WHERE id = ${id}
      AND (${tenantId}::text IS NULL OR tenant_id::text = ${tenantId})
    LIMIT 1
  `;
  const current = currentRows[0] as { tenant_id?: string; url?: string; enabled?: boolean; signing_secret?: string | null; signature_version?: string } | undefined;
  if (!current) return json({ error: "webhook not found" }, 404);
  if (rawSignatureVersion && !signatureVersion) {
    return json({ error: "invalid webhook signature version", reason: "webhook_signature_version_invalid" }, 400);
  }

  const effectiveEnabled = typeof enabled === "boolean" ? enabled : Boolean(current.enabled);
  let effectiveSigningSecret = signingSecret;
  if (effectiveEnabled && !effectiveSigningSecret) {
    try {
      effectiveSigningSecret = decryptWebhookSigningSecret(
        current.signing_secret,
        { tenantId: String(current.tenant_id || "") },
      );
    } catch (error) {
      return secretStorageError(error);
    }
  }
  const secretIssue = effectiveEnabled
    ? webhookSigningSecretIssue(effectiveSigningSecret, { required: true })
    : webhookSigningSecretIssue(signingSecret, { required: false });
  if (secretIssue) {
    return json({ error: "invalid webhook signing secret", reason: secretIssue }, 400);
  }

  let encryptedSigningSecret: string | null = null;
  if (signingSecret) {
    try {
      encryptedSigningSecret = encryptWebhookSigningSecret(
        signingSecret,
        { tenantId: String(current.tenant_id || "") },
      );
    } catch (error) {
      return secretStorageError(error);
    }
  }

  let url = "";
  try {
    url = rawUrl ? normalizeWebhookUrl(rawUrl).toString() : "";
    const effectiveUrl = url || String(current.url || "");
    if (effectiveEnabled) await resolveWebhookDestination(effectiveUrl);
  } catch (error) {
    return json({ error: "invalid webhook URL", reason: safeWebhookError(error).code }, 400);
  }

  const rows = await sql/*sql*/`
    UPDATE webhook_endpoints
    SET
      name = COALESCE(${name || null}, name),
      url = COALESCE(${url || null}, url),
      signing_secret = COALESCE(${encryptedSigningSecret}, signing_secret),
      signature_version = COALESCE(${signatureVersion}, signature_version),
      enabled = COALESCE(${typeof enabled === "boolean" ? enabled : null}, enabled),
      events = COALESCE(${events ? JSON.stringify(events) : null}::jsonb, events),
      updated_at = now()
    WHERE id = ${id}
      AND (${tenantId}::text IS NULL OR tenant_id::text = ${tenantId})
    RETURNING id::text AS id, tenant_id::text AS tenant_id, name, url, enabled, events, signature_version, (signing_secret IS NOT NULL AND signing_secret <> '') AS has_signing_secret, updated_at
  `;

  if (!rows[0]) return json({ error: "webhook not found" }, 404);
  return json({ ok: true, endpoint: rows[0] });
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await checkAdmin(req);
  if (auth) return auth;
  const rateLimited = await enforceCriticalRateLimit(req, {
    rateClass: "webhook",
    ...adminCriticalRateLimitIdentity(req),
  });
  if (rateLimited) return rateLimited;
  await ensureSdkSchema();

  const { id } = await context.params;
  const tenantId = await tenantScopeId(req);
  if (tenantId === "__missing__") return json({ error: "tenant not found" }, 404);
  const rows = await sql/*sql*/`
    DELETE FROM webhook_endpoints
    WHERE id = ${id}
      AND (${tenantId}::text IS NULL OR tenant_id::text = ${tenantId})
    RETURNING id
  `;
  if (!rows[0]) return json({ error: "webhook not found" }, 404);
  return json({ ok: true, deleted: rows[0].id });
}

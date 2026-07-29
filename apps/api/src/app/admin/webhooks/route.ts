export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminTenantScope } from "../../../lib/auth";
import { ensureSdkSchema } from "../../../lib/commercial-runtime-schema";
import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";
import { normalizeWebhookUrl, resolveWebhookDestination, safeWebhookError } from "../../../lib/webhook-egress";
import {
  decryptWebhookSigningSecret,
  encryptWebhookSigningSecret,
  WebhookSecretCipherError,
} from "../../../lib/webhook-secret-cipher";
import {
  normalizeWebhookSignatureVersion,
  webhookSigningSecretIssue,
} from "../../../lib/webhook-signing";
import { adminCriticalRateLimitIdentity, enforceCriticalRateLimit } from "../../../lib/critical-rate-limit";

function clean(value: unknown) {
  return String(value || "").trim();
}

function secretStorageError(error: unknown) {
  const reason = error instanceof WebhookSecretCipherError
    ? error.code
    : "webhook_signing_secret_storage_unavailable";
  return json({ error: "webhook signing secret storage unavailable", reason }, 503);
}

async function resolveTenant(req: Request, requestedTenant?: string | null) {
  const tenantSlug = clean(getAdminTenantScope(req).forcedTenantSlug || requestedTenant).toLowerCase();
  if (!tenantSlug) return null;
  const rows = await sql/*sql*/`
    SELECT id::text AS id, slug, name
    FROM tenants
    WHERE slug = ${tenantSlug} OR id::text = ${tenantSlug}
    LIMIT 1
  `;
  return rows[0] as { id: string; slug: string; name: string } | undefined;
}

export async function GET(req: Request) {
  const auth = await checkAdmin(req);
  if (auth) return auth;
  await ensureSdkSchema();

  const { searchParams } = new URL(req.url);
  const tenant = await resolveTenant(req, searchParams.get("tenant"));
  if (getAdminTenantScope(req).forcedTenantSlug && !tenant) return json({ ok: false, reason: "tenant_not_found" }, 404);

  const rows = tenant
    ? await sql/*sql*/`
      SELECT we.id::text AS id, tn.slug AS tenant_slug, we.name, we.url, we.enabled, we.events, we.signature_version, (we.signing_secret IS NOT NULL AND we.signing_secret <> '') AS has_signing_secret, we.created_at, we.updated_at
      FROM webhook_endpoints we
      JOIN tenants tn ON tn.id = we.tenant_id
      WHERE we.tenant_id = ${tenant.id}
      ORDER BY we.updated_at DESC
    `
    : await sql/*sql*/`
      SELECT we.id::text AS id, tn.slug AS tenant_slug, we.name, we.url, we.enabled, we.events, we.signature_version, (we.signing_secret IS NOT NULL AND we.signing_secret <> '') AS has_signing_secret, we.created_at, we.updated_at
      FROM webhook_endpoints we
      JOIN tenants tn ON tn.id = we.tenant_id
      ORDER BY we.updated_at DESC
      LIMIT 200
    `;

  return json(rows);
}

export async function POST(req: Request) {
  const auth = await checkAdmin(req);
  if (auth) return auth;
  const rateLimited = await enforceCriticalRateLimit(req, {
    rateClass: "webhook",
    ...adminCriticalRateLimitIdentity(req),
  });
  if (rateLimited) return rateLimited;
  await ensureSdkSchema();

  const body = await req.json().catch(() => ({}));
  const tenant = await resolveTenant(req, body?.tenant || body?.tenantSlug);
  const name = clean(body?.name) || "SDK webhook";
  const rawUrl = clean(body?.url);
  const signingSecret = clean(body?.signingSecret || body?.signing_secret);
  const rawSignatureVersion = clean(body?.signatureVersion || body?.signature_version);
  const signatureVersion = rawSignatureVersion
    ? normalizeWebhookSignatureVersion(rawSignatureVersion)
    : null;
  const events = Array.isArray(body?.events) ? body.events.map(clean).filter(Boolean) : ["sdk.verify", "sdk.claim.created", "sdk.external_event", "sdk.pos.activated"];
  const enabled = Boolean(body?.enabled);

  if (!tenant || !rawUrl) {
    return json({ error: "tenant and url are required" }, 400);
  }
  if (rawSignatureVersion && !signatureVersion) {
    return json({ error: "invalid webhook signature version", reason: "webhook_signature_version_invalid" }, 400);
  }

  let url: string;
  try {
    url = normalizeWebhookUrl(rawUrl).toString();
  } catch (error) {
    return json({ error: "invalid webhook URL", reason: safeWebhookError(error).code }, 400);
  }

  let effectiveSigningSecret = signingSecret;
  if (enabled && !effectiveSigningSecret) {
    const existingRows = await sql/*sql*/`
      SELECT signing_secret
      FROM webhook_endpoints
      WHERE tenant_id = ${tenant.id}
        AND url = ${url}
      LIMIT 1
    `;
    try {
      effectiveSigningSecret = decryptWebhookSigningSecret(
        String(existingRows[0]?.signing_secret || ""),
        { tenantId: tenant.id },
      );
    } catch (error) {
      return secretStorageError(error);
    }
  }
  const secretIssue = enabled
    ? webhookSigningSecretIssue(effectiveSigningSecret, { required: true })
    : webhookSigningSecretIssue(signingSecret, { required: false });
  if (secretIssue) {
    return json({ error: "invalid webhook signing secret", reason: secretIssue }, 400);
  }

  let encryptedSigningSecret: string | null = null;
  if (signingSecret) {
    try {
      encryptedSigningSecret = encryptWebhookSigningSecret(signingSecret, { tenantId: tenant.id });
    } catch (error) {
      return secretStorageError(error);
    }
  }

  if (enabled) {
    try {
      await resolveWebhookDestination(url);
    } catch (error) {
      return json({ error: "invalid webhook URL", reason: safeWebhookError(error).code }, 400);
    }
  }

  const rows = await sql/*sql*/`
    INSERT INTO webhook_endpoints (tenant_id, name, url, signing_secret, signature_version, enabled, events, updated_at)
    VALUES (${tenant.id}, ${name}, ${url}, ${encryptedSigningSecret}, ${signatureVersion || "v2"}, ${enabled}, ${JSON.stringify(events)}::jsonb, now())
    ON CONFLICT (tenant_id, url)
    DO UPDATE SET name = EXCLUDED.name, enabled = EXCLUDED.enabled, events = EXCLUDED.events, signing_secret = COALESCE(EXCLUDED.signing_secret, webhook_endpoints.signing_secret), signature_version = COALESCE(${signatureVersion}, webhook_endpoints.signature_version), updated_at = now()
    RETURNING id::text AS id, name, url, enabled, events, signature_version, (signing_secret IS NOT NULL AND signing_secret <> '') AS has_signing_secret, created_at, updated_at
  `;

  return json({ ok: true, tenant: { slug: tenant.slug, name: tenant.name }, endpoint: rows[0] }, 201);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { randomBytes } from "node:crypto";

import { checkAdmin, getAdminActor, getAdminPrincipal } from "../../../../lib/auth";
import { RequestBodyTooLargeError } from "../../../../lib/bounded-request-body";
import { ensureSdkSchema } from "../../../../lib/commercial-runtime-schema";
import { adminCriticalRateLimitIdentity, enforceCriticalRateLimit } from "../../../../lib/critical-rate-limit";
import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";
import { hasSdkApiKeyLifecycleV1 } from "../../../../lib/sdk-api-key-lifecycle";
import { hashSdkApiKey, sdkKeyPrefix } from "../../../../lib/sdk-auth";
import {
  checkSdkApiKeyPermission,
  isSdkApiKeyId,
  normalizeSdkApiKeyName,
  parseSdkApiKeyExpiry,
  parseSdkApiKeyNetworkPolicy,
  parseSdkApiKeyScopes,
  readSdkApiKeyAdminBody,
  resolveSdkApiKeyActiveQuota,
  sdkApiKeyAuditRequestMeta,
  SDK_API_KEY_LIFECYCLE_REQUIRED_MIGRATION,
  SDK_API_KEY_SCOPES,
} from "./policy";

const POST_FIELDS = new Set([
  "tenant", "tenantId", "tenantSlug", "name", "scopes", "expiresAt", "expires_at",
  "allowedIpCidrs", "allowed_ip_cidrs", "allowedOrigins", "allowed_origins",
  "rateLimitProfile", "rate_limit_profile",
]);
const NO_STORE = { "cache-control": "no-store" };

function clean(value: unknown) {
  return String(value || "").trim();
}

function generateSdkKey() {
  return `nxid_live_${randomBytes(24).toString("base64url")}`;
}

function invalidBody(error: unknown) {
  const tooLarge = error instanceof RequestBodyTooLargeError;
  return json({ ok: false, reason: tooLarge ? "request_body_too_large" : "invalid_json_body" }, tooLarge ? 413 : 400, NO_STORE);
}

async function resolveTenant(req: Request, input: { tenant?: unknown; tenantId?: unknown; tenantSlug?: unknown }) {
  const principal = getAdminPrincipal(req);
  if (principal.scope === "tenant_admin" || principal.scope === "tenant_operator" || principal.scope === "reseller") {
    if (!principal.tenantId || !isSdkApiKeyId(principal.tenantId)) return null;
    const rows = await sql/*sql*/`
      SELECT id::text AS id, slug, name
      FROM tenants
      WHERE id = ${principal.tenantId}::uuid
      LIMIT 1
    `;
    return rows[0] as { id: string; slug: string; name: string } | undefined;
  }

  const tenantId = clean(input.tenantId);
  const tenantSlug = clean(input.tenantSlug || input.tenant).toLowerCase();
  if (!tenantId && !tenantSlug) return null;
  if (tenantId && !isSdkApiKeyId(tenantId)) return undefined;
  const rows = await sql/*sql*/`
    SELECT id::text AS id, slug, name
    FROM tenants
    WHERE (${tenantId || null}::uuid IS NULL OR id = ${tenantId || null}::uuid)
      AND (${tenantSlug || null}::text IS NULL OR slug = ${tenantSlug || null})
    LIMIT 1
  `;
  return rows[0] as { id: string; slug: string; name: string } | undefined;
}

function lifecycleUnavailable() {
  return json({
    ok: false,
    reason: "sdk_api_key_lifecycle_schema_required",
    requiredMigration: SDK_API_KEY_LIFECYCLE_REQUIRED_MIGRATION,
  }, 503, NO_STORE);
}

function tenantSelectorsConflict(input: { tenant?: unknown; tenantSlug?: unknown }) {
  const legacy = clean(input.tenant).toLowerCase();
  const explicit = clean(input.tenantSlug).toLowerCase();
  return Boolean(legacy && explicit && legacy !== explicit);
}

export async function GET(req: Request) {
  const auth = await checkAdmin(req, ["super_admin", "tenant_admin", "tenant_operator", "reseller"]);
  if (auth) return auth;
  const permission = checkSdkApiKeyPermission(req, "read");
  if (permission) return permission;
  await ensureSdkSchema();

  const url = new URL(req.url);
  const principal = getAdminPrincipal(req);
  if (tenantSelectorsConflict({
    tenant: url.searchParams.get("tenant"),
    tenantSlug: url.searchParams.get("tenantSlug"),
  })) return json({ ok: false, reason: "tenant_selector_conflict" }, 400, NO_STORE);
  const tenantSelectorRequested = ["tenant", "tenantId", "tenantSlug"]
    .some((key) => clean(url.searchParams.get(key)) !== "");
  const tenant = await resolveTenant(req, {
    tenant: url.searchParams.get("tenant"),
    tenantId: url.searchParams.get("tenantId"),
    tenantSlug: url.searchParams.get("tenantSlug"),
  });
  if (!tenant && (principal.scope === "tenant_admin" || principal.scope === "tenant_operator" || principal.scope === "reseller")) {
    return json({ ok: false, reason: "tenant_not_found" }, 404, NO_STORE);
  }
  if (!tenant && tenantSelectorRequested) {
    return json({ ok: false, reason: "tenant_not_found" }, 404, NO_STORE);
  }

  const rows = tenant
    ? await sql/*sql*/`
      SELECT k.id::text AS id, tn.slug AS tenant_slug, k.name, k.key_prefix, k.scopes, k.status,
        k.allowed_ip_cidrs::text[] AS allowed_ip_cidrs, k.allowed_origins, k.rate_limit_profile,
        k.last_used_at, k.expires_at, k.created_at, k.updated_at
      FROM tenant_api_keys k
      JOIN tenants tn ON tn.id = k.tenant_id
      WHERE k.tenant_id = ${tenant.id}
      ORDER BY k.created_at DESC
      LIMIT 100
    `
    : await sql/*sql*/`
      SELECT k.id::text AS id, tn.slug AS tenant_slug, k.name, k.key_prefix, k.scopes, k.status,
        k.allowed_ip_cidrs::text[] AS allowed_ip_cidrs, k.allowed_origins, k.rate_limit_profile,
        k.last_used_at, k.expires_at, k.created_at, k.updated_at
      FROM tenant_api_keys k
      JOIN tenants tn ON tn.id = k.tenant_id
      ORDER BY k.created_at DESC
      LIMIT 200
    `;

  const usageRows = tenant
    ? await sql/*sql*/`
      SELECT COUNT(*)::int AS total, COALESCE(ROUND(AVG(latency_ms))::int, 0) AS avg_latency_ms
      FROM sdk_usage_logs
      WHERE tenant_id = ${tenant.id}
        AND created_at >= date_trunc('month', now())
    `
    : await sql/*sql*/`
      SELECT COUNT(*)::int AS total, COALESCE(ROUND(AVG(latency_ms))::int, 0) AS avg_latency_ms
      FROM sdk_usage_logs
      WHERE created_at >= date_trunc('month', now())
    `;

  return json({
    ok: true,
    tenant: tenant ? { slug: tenant.slug, name: tenant.name } : null,
    usage: {
      monthRequests: Number(usageRows[0]?.total || 0),
      avgLatencyMs: Number(usageRows[0]?.avg_latency_ms || 0),
    },
    rows,
  }, 200, NO_STORE);
}

export async function POST(req: Request) {
  const auth = await checkAdmin(req, ["super_admin", "tenant_admin", "tenant_operator", "reseller"]);
  if (auth) return auth;
  const permission = checkSdkApiKeyPermission(req, "write");
  if (permission) return permission;
  const rateLimited = await enforceCriticalRateLimit(req, {
    rateClass: "public_write",
    ...adminCriticalRateLimitIdentity(req),
    tenantWide: true,
  });
  if (rateLimited) return rateLimited;
  const principal = getAdminPrincipal(req);
  if (!principal.mfaVerified) {
    return json({ ok: false, reason: "sdk_api_key_mutation_mfa_required" }, 403, NO_STORE);
  }

  let body: Record<string, unknown>;
  try {
    body = await readSdkApiKeyAdminBody(req);
  } catch (error) {
    return invalidBody(error);
  }
  const invalidFields = Object.keys(body).filter((field) => !POST_FIELDS.has(field));
  if (invalidFields.length) {
    return json({ ok: false, reason: "sdk_api_key_create_fields_invalid", invalidFields }, 400, NO_STORE);
  }
  if (tenantSelectorsConflict(body)) {
    return json({ ok: false, reason: "tenant_selector_conflict" }, 400, NO_STORE);
  }
  const activeQuota = resolveSdkApiKeyActiveQuota();
  if (activeQuota === null) {
    return json({ ok: false, reason: "sdk_api_key_quota_configuration_invalid" }, 503, NO_STORE);
  }
  const scopeResult = parseSdkApiKeyScopes(body.scopes);
  if (!scopeResult.ok) {
    return json({
      ok: false,
      reason: scopeResult.reason,
      invalidScopes: scopeResult.invalidScopes,
      allowedScopes: SDK_API_KEY_SCOPES,
    }, 400, NO_STORE);
  }
  const name = normalizeSdkApiKeyName(body.name === undefined ? "SDK production key" : body.name);
  if (!name) return json({ ok: false, reason: "sdk_api_key_name_invalid" }, 400, NO_STORE);
  if (Object.prototype.hasOwnProperty.call(body, "expiresAt")
    && Object.prototype.hasOwnProperty.call(body, "expires_at")
    && String(body.expiresAt || "") !== String(body.expires_at || "")) {
    return json({ ok: false, reason: "sdk_api_key_expiry_invalid" }, 400, NO_STORE);
  }
  const expiry = parseSdkApiKeyExpiry(body.expiresAt ?? body.expires_at);
  if (!expiry.ok) return json({ ok: false, reason: expiry.reason }, 400, NO_STORE);
  const networkPolicy = parseSdkApiKeyNetworkPolicy({
    allowedIpCidrs: body.allowedIpCidrs ?? body.allowed_ip_cidrs,
    allowedOrigins: body.allowedOrigins ?? body.allowed_origins,
    rateLimitProfile: body.rateLimitProfile ?? body.rate_limit_profile,
  });
  if (!networkPolicy.ok) return json({ ok: false, reason: networkPolicy.reason }, 400, NO_STORE);
  await ensureSdkSchema();
  let lifecycleReady = false;
  try {
    lifecycleReady = await hasSdkApiKeyLifecycleV1();
  } catch {
    return lifecycleUnavailable();
  }
  if (!lifecycleReady) return lifecycleUnavailable();
  const tenant = await resolveTenant(req, body);
  if (!tenant) return json({ ok: false, reason: "tenant_required_or_not_found" }, 400, NO_STORE);

  const rawKey = generateSdkKey();
  const scopes = scopeResult.scopes;
  const actor = getAdminActor(req);
  const meta = sdkApiKeyAuditRequestMeta(req);
  let rows: Array<Record<string, unknown>>;
  try {
    rows = await sql/*sql*/`
      SELECT *
      FROM public.nexid_create_tenant_api_key_v2(${JSON.stringify({
        tenant_id: tenant.id,
        actor_id: actor.id,
        name,
        key_prefix: sdkKeyPrefix(rawKey),
        key_hash: hashSdkApiKey(rawKey),
        scopes,
        expires_at: expiry.expiresAt,
        max_active_keys: activeQuota,
        request_id: meta.requestId,
        ip_address: meta.ipAddress,
        user_agent: meta.userAgent,
        allowed_ip_cidrs: networkPolicy.allowedIpCidrs,
        allowed_origins: networkPolicy.allowedOrigins,
        rate_limit_profile: networkPolicy.rateLimitProfile,
      })}::jsonb)
    `;
  } catch {
    return json({ ok: false, reason: "sdk_api_key_creation_unavailable" }, 503, {
      "cache-control": "no-store",
      "retry-after": "1",
    });
  }
  if (rows[0]?.outcome === "quota_exceeded") {
    return json({
      ok: false,
      reason: "sdk_api_key_quota_exceeded",
      activeKeys: Number(rows[0]?.active_count || 0),
      maxActiveKeys: activeQuota,
    }, 409, NO_STORE);
  }
  if (!rows[0]?.id || rows[0]?.outcome !== "created") return lifecycleUnavailable();

  const { active_count: _activeCount, receipt_id: _receiptId, outcome: _outcome, ...key } = rows[0];

  return json({
    ok: true,
    tenant: { slug: tenant.slug, name: tenant.name },
    key,
    secret: rawKey,
    warning: "Store this secret now. nexID will not show it again.",
  }, 201, NO_STORE);
}

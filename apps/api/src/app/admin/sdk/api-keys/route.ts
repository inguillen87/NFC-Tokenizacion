export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { randomBytes } from "node:crypto";

import { checkAdmin, getAdminTenantScope } from "../../../../lib/auth";
import { ensureSdkSchema } from "../../../../lib/commercial-runtime-schema";
import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";
import { hashSdkApiKey, sdkKeyPrefix } from "../../../../lib/sdk-auth";

const DEFAULT_SCOPES = ["sdk:verify", "sdk:claim", "sdk:products", "sdk:events", "sdk:pos"];

function clean(value: unknown) {
  return String(value || "").trim();
}

function forcedTenantSlug(req: Request) {
  return getAdminTenantScope(req).forcedTenantSlug;
}

function parseScopes(value: unknown) {
  if (!value) return DEFAULT_SCOPES;
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);
  return String(value).split(",").map(clean).filter(Boolean);
}

function generateSdkKey() {
  return `nxid_live_${randomBytes(24).toString("base64url")}`;
}

async function resolveTenantId(input: { tenant?: string | null; tenantScope?: string | null }) {
  const tenantSlug = clean(input.tenantScope || input.tenant).toLowerCase();
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
  const auth = checkAdmin(req);
  if (auth) return auth;
  await ensureSdkSchema();

  const url = new URL(req.url);
  const tenantScope = forcedTenantSlug(req);
  const tenant = await resolveTenantId({ tenant: url.searchParams.get("tenant"), tenantScope });
  if (!tenant && tenantScope) return json({ ok: false, reason: "tenant_not_found" }, 404);

  const rows = tenant
    ? await sql/*sql*/`
      SELECT k.id::text AS id, tn.slug AS tenant_slug, k.name, k.key_prefix, k.scopes, k.status, k.last_used_at, k.expires_at, k.created_at, k.updated_at
      FROM tenant_api_keys k
      JOIN tenants tn ON tn.id = k.tenant_id
      WHERE k.tenant_id = ${tenant.id}
      ORDER BY k.created_at DESC
      LIMIT 100
    `
    : await sql/*sql*/`
      SELECT k.id::text AS id, tn.slug AS tenant_slug, k.name, k.key_prefix, k.scopes, k.status, k.last_used_at, k.expires_at, k.created_at, k.updated_at
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
  });
}

export async function POST(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;
  await ensureSdkSchema();

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const tenantScope = forcedTenantSlug(req);
  const tenant = await resolveTenantId({ tenant: clean(body.tenant || body.tenantSlug), tenantScope });
  if (!tenant) return json({ ok: false, reason: "tenant_required_or_not_found" }, 400);

  const rawKey = generateSdkKey();
  const scopes = parseScopes(body.scopes);
  const name = clean(body.name) || "SDK production key";
  const expiresAt = clean(body.expiresAt || body.expires_at) || null;
  const rows = await sql/*sql*/`
    INSERT INTO tenant_api_keys (tenant_id, name, key_prefix, key_hash, scopes, status, expires_at, metadata_json)
    VALUES (
      ${tenant.id},
      ${name},
      ${sdkKeyPrefix(rawKey)},
      ${hashSdkApiKey(rawKey)},
      ${JSON.stringify(scopes)}::jsonb,
      'active',
      ${expiresAt},
      ${JSON.stringify({ created_from: "admin_sdk_api_keys" })}::jsonb
    )
    RETURNING id::text AS id, name, key_prefix, scopes, status, expires_at, created_at
  `;

  return json({
    ok: true,
    tenant: { slug: tenant.slug, name: tenant.name },
    key: rows[0],
    secret: rawKey,
    warning: "Store this secret now. nexID will not show it again.",
  }, 201);
}

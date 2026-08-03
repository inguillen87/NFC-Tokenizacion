import { createHash, randomUUID } from "node:crypto";

import { ensureSdkSchema } from "./commercial-runtime-schema";
import { sql } from "./db";
import { json } from "./http";
import { getRequestMeta } from "./request-meta";

export type SdkScope =
  | "sdk:verify"
  | "sdk:claim"
  | "sdk:products"
  | "sdk:events"
  | "sdk:pos"
  | "sdk:logistics"
  | "sdk:epcis:read"
  | "sdk:epcis:write";

export type SdkAuthContext = {
  apiKeyId: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  scopes: string[];
  traceId: string;
  rateLimitProfile: "conservative" | "standard" | "high_throughput";
};

type SdkAuthFailure = {
  ok: false;
  response: Response;
};

type SdkAuthSuccess = {
  ok: true;
  context: SdkAuthContext;
};

export function hashSdkApiKey(rawKey: string) {
  return createHash("sha256").update(rawKey.trim(), "utf8").digest("hex");
}

export function sdkKeyPrefix(rawKey: string) {
  return rawKey.trim().replace(/\s+/g, "").slice(0, 12) || "empty";
}

function parseScopes(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parseScopes(parsed);
    } catch {
      return value.split(",").map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function hasScope(scopes: string[], required: SdkScope) {
  return scopes.includes(required) || scopes.includes("sdk:*") || scopes.includes("*");
}

export function normalizeSdkRequestOrigin(value: string | null) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password
      || parsed.pathname !== "/" || parsed.search || parsed.hash) return null;
    return parsed.origin.toLowerCase();
  } catch {
    return null;
  }
}

export async function authenticateSdkRequest(req: Request, requiredScope: SdkScope): Promise<SdkAuthSuccess | SdkAuthFailure> {
  const traceId = req.headers.get("x-nexid-trace-id") || `sdk_${randomUUID()}`;
  const rawKey = req.headers.get("x-nexid-api-key") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const tenantSlug = (req.headers.get("x-nexid-tenant-slug") || "").trim();
  const clientIp = getRequestMeta(req).ip;
  const requestOrigin = normalizeSdkRequestOrigin(req.headers.get("origin"));

  if (!rawKey.trim()) {
    return {
      ok: false,
      response: json({ ok: false, reason: "sdk_api_key_required", trace_id: traceId }, 401),
    };
  }

  await ensureSdkSchema();
  const keyHash = hashSdkApiKey(rawKey);
  const rows = await sql/*sql*/`
    SELECT
      k.id::text AS api_key_id,
      k.scopes,
      tn.id::text AS tenant_id,
      tn.slug AS tenant_slug,
      tn.name AS tenant_name,
      k.rate_limit_profile
    FROM tenant_api_keys k
    JOIN tenants tn ON tn.id = k.tenant_id
    WHERE k.key_hash = ${keyHash}
      AND k.status = 'active'
      AND (k.expires_at IS NULL OR k.expires_at > now())
      AND (${tenantSlug} = '' OR tn.slug = ${tenantSlug})
      AND (
        cardinality(k.allowed_ip_cidrs) = 0
        OR (${clientIp}::inet IS NOT NULL AND ${clientIp}::inet <<= ANY(k.allowed_ip_cidrs))
      )
      AND (
        cardinality(k.allowed_origins) = 0
        OR (${requestOrigin}::text IS NOT NULL AND ${requestOrigin} = ANY(k.allowed_origins))
      )
    LIMIT 1
  `;
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    return {
      ok: false,
      response: json({ ok: false, reason: "sdk_api_key_invalid", trace_id: traceId }, 401),
    };
  }

  const scopes = parseScopes(row.scopes);
  if (!hasScope(scopes, requiredScope)) {
    return {
      ok: false,
      response: json({ ok: false, reason: "sdk_scope_denied", required_scope: requiredScope, trace_id: traceId }, 403),
    };
  }

  await sql/*sql*/`
    UPDATE tenant_api_keys
    SET last_used_at = now()
    WHERE id = ${row.api_key_id}
  `;

  return {
    ok: true,
    context: {
      apiKeyId: String(row.api_key_id),
      tenantId: String(row.tenant_id),
      tenantSlug: String(row.tenant_slug),
      tenantName: String(row.tenant_name || row.tenant_slug),
      scopes,
      traceId,
      rateLimitProfile: String(row.rate_limit_profile || "standard") as SdkAuthContext["rateLimitProfile"],
    },
  };
}

export async function logSdkUsage(input: {
  req: Request;
  context?: SdkAuthContext | null;
  endpoint: string;
  statusCode: number;
  startedAt: number;
  reason?: string | null;
  meta?: Record<string, unknown>;
}) {
  try {
    await ensureSdkSchema();
    const ipAddress = getRequestMeta(input.req).ip;
    const ipCountry = input.req.headers.get("x-vercel-ip-country") || null;
    const latencyMs = Math.max(0, Math.round(Date.now() - input.startedAt));
    await sql/*sql*/`
      INSERT INTO sdk_usage_logs (
        tenant_id, api_key_id, endpoint, status_code, latency_ms, ip_address, ip_country, reason, trace_id, meta
      ) VALUES (
        ${input.context?.tenantId || null},
        ${input.context?.apiKeyId || null},
        ${input.endpoint},
        ${input.statusCode},
        ${latencyMs},
        ${ipAddress},
        ${ipCountry},
        ${input.reason || null},
        ${input.context?.traceId || input.req.headers.get("x-nexid-trace-id") || null},
        ${JSON.stringify(input.meta || {})}::jsonb
      )
    `;
  } catch (error) {
    console.warn("[sdk_usage_log_failed]", error instanceof Error ? error.message : "unknown_error");
  }
}

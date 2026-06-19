import { createHash, randomUUID } from "node:crypto";

import { ensureSdkSchema } from "./commercial-runtime-schema";
import { sql } from "./db";
import { json } from "./http";

export type SdkScope = "sdk:verify" | "sdk:claim" | "sdk:products";

export type SdkAuthContext = {
  apiKeyId: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  scopes: string[];
  traceId: string;
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

export async function authenticateSdkRequest(req: Request, requiredScope: SdkScope): Promise<SdkAuthSuccess | SdkAuthFailure> {
  const traceId = req.headers.get("x-nexid-trace-id") || `sdk_${randomUUID()}`;
  const rawKey = req.headers.get("x-nexid-api-key") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const tenantSlug = (req.headers.get("x-nexid-tenant-slug") || "").trim();

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
      tn.name AS tenant_name
    FROM tenant_api_keys k
    JOIN tenants tn ON tn.id = k.tenant_id
    WHERE k.key_hash = ${keyHash}
      AND k.status = 'active'
      AND (k.expires_at IS NULL OR k.expires_at > now())
      AND (${tenantSlug} = '' OR tn.slug = ${tenantSlug})
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
    SET last_used_at = now(), updated_at = now()
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
    },
  };
}


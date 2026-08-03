export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminActor, getAdminPrincipal } from "../../../../../lib/auth";
import { RequestBodyTooLargeError } from "../../../../../lib/bounded-request-body";
import { ensureSdkSchema } from "../../../../../lib/commercial-runtime-schema";
import { adminCriticalRateLimitIdentity, enforceCriticalRateLimit } from "../../../../../lib/critical-rate-limit";
import { sql } from "../../../../../lib/db";
import { json } from "../../../../../lib/http";
import { hasSdkApiKeyLifecycleV1 } from "../../../../../lib/sdk-api-key-lifecycle";
import {
  checkSdkApiKeyPermission,
  isSdkApiKeyId,
  normalizeSdkApiKeyName,
  parseSdkApiKeyScopes,
  parseSdkApiKeyStatusPatch,
  readSdkApiKeyAdminBody,
  sdkApiKeyAuditRequestMeta,
  SDK_API_KEY_LIFECYCLE_REQUIRED_MIGRATION,
  SDK_API_KEY_SCOPES,
} from "../policy";

const PATCH_FIELDS = new Set(["name", "scopes", "status"]);
const NO_STORE = { "cache-control": "no-store" };

function invalidBody(error: unknown) {
  const tooLarge = error instanceof RequestBodyTooLargeError;
  return json({ ok: false, reason: tooLarge ? "request_body_too_large" : "invalid_json_body" }, tooLarge ? 413 : 400, NO_STORE);
}

async function tenantScopeFilter(req: Request) {
  const principal = getAdminPrincipal(req);
  if (principal.scope !== "tenant_admin" && principal.scope !== "tenant_operator" && principal.scope !== "reseller") return null;
  return principal.tenantId || "__missing__";
}

function lifecycleUnavailable() {
  return json({
    ok: false,
    reason: "sdk_api_key_lifecycle_schema_required",
    requiredMigration: SDK_API_KEY_LIFECYCLE_REQUIRED_MIGRATION,
  }, 503, NO_STORE);
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
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
  if (!getAdminPrincipal(req).mfaVerified) {
    return json({ ok: false, reason: "sdk_api_key_mutation_mfa_required" }, 403, NO_STORE);
  }

  const { id } = await context.params;
  if (!isSdkApiKeyId(id)) return json({ ok: false, reason: "api_key_not_found" }, 404, NO_STORE);
  let body: Record<string, unknown>;
  try {
    body = await readSdkApiKeyAdminBody(req);
  } catch (error) {
    return invalidBody(error);
  }
  const invalidFields = Object.keys(body).filter((field) => !PATCH_FIELDS.has(field));
  if (invalidFields.length) {
    return json({ ok: false, reason: "sdk_api_key_update_fields_invalid", invalidFields }, 400, NO_STORE);
  }
  const nameProvided = Object.prototype.hasOwnProperty.call(body, "name");
  const scopesProvided = Object.prototype.hasOwnProperty.call(body, "scopes");
  const statusProvided = Object.prototype.hasOwnProperty.call(body, "status");
  if (!nameProvided && !scopesProvided && !statusProvided) {
    return json({ ok: false, reason: "sdk_api_key_update_required" }, 400, NO_STORE);
  }
  const statusResult = parseSdkApiKeyStatusPatch({ provided: statusProvided, value: body.status });
  if (!statusResult.ok) return json({ ok: false, reason: statusResult.reason }, 409, NO_STORE);
  const name = nameProvided ? normalizeSdkApiKeyName(body.name) : null;
  if (nameProvided && !name) return json({ ok: false, reason: "sdk_api_key_name_invalid" }, 400, NO_STORE);
  let scopes: string[] | null = null;
  if (scopesProvided) {
    const scopeResult = parseSdkApiKeyScopes(body.scopes);
    if (!scopeResult.ok) {
      return json({
        ok: false,
        reason: scopeResult.reason,
        invalidScopes: scopeResult.invalidScopes,
        allowedScopes: SDK_API_KEY_SCOPES,
      }, 400, NO_STORE);
    }
    scopes = scopeResult.scopes;
  }

  await ensureSdkSchema();
  try {
    if (!await hasSdkApiKeyLifecycleV1()) return lifecycleUnavailable();
  } catch {
    return lifecycleUnavailable();
  }
  const tenantId = await tenantScopeFilter(req);
  if (tenantId === "__missing__") return json({ ok: false, reason: "tenant_not_found" }, 404, NO_STORE);

  const actor = getAdminActor(req);
  const meta = sdkApiKeyAuditRequestMeta(req);
  let rows: Array<Record<string, unknown>>;
  try {
    rows = await sql/*sql*/`
      SELECT *
      FROM public.nexid_mutate_tenant_api_key_v1(${JSON.stringify({
        operation: "update",
        tenant_id: tenantId,
        api_key_id: id,
        actor_id: actor.id,
        name_provided: nameProvided,
        name,
        scopes_provided: scopesProvided,
        scopes,
        revoke_requested: statusResult.revokeRequested,
        request_id: meta.requestId,
        ip_address: meta.ipAddress,
        user_agent: meta.userAgent,
      })}::jsonb)
    `;
  } catch {
    return json({ ok: false, reason: "sdk_api_key_update_unavailable" }, 503, NO_STORE);
  }
  if (!rows[0]) return json({ ok: false, reason: "api_key_not_found" }, 404, NO_STORE);
  const { outcome: _outcome, receipt_id: _receiptId, changed: _changed, already_revoked: _alreadyRevoked, ...key } = rows[0];
  return json({ ok: true, key }, 200, NO_STORE);
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
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
  if (!getAdminPrincipal(req).mfaVerified) {
    return json({ ok: false, reason: "sdk_api_key_mutation_mfa_required" }, 403, NO_STORE);
  }
  await ensureSdkSchema();

  const { id } = await context.params;
  if (!isSdkApiKeyId(id)) return json({ ok: false, reason: "api_key_not_found" }, 404, NO_STORE);
  try {
    if (!await hasSdkApiKeyLifecycleV1()) return lifecycleUnavailable();
  } catch {
    return lifecycleUnavailable();
  }
  const tenantId = await tenantScopeFilter(req);
  if (tenantId === "__missing__") return json({ ok: false, reason: "tenant_not_found" }, 404, NO_STORE);
  const actor = getAdminActor(req);
  const meta = sdkApiKeyAuditRequestMeta(req);
  let rows: Array<Record<string, unknown>>;
  try {
    rows = await sql/*sql*/`
      SELECT *
      FROM public.nexid_mutate_tenant_api_key_v1(${JSON.stringify({
        operation: "revoke",
        tenant_id: tenantId,
        api_key_id: id,
        actor_id: actor.id,
        name_provided: false,
        scopes_provided: false,
        revoke_requested: true,
        request_id: meta.requestId,
        ip_address: meta.ipAddress,
        user_agent: meta.userAgent,
      })}::jsonb)
    `;
  } catch {
    return json({ ok: false, reason: "sdk_api_key_revocation_unavailable" }, 503, NO_STORE);
  }
  if (!rows[0]) return json({ ok: false, reason: "api_key_not_found" }, 404, NO_STORE);
  return json({ ok: true, revoked: String(rows[0].id), already_revoked: Boolean(rows[0].already_revoked) }, 200, NO_STORE);
}

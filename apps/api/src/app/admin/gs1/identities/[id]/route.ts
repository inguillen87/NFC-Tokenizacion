export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminPrincipal } from "../../../../../lib/auth";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../../lib/bounded-request-body";
import { adminCriticalRateLimitIdentity, enforceCriticalRateLimit } from "../../../../../lib/critical-rate-limit";
import { Gs1RegistryError, updateGs1IdentityStatus } from "../../../../../lib/gs1-digital-link-registry";
import { json } from "../../../../../lib/http";
import { checkGs1RegistryPermission } from "../policy";

const MAX_BODY_BYTES = 16 * 1024;

function tenantScope(req: Request, requested: unknown) {
  const principal = getAdminPrincipal(req);
  const candidate = String(requested ?? "").trim().toLowerCase();
  if (principal.tenantSlug && candidate && candidate !== principal.tenantSlug) {
    throw new Gs1RegistryError("gs1_tenant_scope_mismatch", 403);
  }
  const tenantSlug = principal.tenantSlug || candidate;
  if (!tenantSlug) throw new Gs1RegistryError("gs1_tenant_required", 400);
  return tenantSlug;
}

function errorResponse(error: unknown) {
  if (error instanceof Gs1RegistryError) {
    return json({
      ok: false,
      reason: error.code,
      ...(error.status < 500 && error.detail ? { detail: error.detail } : {}),
    }, error.status, { "cache-control": "no-store" });
  }
  return json({ ok: false, reason: "gs1_registry_unavailable" }, 503, {
    "cache-control": "no-store",
  });
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await checkAdmin(req);
  if (auth) return auth;
  const permission = checkGs1RegistryPermission(req, "write");
  if (permission) return permission;
  const limited = await enforceCriticalRateLimit(req, {
    rateClass: "proof_write",
    ...adminCriticalRateLimitIdentity(req),
  });
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonBody(req, MAX_BODY_BYTES);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, reason: tooLarge ? "request_body_too_large" : "invalid_json" }, tooLarge ? 413 : 400);
  }

  try {
    const principal = getAdminPrincipal(req);
    const params = await context.params;
    const tenantSlug = tenantScope(req, body.tenantSlug ?? body.tenant);
    const result = await updateGs1IdentityStatus({
      tenantSlug,
      identityId: params.id,
      expectedStatus: body.expectedStatus ?? body.expected_status,
      status: body.status,
      actorUserId: principal.userId,
      reason: body.reason,
    });
    return json({
      ok: true,
      identity: result.identity,
      previousStatus: result.previousStatus,
      replayed: result.replayed,
      lifecycle: {
        retiredIsTerminal: true,
        cryptographicNfcAuthenticationChanged: false,
      },
    }, 200, { "cache-control": "no-store" });
  } catch (error) {
    return errorResponse(error);
  }
}

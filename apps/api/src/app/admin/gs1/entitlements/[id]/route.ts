export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminPrincipal } from "../../../../../lib/auth";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../../lib/bounded-request-body";
import { adminCriticalRateLimitIdentity, enforceCriticalRateLimit } from "../../../../../lib/critical-rate-limit";
import {
  Gs1RegistryError,
  revokeGs1GtinPrefixEntitlement,
} from "../../../../../lib/gs1-digital-link-registry";
import { json } from "../../../../../lib/http";

const MAX_BODY_BYTES = 16 * 1024;

function errorResponse(error: unknown) {
  if (error instanceof Gs1RegistryError) {
    return json({
      ok: false,
      reason: error.code,
      ...(error.status < 500 && error.detail ? { detail: error.detail } : {}),
    }, error.status, { "cache-control": "no-store" });
  }
  return json({ ok: false, reason: "gs1_gtin_prefix_entitlement_unavailable" }, 503, {
    "cache-control": "no-store",
  });
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await checkAdmin(req, ["super_admin"]);
  if (auth) return auth;
  const principal = getAdminPrincipal(req);
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
    const params = await context.params;
    const result = await revokeGs1GtinPrefixEntitlement({
      entitlementId: params.id,
      expectedStatus: body.expectedStatus ?? body.expected_status,
      actorUserId: principal.userId,
      reason: body.reason,
    });
    return json({
      ok: true,
      entitlement: result.entitlement,
      replayed: result.replayed,
      authority: "platform_superadmin",
      activeIdentitiesResolveAfterRevocation: false,
      reactivationSupported: false,
    }, 200, { "cache-control": "no-store" });
  } catch (error) {
    return errorResponse(error);
  }
}

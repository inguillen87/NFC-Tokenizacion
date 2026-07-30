export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminPrincipal } from "../../../../lib/auth";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../lib/bounded-request-body";
import { adminCriticalRateLimitIdentity, enforceCriticalRateLimit } from "../../../../lib/critical-rate-limit";
import {
  grantGs1GtinPrefixEntitlement,
  Gs1RegistryError,
  listGs1GtinPrefixEntitlements,
} from "../../../../lib/gs1-digital-link-registry";
import { json } from "../../../../lib/http";

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

export async function GET(req: Request) {
  const auth = await checkAdmin(req, ["super_admin"]);
  if (auth) return auth;
  const limited = await enforceCriticalRateLimit(req, {
    rateClass: "public",
    ...adminCriticalRateLimitIdentity(req),
  });
  if (limited) return limited;

  try {
    const search = new URL(req.url).searchParams;
    const rawLimit = search.get("limit") || "100";
    if (!/^\d{1,3}$/.test(rawLimit) || Number(rawLimit) < 1 || Number(rawLimit) > 200) {
      throw new Gs1RegistryError("gs1_limit_invalid", 400);
    }
    const page = await listGs1GtinPrefixEntitlements({
      tenantSlug: search.get("tenant") || search.get("tenantSlug") || "",
      status: search.get("status") || "",
      limit: Number(rawLimit),
      cursor: search.get("cursor") || "",
    });
    return json({
      ok: true,
      count: page.entitlements.length,
      entitlements: page.entitlements,
      nextCursor: page.nextCursor,
      authority: "platform_superadmin",
    }, 200, {
      "cache-control": "no-store",
      ...(page.nextCursor ? { "x-nexid-next-cursor": page.nextCursor } : {}),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: Request) {
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
    const result = await grantGs1GtinPrefixEntitlement({
      tenantSlug: body.tenantSlug ?? body.tenant,
      canonicalGtinPrefix: body.canonicalGtinPrefix ?? body.canonical_gtin_prefix,
      verificationMethod: body.verificationMethod ?? body.verification_method,
      evidenceReference: body.evidenceReference ?? body.evidence_reference,
      actorUserId: principal.userId,
      reason: body.reason,
    });
    return json({
      ok: true,
      entitlement: result.entitlement,
      replayed: result.replayed,
      authority: "platform_superadmin",
      tenantSelfAssertionAccepted: false,
    }, result.replayed ? 200 : 201, { "cache-control": "no-store" });
  } catch (error) {
    return errorResponse(error);
  }
}

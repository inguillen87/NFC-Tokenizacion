export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminPrincipal } from "../../../../lib/auth";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../lib/bounded-request-body";
import { adminCriticalRateLimitIdentity, enforceCriticalRateLimit } from "../../../../lib/critical-rate-limit";
import {
  Gs1RegistryError,
  listGs1Identities,
  registerGs1Identity,
} from "../../../../lib/gs1-digital-link-registry";
import { json } from "../../../../lib/http";
import { checkGs1RegistryPermission } from "./policy";

const MAX_BODY_BYTES = 32 * 1024;

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
    return json({ ok: false, reason: error.code, ...(error.status < 500 && error.detail ? { detail: error.detail } : {}) }, error.status, {
      "cache-control": "no-store",
    });
  }
  return json({ ok: false, reason: "gs1_registry_unavailable" }, 503, { "cache-control": "no-store" });
}

export async function GET(req: Request) {
  const auth = await checkAdmin(req);
  if (auth) return auth;
  const permission = checkGs1RegistryPermission(req, "read");
  if (permission) return permission;
  const limited = await enforceCriticalRateLimit(req, {
    rateClass: "public",
    ...adminCriticalRateLimitIdentity(req),
  });
  if (limited) return limited;
  try {
    const search = new URL(req.url).searchParams;
    const tenantSlug = tenantScope(req, search.get("tenant") || search.get("tenantSlug"));
    const rawLimit = search.get("limit") || "100";
    if (!/^\d{1,3}$/.test(rawLimit) || Number(rawLimit) < 1 || Number(rawLimit) > 200) {
      throw new Gs1RegistryError("gs1_limit_invalid", 400);
    }
    const page = await listGs1Identities({
      tenantSlug,
      limit: Number(rawLimit),
      gtin: search.get("gtin") || "",
      cursor: search.get("cursor") || "",
    });
    return json({
      ok: true,
      tenantSlug,
      count: page.identities.length,
      identities: page.identities,
      nextCursor: page.nextCursor,
    }, 200, {
      "cache-control": "no-store",
      ...(page.nextCursor ? { "x-nexid-next-cursor": page.nextCursor } : {}),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: Request) {
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
    const tenantSlug = tenantScope(req, body.tenantSlug ?? body.tenant);
    const result = await registerGs1Identity({
      tenantSlug,
      bid: body.bid,
      uidHex: body.uidHex ?? body.uid_hex,
      gtin: body.gtin,
      lot: body.lot,
      serial: body.serial,
      displayName: body.displayName ?? body.display_name,
      metadata: body.metadata,
      actorUserId: principal.userId,
      reason: body.reason,
    });
    return json({
      ok: true,
      identity: result.identity,
      replayed: result.replayed,
      resolverPath: `/01/${result.identity.gtin}${result.identity.lot ? `/10/${encodeURIComponent(result.identity.lot)}` : ""}${result.identity.serial ? `/21/${encodeURIComponent(result.identity.serial)}` : ""}`,
      assurance: {
        identityRegistered: true,
        cryptographicNfcAuthentication: false,
      },
    }, result.replayed ? 200 : 201, { "cache-control": "no-store" });
  } catch (error) {
    return errorResponse(error);
  }
}

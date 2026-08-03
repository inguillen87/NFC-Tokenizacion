export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { enforceCriticalRateLimit } from "../../../../lib/critical-rate-limit";
import {
  Gs1RegistryError,
  normalizeGs1Identity,
  resolveActiveGs1Identity,
} from "../../../../lib/gs1-digital-link-registry";
import { json } from "../../../../lib/http";
import {
  createOfflinePublicCertificate,
  OFFLINE_PUBLIC_CERTIFICATE_PROFILE,
  OfflinePublicCertificateError,
} from "../../../../lib/offline-public-certificate";

const PUBLIC_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "Accept",
  "cache-control": "no-store, max-age=0, must-revalidate",
  "cross-origin-resource-policy": "cross-origin",
  "x-content-type-options": "nosniff",
  "x-nexid-offline-certificate-profile": OFFLINE_PUBLIC_CERTIFICATE_PROFILE,
};

function failure(reason: string, status: number, extraHeaders: Record<string, string> = {}) {
  return json({ ok: false, reason }, status, { ...PUBLIC_HEADERS, ...extraHeaders });
}

export async function GET(req: Request) {
  if (req.url.length > 2_048) return failure("offline_certificate_request_too_large", 414);
  const limited = await enforceCriticalRateLimit(req, {
    rateClass: "public",
    tenantId: "platform",
    subjectId: "offline-public-certificate",
  });
  if (limited) {
    for (const [name, value] of Object.entries(PUBLIC_HEADERS)) limited.headers.set(name, value);
    return limited;
  }

  try {
    const search = new URL(req.url).searchParams;
    const requested = normalizeGs1Identity({
      gtin: search.get("gtin"),
      lot: search.get("lot"),
      serial: search.get("serial"),
    });
    const identity = await resolveActiveGs1Identity(requested);
    if (!identity) return failure("gs1_identity_not_found", 404);

    const certificate = await createOfflinePublicCertificate({
      tenantSlug: identity.tenantSlug,
      bid: identity.bid,
      gtin: identity.gtin,
      lot: identity.lot,
      serial: identity.serial,
      displayName: identity.displayName,
      metadata: identity.metadata,
    });

    return json({
      ok: true,
      certificate,
      presentation: {
        label: "Información pública verificada",
        scope: "PUBLIC_PRODUCT_INFORMATION",
        nfcSunFreshness: "NOT_EVALUATED",
      },
    }, 200, PUBLIC_HEADERS);
  } catch (error) {
    if (error instanceof Gs1RegistryError) {
      return failure(error.code, error.status);
    }
    if (error instanceof OfflinePublicCertificateError) {
      return failure(error.code, error.status, error.status === 503 ? { "retry-after": "30" } : {});
    }
    return failure("offline_public_certificate_unavailable", 503, { "retry-after": "5" });
  }
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { ...PUBLIC_HEADERS, "cache-control": "public, max-age=86400" },
  });
}

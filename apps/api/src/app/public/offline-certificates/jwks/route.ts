export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../lib/http";
import {
  OFFLINE_PUBLIC_CERTIFICATE_PROFILE,
  OfflinePublicCertificateError,
  readOfflinePublicCertificateJwks,
} from "../../../../lib/offline-public-certificate";

const PUBLIC_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, HEAD, OPTIONS",
  "access-control-allow-headers": "Accept",
  "cross-origin-resource-policy": "cross-origin",
  "x-content-type-options": "nosniff",
  "x-nexid-offline-certificate-profile": OFFLINE_PUBLIC_CERTIFICATE_PROFILE,
};

function unavailable() {
  return json(
    { ok: false, reason: "offline_public_certificate_signer_unavailable" },
    503,
    { ...PUBLIC_HEADERS, "cache-control": "no-store", "retry-after": "30" },
  );
}

export async function GET() {
  try {
    return json(readOfflinePublicCertificateJwks(), 200, {
      ...PUBLIC_HEADERS,
      "cache-control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    });
  } catch (error) {
    if (error instanceof OfflinePublicCertificateError) return unavailable();
    return unavailable();
  }
}

export async function HEAD() {
  const response = await GET();
  return new Response(null, { status: response.status, headers: response.headers });
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { ...PUBLIC_HEADERS, "cache-control": "public, max-age=86400" },
  });
}

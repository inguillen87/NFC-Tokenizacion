export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../lib/http";
import { readPublicPolygonOwnershipCertificate } from "../../../../lib/public-polygon-ownership";

export async function GET() {
  const certificate = await readPublicPolygonOwnershipCertificate();
  return json(
    certificate,
    certificate.ok ? 200 : 503,
    { "cache-control": "public, max-age=15, s-maxage=30, stale-while-revalidate=120" },
  );
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../../lib/http";
import { buildPublicPolygonMetadata, PUBLIC_POLYGON_OWNERSHIP_SLUG } from "../../../../../lib/public-polygon-ownership";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug !== PUBLIC_POLYGON_OWNERSHIP_SLUG) {
    return json({ ok: false, reason: "polygon_metadata_not_found" }, 404);
  }

  return json(
    buildPublicPolygonMetadata(),
    200,
    { "cache-control": "public, max-age=300, s-maxage=300, stale-while-revalidate=86400" },
  );
}

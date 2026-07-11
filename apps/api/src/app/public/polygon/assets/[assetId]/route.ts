export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../../lib/http";
import { buildPublicPolygonAssetMetadata } from "../../../../../lib/public-polygon-ownership";

export async function GET(_request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId: rawAssetId } = await params;
  const assetId = String(rawAssetId || "").trim().toLowerCase();
  if (!/^nx-[a-f0-9]{24}$/.test(assetId)) {
    return json({ ok: false, reason: "invalid_public_polygon_asset_id" }, 400);
  }

  return json(
    buildPublicPolygonAssetMetadata(assetId),
    200,
    { "cache-control": "public, max-age=300, s-maxage=300, stale-while-revalidate=86400" },
  );
}

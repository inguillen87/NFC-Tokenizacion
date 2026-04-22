export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../../../lib/http";
import { claimTapPoints } from "../../../../../../lib/loyalty-service";

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const locale = new URL(req.url).searchParams.get("locale") || "es-AR";
  const result = await claimTapPoints({ eventId, locale });
  if (!result.ok) return json(result, result.status);
  return json(result);
}

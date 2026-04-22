export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../../../../../lib/http";
import { redeemReward } from "../../../../../../../../lib/loyalty-service";

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string; rewardId: string }> }) {
  const { eventId, rewardId } = await params;
  const body = await req.json().catch(() => ({}));
  if (!body.memberId) return json({ ok: false, error: "member_required" }, 400);
  const redemption = await redeemReward({
    eventId,
    rewardId,
    memberId: String(body.memberId),
    locale: body.locale || "es-AR",
  });
  return json(redemption, redemption.status);
}

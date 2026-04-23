export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../../../lib/http";
import { requestLoyaltyMemberDataDeletion } from "../../../../../../lib/loyalty-service";

export async function DELETE(req: Request, { params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const body = await req.json().catch(() => ({}));

  const result = await requestLoyaltyMemberDataDeletion({
    memberId,
    tenantId: body?.tenantId || null,
    reason: body?.reason || "consumer_request",
  });

  if (!result) return json({ ok: false, error: "member_not_found" }, 404);
  return json({ ok: true, memberId: result.id, status: result.status, updatedAt: result.updated_at });
}

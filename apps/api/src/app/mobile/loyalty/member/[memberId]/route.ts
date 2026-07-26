export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../../lib/http";
import { getLoyaltyMemberById } from "../../../../../lib/loyalty-service";
import { getConsumerFromRequest } from "../../../../../lib/consumer-auth";

export async function GET(req: Request, { params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  const member = await getLoyaltyMemberById({ memberId, consumerId: consumer.id });
  if (!member) return json({ ok: false, error: "member_not_found" }, 404);

  return json({
    ok: true,
    member: {
      id: member.id,
      tenantId: member.tenant_id,
      programId: member.program_id,
      programName: member.program_name,
      pointsName: member.points_name,
      status: member.status,
      displayName: member.display_name,
      country: member.country,
      preferredLocale: member.preferred_locale,
      pointsBalance: member.points_balance,
      lifetimePoints: member.lifetime_points,
      firstTapAt: member.first_tap_at,
      lastTapAt: member.last_tap_at,
      consent: member.consent_json,
      profile: member.profile_json,
    },
  });
}

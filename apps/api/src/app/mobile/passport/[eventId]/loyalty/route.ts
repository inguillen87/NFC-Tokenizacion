export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../../lib/http";
import { getActiveProgram, getTapEvent, readTapPointsPolicy, rewardRedemptionUnavailableReason } from "../../../../../lib/loyalty-service";
import { sql } from "../../../../../lib/db";
import { getConsumerFromRequest } from "../../../../../lib/consumer-auth";
import { isCurrentLoyaltyTapEligible } from "../../../../../lib/loyalty-tap-policy";

const COPY: Record<string, Record<string, string>> = {
  "es-AR": {
    earn: "Sumá puntos después de un evento NFC elegible según la política del emisor.",
    earnZero: "Esta lectura registra participación sin puntos, según la configuración de la marca.",
    blocked: "Este tap no suma puntos por seguridad.",
    enroll: "Completá tu perfil y desbloqueá beneficios.",
  },
  "pt-BR": {
    earn: "Ganhe pontos após um evento NFC elegível segundo a política do emissor.",
    earnZero: "Esta leitura registra participação sem pontos, conforme a configuração da marca.",
    blocked: "Este tap não soma pontos por segurança.",
    enroll: "Complete seu perfil e desbloqueie benefícios.",
  },
  en: {
    earn: "Earn points after an eligible NFC event under the issuer policy.",
    earnZero: "This reading records participation without points under the brand configuration.",
    blocked: "This tap does not earn points for security reasons.",
    enroll: "Complete your profile to unlock benefits.",
  },
};

function copyFor(locale: string | null) {
  const key = locale && COPY[locale] ? locale : "es-AR";
  return COPY[key];
}

export async function GET(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const locale = new URL(req.url).searchParams.get("locale") || "es-AR";
  const tapEvent = await getTapEvent(eventId);
  if (!tapEvent) return json({ ok: false, error: "event_not_found" }, 404);
  const program = await getActiveProgram(tapEvent.tenant_id);
  if (!program) return json({ ok: false, error: "program_not_found" }, 404);

  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  const memberRows = await sql/*sql*/`
    SELECT member.id, member.status, member.points_balance, member.lifetime_points, membership.status AS membership_status
    FROM loyalty_members member
    LEFT JOIN tenant_consumer_memberships membership ON membership.tenant_id=member.tenant_id AND membership.consumer_id=member.consumer_id
    WHERE member.tenant_id = ${tapEvent.tenant_id}
      AND member.program_id = ${program.id}
      AND member.consumer_id = ${consumer.id}
    LIMIT 1
  `;
  const member = memberRows[0] || null;
  const tapEligible = isCurrentLoyaltyTapEligible(tapEvent);
  const tapPolicy = readTapPointsPolicy(program);
  const existingMembershipAllowsTap = member?.membership_status === null || member?.membership_status === undefined || member?.membership_status === 'active';
  const copy = copyFor(locale);

  const rewards = await sql/*sql*/`
      SELECT id, code, title, description, points_cost, stock_remaining, starts_at, ends_at, status, requires_age_gate, eligibility_json
      FROM rewards
      WHERE program_id = ${program.id}
        AND tenant_id = ${tapEvent.tenant_id}
        AND status = 'active'
      ORDER BY points_cost ASC, created_at DESC
      LIMIT 10
    `;

  const rewardCards = rewards.map((reward: any) => {
    const reason=rewardRedemptionUnavailableReason({tapEligible,program,reward,member,membershipStatus:member?.membership_status,consumer});
    const { eligibility_json: _eligibility, ...publicReward } = reward;
    return {...publicReward,state:reason==='out_of_stock'?'out_of_stock':reason?'locked':'available',canRedeem:reason===null,redeemUnavailableReason:reason};
  });

  return json({
    ok: true,
    locale,
    loyalty: {
      memberId: member?.id || null,
      pointsBalance: member?.points_balance ?? null,
      lifetimePoints: member?.lifetime_points ?? null,
      pointsName: program.points_name,
      claimTap: tapEligible && tapPolicy && existingMembershipAllowsTap && member && ["enrolled", "verified"].includes(String(member.status)) ? tapPolicy.points===0?copy.earnZero:copy.earn : copy.blocked,
      claimStatus: "not_attempted_read_only",
      enrollCta: !tapEligible || member?.status === "blocked" || member?.status === "deleted" || member?.status === "enrolled" || member?.status === "verified" ? null : copy.enroll,
      rewards: rewardCards,
    },
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../../lib/http";
import { getActiveProgram, getTapEvent } from "../../../../../lib/loyalty-service";
import { sql } from "../../../../../lib/db";
import { getConsumerFromRequest } from "../../../../../lib/consumer-auth";

const COPY: Record<string, Record<string, string>> = {
  "es-AR": {
    earn: "Sumá puntos después de un evento NFC elegible según la política del emisor.",
    blocked: "Este tap no suma puntos por seguridad.",
    enroll: "Completá tu perfil y desbloqueá beneficios.",
  },
  "pt-BR": {
    earn: "Ganhe pontos após um evento NFC elegível segundo a política do emissor.",
    blocked: "Este tap não soma pontos por segurança.",
    enroll: "Complete seu perfil e desbloqueie benefícios.",
  },
  en: {
    earn: "Earn points after an eligible NFC event under the issuer policy.",
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
    SELECT id, status, points_balance, lifetime_points
    FROM loyalty_members
    WHERE tenant_id = ${tapEvent.tenant_id}
      AND program_id = ${program.id}
      AND consumer_id = ${consumer.id}
    LIMIT 1
  `;
  const member = memberRows[0] || null;
  const copy = copyFor(locale);

  const rewards = await sql/*sql*/`
      SELECT id, code, title, description, points_cost, stock_remaining, starts_at, ends_at
      FROM rewards
      WHERE program_id = ${program.id}
        AND status = 'active'
      ORDER BY points_cost ASC, created_at DESC
      LIMIT 10
    `;

  const rewardCards = rewards.map((reward: any) => ({
    ...reward,
    state: reward.stock_remaining !== null && reward.stock_remaining <= 0 ? "out_of_stock" : member && member.points_balance >= reward.points_cost ? "available" : "locked",
  }));

  return json({
    ok: true,
    locale,
    loyalty: {
      memberId: member?.id || null,
      pointsBalance: member?.points_balance ?? null,
      lifetimePoints: member?.lifetime_points ?? null,
      pointsName: program.points_name,
      claimTap: member ? copy.earn : copy.blocked,
      claimStatus: "not_attempted_read_only",
      enrollCta: member?.status === "enrolled" || member?.status === "verified" ? null : copy.enroll,
      rewards: rewardCards,
    },
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createHash } from "node:crypto";
import { json } from "../../../../../lib/http";
import { claimTapPoints, getActiveProgram, getOrCreateMember, getTapEvent } from "../../../../../lib/loyalty-service";
import { sql } from "../../../../../lib/db";
import { getConsumerFromRequest } from "../../../../../lib/consumer-auth";

const COPY: Record<string, Record<string, string>> = {
  "es-AR": {
    earn: "Sumá puntos con productos auténticos.",
    blocked: "Este tap no suma puntos por seguridad.",
    enroll: "Completá tu perfil y desbloqueá beneficios.",
  },
  "pt-BR": {
    earn: "Ganhe pontos com produtos autênticos.",
    blocked: "Este tap não soma pontos por segurança.",
    enroll: "Complete seu perfil e desbloqueie benefícios.",
  },
  en: {
    earn: "Earn points with authentic products.",
    blocked: "This tap does not earn points for security reasons.",
    enroll: "Complete your profile to unlock benefits.",
  },
};

function copyFor(locale: string | null) {
  const key = locale && COPY[locale] ? locale : "es-AR";
  return COPY[key];
}

function anonymousMemberKey(req: Request, eventId: string) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "no-ip";
  const ua = req.headers.get("user-agent") || "no-ua";
  const seed = `${eventId}:${ip}:${ua}`;
  return `anon:${createHash("sha256").update(seed).digest("hex").slice(0, 20)}`;
}

export async function GET(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const locale = new URL(req.url).searchParams.get("locale") || "es-AR";
  const tapEvent = await getTapEvent(eventId);
  if (!tapEvent) return json({ ok: false, error: "event_not_found" }, 404);
  const program = await getActiveProgram(tapEvent.tenant_id);
  if (!program) return json({ ok: false, error: "program_not_found" }, 404);

  const consumer = await getConsumerFromRequest(req);
  const memberKey = consumer?.id ? `consumer:${consumer.id}` : anonymousMemberKey(req, eventId);
  const member = await getOrCreateMember({
    tenantId: tapEvent.tenant_id,
    programId: program.id,
    eventId: String(tapEvent.id),
    memberKey,
    consumerId: consumer?.id || null,
    locale,
    email: consumer?.email || null,
    phone: consumer?.phone || null,
    country: tapEvent.country_code || null,
  });
  const claim = await claimTapPoints({
    eventId: String(tapEvent.id),
    locale,
    memberKey,
    consumerId: consumer?.id || null,
    email: consumer?.email || null,
    phone: consumer?.phone || null,
  });
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
    state: reward.stock_remaining !== null && reward.stock_remaining <= 0 ? "out_of_stock" : member.points_balance >= reward.points_cost ? "available" : "locked",
  }));

  return json({
    ok: true,
    locale,
    loyalty: {
      memberId: member.id,
      pointsBalance: member.points_balance,
      lifetimePoints: member.lifetime_points,
      pointsName: program.points_name,
      claimTap: claim.awarded ? copy.earn : copy.blocked,
      enrollCta: member.status === "enrolled" ? null : copy.enroll,
      rewards: rewardCards,
    },
  });
}

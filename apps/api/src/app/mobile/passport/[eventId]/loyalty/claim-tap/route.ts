export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createHash } from "node:crypto";
import { json } from "../../../../../../lib/http";
import { claimTapPoints } from "../../../../../../lib/loyalty-service";
import { getConsumerFromRequest } from "../../../../../../lib/consumer-auth";

function anonymousMemberKey(req: Request, eventId: string) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "no-ip";
  const ua = req.headers.get("user-agent") || "no-ua";
  const seed = `${eventId}:${ip}:${ua}`;
  const hash = createHash("sha256").update(seed).digest("hex").slice(0, 20);
  return `anon:${hash}`;
}

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const locale = new URL(req.url).searchParams.get("locale") || "es-AR";
  const consumer = await getConsumerFromRequest(req);
  const memberKey = consumer?.id ? `consumer:${consumer.id}` : anonymousMemberKey(req, eventId);
  const result = await claimTapPoints({
    eventId,
    locale,
    memberKey,
    consumerId: consumer?.id || null,
    email: consumer?.email || null,
    phone: consumer?.phone || null,
  });
  if (!result.ok) return json(result, result.status);
  return json(result);
}

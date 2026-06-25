export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createHash } from "node:crypto";
import { getConsumerFromRequest } from "../../../../../../lib/consumer-auth";
import { json } from "../../../../../../lib/http";
import { getTriviaForTap, submitTriviaForTap } from "../../../../../../lib/trivia-service";

function anonymousMemberKey(req: Request, eventId: string) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "no-ip";
  const ua = req.headers.get("user-agent") || "no-ua";
  return `anon:${createHash("sha256").update(`${eventId}:${ip}:${ua}`).digest("hex").slice(0, 20)}`;
}

export async function GET(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const searchParams = new URL(req.url).searchParams;
  const locale = searchParams.get("locale") || "es-AR";
  const consumer = await getConsumerFromRequest(req);
  const memberKey = consumer?.id ? `consumer:${consumer.id}` : anonymousMemberKey(req, eventId);
  const result = await getTriviaForTap({
    eventId,
    memberKey,
    consumerId: consumer?.id || null,
    email: consumer?.email || null,
    phone: consumer?.phone || null,
    locale,
    tenantSlug: searchParams.get("tenant") || searchParams.get("tenantSlug"),
    tenantName: searchParams.get("tenantName"),
    productName: searchParams.get("product") || searchParams.get("productName"),
    brandName: searchParams.get("brand") || searchParams.get("winery") || searchParams.get("brandName"),
    city: searchParams.get("city"),
    country: searchParams.get("country"),
  });
  return json(result, result.status);
}

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const body = await req.json().catch(() => ({}));
  const locale = String(body?.locale || new URL(req.url).searchParams.get("locale") || "es-AR");
  const consumer = await getConsumerFromRequest(req);
  const memberKey = consumer?.id ? `consumer:${consumer.id}` : anonymousMemberKey(req, eventId);
  const answers = Array.isArray(body?.answers) ? body.answers : [];
  const result = await submitTriviaForTap({
    eventId,
    memberKey,
    answers,
    consumerId: consumer?.id || null,
    email: consumer?.email || null,
    phone: consumer?.phone || null,
    locale,
    tenantSlug: String(body?.tenantSlug || body?.tenant || ""),
    tenantName: String(body?.tenantName || ""),
    productName: String(body?.productName || body?.product || ""),
    brandName: String(body?.brandName || body?.brand || body?.winery || ""),
    city: String(body?.city || ""),
    country: String(body?.country || ""),
  });
  return json(result, result.status);
}

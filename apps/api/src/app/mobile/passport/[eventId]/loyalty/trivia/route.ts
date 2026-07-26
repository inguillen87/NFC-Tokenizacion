export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getConsumerFromRequest } from "../../../../../../lib/consumer-auth";
import { json } from "../../../../../../lib/http";
import { getTriviaForTap, submitTriviaForTap } from "../../../../../../lib/trivia-service";
import { getTapEvent } from "../../../../../../lib/loyalty-service";
import { enforceCriticalRateLimit } from "../../../../../../lib/critical-rate-limit";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../../../lib/bounded-request-body";
import { consumeSunFreshHandoff } from "../../../../../../lib/sun-fresh-handoff";

export async function GET(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const searchParams = new URL(req.url).searchParams;
  const locale = searchParams.get("locale") || "es-AR";
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  const memberKey = `consumer:${consumer.id}`;
  const result = await getTriviaForTap({
    eventId,
    memberKey,
    consumerId: consumer.id,
    email: consumer.email || null,
    phone: consumer.phone || null,
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
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  const limited = await enforceCriticalRateLimit(req, { rateClass: "public_write", tenantId: "consumer", subjectId: `consumer:${consumer.id}:loyalty-trivia` });
  if (limited) return limited;
  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonBody<Record<string, unknown>>(req, 32 * 1024);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, error: tooLarge ? "request_body_too_large" : "invalid_json" }, tooLarge ? 413 : 400);
  }
  const locale = String(body?.locale || new URL(req.url).searchParams.get("locale") || "es-AR");
  const event = await getTapEvent(eventId);
  if (!event) return json({ ok: false, error: "event_not_found" }, 404);
  const capability = await consumeSunFreshHandoff(req, body, {
    eventId: String(event.id), bid: String(event.bid || ""), uidHex: String(event.uid_hex || ""), readCounter: event.sdm_read_ctr,
  }, "loyalty_trivia_submit");
  if (!capability.ok) return json({ ok: false, error: "fresh_tap_capability_required", fresh_token_status: capability.reason }, 403);
  const memberKey = `consumer:${consumer.id}`;
  const answers = Array.isArray(body?.answers) ? body.answers : [];
  const result = await submitTriviaForTap({
    eventId,
    memberKey,
    answers,
    consumerId: consumer.id,
    email: consumer.email || null,
    phone: consumer.phone || null,
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

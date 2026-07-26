export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../../../lib/http";
import { requestLoyaltyMemberDataDeletion } from "../../../../../../lib/loyalty-service";
import { getConsumerFromRequest } from "../../../../../../lib/consumer-auth";
import { enforceCriticalRateLimit } from "../../../../../../lib/critical-rate-limit";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../../../lib/bounded-request-body";

export async function DELETE(req: Request, { params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  const limited = await enforceCriticalRateLimit(req, { rateClass: "public_write", tenantId: "consumer", subjectId: `consumer:${consumer.id}:loyalty-delete` });
  if (limited) return limited;
  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonBody<Record<string, unknown>>(req, 8 * 1024);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, error: tooLarge ? "request_body_too_large" : "invalid_json" }, tooLarge ? 413 : 400);
  }

  const result = await requestLoyaltyMemberDataDeletion({
    memberId,
    consumerId: consumer.id,
    reason: typeof body.reason === "string" ? body.reason.trim().slice(0, 240) : "consumer_request",
  });

  if (!result) return json({ ok: false, error: "member_not_found" }, 404);
  return json({ ok: true, memberId: result.id, status: result.status, updatedAt: result.updated_at });
}

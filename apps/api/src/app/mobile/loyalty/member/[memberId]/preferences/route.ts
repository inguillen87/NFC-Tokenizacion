export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../../../lib/http";
import { updateLoyaltyMemberPreferences } from "../../../../../../lib/loyalty-service";
import { getConsumerFromRequest } from "../../../../../../lib/consumer-auth";
import { enforceCriticalRateLimit } from "../../../../../../lib/critical-rate-limit";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../../../lib/bounded-request-body";

export async function PATCH(req: Request, { params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  const limited = await enforceCriticalRateLimit(req, { rateClass: "public_write", tenantId: "consumer", subjectId: `consumer:${consumer.id}:loyalty-preferences` });
  if (limited) return limited;
  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonBody<Record<string, unknown>>(req, 16 * 1024);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, error: tooLarge ? "request_body_too_large" : "invalid_json" }, tooLarge ? 413 : 400);
  }

  const updated = await updateLoyaltyMemberPreferences({
    memberId,
    consumerId: consumer.id,
    preferredLocale: typeof body.preferredLocale === "string" ? body.preferredLocale.slice(0, 12) : null,
    displayName: typeof body.displayName === "string" ? body.displayName.trim().slice(0, 120) : null,
    country: typeof body.country === "string" ? body.country.trim().slice(0, 80) : null,
    consent: body.consent && typeof body.consent === "object" && !Array.isArray(body.consent) ? body.consent as Record<string, unknown> : null,
    profilePatch: body.profilePatch && typeof body.profilePatch === "object" && !Array.isArray(body.profilePatch) ? body.profilePatch as Record<string, unknown> : null,
  });

  if (!updated) return json({ ok: false, error: "member_not_found" }, 404);
  return json({
    ok: true,
    member: {
      id: updated.id,
      status: updated.status,
      preferredLocale: updated.preferred_locale,
      displayName: updated.display_name,
      country: updated.country,
      consent: updated.consent_json,
      profile: updated.profile_json,
      updatedAt: updated.updated_at,
    },
  });
}

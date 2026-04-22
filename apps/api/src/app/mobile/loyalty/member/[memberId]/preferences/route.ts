export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../../../lib/http";
import { updateLoyaltyMemberPreferences } from "../../../../../../lib/loyalty-service";

export async function PATCH(req: Request, { params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const body = await req.json().catch(() => ({}));
  const tenantId = body?.tenantId || null;

  const updated = await updateLoyaltyMemberPreferences({
    memberId,
    tenantId,
    preferredLocale: body?.preferredLocale || null,
    displayName: body?.displayName || null,
    country: body?.country || null,
    consent: body?.consent || null,
    profilePatch: body?.profilePatch || null,
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

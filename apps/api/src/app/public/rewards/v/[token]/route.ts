export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  cleanPublicRewardToken,
  formatPublicRewardClaim,
  getPublicRewardClaimByToken,
  publicRewardPassUrl,
} from "../../../../../lib/reward-public-links";
import { json } from "../../../../../lib/http";
import { enforceCriticalRateLimit } from "../../../../../lib/critical-rate-limit";

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const limited = await enforceCriticalRateLimit(req, { rateClass: "public", tenantId: "platform", subjectId: "public-reward-token" });
  if (limited) return limited;
  const { token } = await params;
  const publicToken = cleanPublicRewardToken(token);
  if (!publicToken) return json({ ok: false, reason: "invalid_reward_link" }, 400);

  const claim = await getPublicRewardClaimByToken(publicToken);
  if (!claim) return json({ ok: false, reason: "reward_link_not_found" }, 404);

  const formatted = formatPublicRewardClaim(claim);
  if (!formatted) return json({ ok: false, reason: "reward_link_not_found" }, 404);

  return json({
    ok: true,
    reward: {
      ...formatted,
      passImageUrl: publicRewardPassUrl(req, publicToken),
    },
  }, 200, {
    "cache-control": "no-store",
    "x-robots-tag": "noindex, nofollow",
  });
}

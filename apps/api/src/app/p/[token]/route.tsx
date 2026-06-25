export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { renderRewardPassImage } from "../../../lib/reward-pass-image";
import {
  cleanPublicRewardToken,
  getPublicRewardClaimByToken,
  publicApiBase,
  publicRewardStaffUrl,
} from "../../../lib/reward-public-links";

function clean(value: unknown) {
  return String(value || "").trim();
}

function formatArDate(value: unknown) {
  const date = new Date(clean(value));
  if (Number.isNaN(date.getTime())) return "48h desde emision";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const publicToken = cleanPublicRewardToken(token);
  if (!publicToken) return new Response("Invalid reward link", { status: 400 });

  const claim = await getPublicRewardClaimByToken(publicToken);
  if (!claim) return new Response("Reward link not found", { status: 404 });

  const metadata = claim.metadata_json || {};
  const response = await renderRewardPassImage({
    code: clean(claim.redemption_code),
    seal: clean(metadata.verification_seal).toUpperCase(),
    brandName: clean(claim.tenant_name) || "nexID Partner",
    rewardTitle: clean(claim.reward_title) || "Beneficio nexID post-tap",
    consumerName: clean(claim.display_name) || "Cliente nexID",
    phoneLast4: clean(claim.phone).replace(/[^\d]/g, "").slice(-4),
    expiresAt: formatArDate(claim.expires_at || new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()),
    status: clean(claim.status) || "claimed",
    validationUrl: publicRewardStaffUrl(publicToken),
    logoUrl: `${publicApiBase(req)}/nexid-mark-transparent-512.png`,
  });

  response.headers.set("cache-control", "no-store, max-age=0");
  response.headers.set("x-robots-tag", "noindex, nofollow");
  return response;
}

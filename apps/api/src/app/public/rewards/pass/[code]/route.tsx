export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { renderRewardPassImage } from "../../../../../lib/reward-pass-image";
import {
  ensureRewardPublicToken,
  getPublicRewardClaimByCode,
  publicApiBase,
  publicRewardUrl,
} from "../../../../../lib/reward-public-links";

function clean(value: unknown) {
  return String(value || "").trim();
}

function validCode(value: string) {
  return /^\d{6,10}$/.test(value);
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

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const normalizedCode = clean(code).replace(/[^\d]/g, "");
  if (!validCode(normalizedCode)) return new Response("Invalid voucher code", { status: 400 });

  const url = new URL(req.url);
  const providedSeal = clean(url.searchParams.get("seal")).replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 24);
  const fallbackTenant = clean(url.searchParams.get("tenant")).replace(/[^a-z0-9-]/gi, "").toLowerCase().slice(0, 60) || "demobodega";
  const claim = await getPublicRewardClaimByCode(normalizedCode);
  const metadata = claim?.metadata_json || {};
  const expectedSeal = clean(metadata.verification_seal).toUpperCase();
  const brandName = clean(claim?.tenant_name) || clean(claim?.tenant_slug) || fallbackTenant || "nexID Partner";

  if (claim && expectedSeal && providedSeal !== expectedSeal) {
    return new Response("Invalid voucher seal", { status: 403 });
  }

  const publicToken = claim?.id
    ? await ensureRewardPublicToken(String(claim.id), metadata)
    : `legacy-${normalizedCode}`;

  const response = await renderRewardPassImage({
    code: normalizedCode,
    seal: expectedSeal || providedSeal,
    brandName,
    rewardTitle: clean(claim?.reward_title) || "Beneficio nexID post-tap",
    consumerName: clean(claim?.display_name) || "Cliente nexID",
    phoneLast4: clean(claim?.phone).replace(/[^\d]/g, "").slice(-4),
    expiresAt: formatArDate(claim?.expires_at || new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()),
    status: clean(claim?.status) || "claimed",
    validationUrl: publicRewardUrl(publicToken),
    logoUrl: `${publicApiBase(req)}/nexid-mark-pulse-512.png`,
  });

  response.headers.set("cache-control", "public, max-age=300");
  response.headers.set("x-robots-tag", "noindex, nofollow");
  return response;
}

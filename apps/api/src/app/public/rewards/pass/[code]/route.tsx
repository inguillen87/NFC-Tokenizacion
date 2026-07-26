export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { renderRewardPassImage } from "../../../../../lib/reward-pass-image";
import {
  ensureRewardPublicToken,
  getPublicRewardClaimByCode,
  publicApiBase,
  publicRewardStaffUrl,
} from "../../../../../lib/reward-public-links";
import { enforceCriticalRateLimit } from "../../../../../lib/critical-rate-limit";

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
  const limited = await enforceCriticalRateLimit(req, { rateClass: "public", tenantId: "platform", subjectId: "public-reward-pass" });
  if (limited) return limited;
  const { code } = await params;
  const normalizedCode = clean(code).replace(/[^\d]/g, "");
  if (!validCode(normalizedCode)) return new Response("Invalid voucher code", { status: 400 });

  const url = new URL(req.url);
  const providedSeal = clean(url.searchParams.get("seal")).replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 24);
  const fallbackTenant = clean(url.searchParams.get("tenant")).replace(/[^a-z0-9-]/gi, "").toLowerCase().slice(0, 60) || "demobodega";
  const claim = await getPublicRewardClaimByCode(normalizedCode);
  if (!claim) return new Response("Voucher not found", { status: 404 });
  const metadata = claim?.metadata_json || {};
  const expectedSeal = clean(metadata.verification_seal).toUpperCase();
  const brandName = clean(claim?.tenant_name) || clean(claim?.tenant_slug) || fallbackTenant || "nexID Partner";

  if (claim && expectedSeal && providedSeal !== expectedSeal) {
    return new Response("Invalid voucher seal", { status: 403 });
  }

  const publicToken = await ensureRewardPublicToken(String(claim.id), metadata);

  const response = await renderRewardPassImage({
    code: normalizedCode,
    seal: expectedSeal || providedSeal,
    brandName,
    rewardTitle: clean(claim?.reward_title) || "Beneficio nexID post-tap",
    consumerName: clean(claim?.display_name) || "Cliente nexID",
    phoneLast4: clean(claim?.phone).replace(/[^\d]/g, "").slice(-4),
    expiresAt: formatArDate(claim?.expires_at || new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()),
    status: clean(claim?.status) || "claimed",
    validationUrl: publicRewardStaffUrl(publicToken),
    logoUrl: `${publicApiBase(req)}/nexid-mark-transparent-512.png`,
  });

  response.headers.set("cache-control", "no-store, max-age=0");
  response.headers.set("x-robots-tag", "noindex, nofollow");
  return response;
}

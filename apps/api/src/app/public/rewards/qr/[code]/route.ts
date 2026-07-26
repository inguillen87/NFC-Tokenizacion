export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import QRCode from "qrcode";
import {
  ensureRewardPublicToken,
  getPublicRewardClaimByCode,
  publicRewardStaffUrl,
} from "../../../../../lib/reward-public-links";
import { enforceCriticalRateLimit } from "../../../../../lib/critical-rate-limit";

function clean(value: unknown) {
  return String(value || "").trim();
}

function validCode(value: string) {
  return /^\d{6,10}$/.test(value);
}

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const limited = await enforceCriticalRateLimit(req, { rateClass: "public", tenantId: "platform", subjectId: "public-reward-qr" });
  if (limited) return limited;
  const { code } = await params;
  const normalizedCode = clean(code).replace(/[^\d]/g, "");
  if (!validCode(normalizedCode)) return new Response("Invalid voucher code", { status: 400 });

  const url = new URL(req.url);
  const providedSeal = clean(url.searchParams.get("seal")).replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 24);
  const claim = await getPublicRewardClaimByCode(normalizedCode);
  if (!claim) return new Response("Voucher not found", { status: 404 });

  const metadata = claim.metadata_json || {};
  const expectedSeal = clean(metadata.verification_seal).toUpperCase();
  if (expectedSeal && providedSeal !== expectedSeal) {
    return new Response("Invalid voucher seal", { status: 403 });
  }

  const publicToken = await ensureRewardPublicToken(String(claim.id), metadata);
  const svg = await QRCode.toString(publicRewardStaffUrl(publicToken), {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 2,
    width: 720,
    color: {
      dark: "#020617",
      light: "#ffffff",
    },
  });

  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

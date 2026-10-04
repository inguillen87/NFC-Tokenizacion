export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../lib/http";
import { getConsumerFromRequest } from "../../../../lib/consumer-auth";
import { enforceCriticalRateLimit } from "../../../../lib/critical-rate-limit";

/**
 * Ownership and a fresh tap do not prove that a unit remains intact. Listing
 * stays unavailable alongside P2P settlement until current unit eligibility
 * can be revalidated when creating, publishing and settling an offer.
 */
export async function POST(req: Request) {
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  const limited = await enforceCriticalRateLimit(req, {
    rateClass: "public_write",
    tenantId: "marketplace",
    subjectId: `p2p-list:${consumer.id}`,
    globalPrincipal: true,
  });
  if (limited) return limited;

  return json({
    ok: false,
    error: "p2p_listing_unavailable",
    state: "feature_disabled",
    retryable: false,
    listing_created: false,
    sellable: false,
    fresh_tap_consumed: false,
    chain_transfer_status: "not_executed",
    nft_transfer_executed: false,
    custody_unchanged: true,
    detail: "No resale offer or purchase was created. Unit resale requires current eligibility checks and the durable settlement coordinator.",
  }, 503, { "cache-control": "no-store" });
}

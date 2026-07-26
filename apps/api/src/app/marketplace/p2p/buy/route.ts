export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../lib/http";
import { getConsumerFromRequest } from "../../../../lib/consumer-auth";
import { enforceCriticalRateLimit } from "../../../../lib/critical-rate-limit";

/**
 * Secondary settlement stays unavailable until nexID has an atomic settlement
 * coordinator (durable intent, executor idempotency and chain/DB reconcile).
 * A Polygon transaction followed by independent SQL writes is not safe enough
 * to expose as a purchase path.
 */
export async function POST(req: Request) {
  const buyer = await getConsumerFromRequest(req);
  if (!buyer) return json({ ok: false, error: "unauthorized" }, 401);
  const limited = await enforceCriticalRateLimit(req, {
    rateClass: "proof_write",
    tenantId: "marketplace",
    subjectId: `p2p-buy:${buyer.id}`,
    globalPrincipal: true,
  });
  if (limited) return limited;
  return json({
    ok: false,
    error: "p2p_settlement_unavailable",
    state: "feature_disabled",
    retryable: false,
    chain_transfer_status: "not_executed",
    nft_transfer_executed: false,
    custody_unchanged: true,
    detail: "No purchase or blockchain transfer was executed. Secondary settlement requires the durable settlement coordinator.",
  }, 503, { "cache-control": "no-store" });
}

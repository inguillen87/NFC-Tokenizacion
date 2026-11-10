export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getConsumerFromRequest } from "../../../../lib/consumer-auth";
import { getPrivateConsumerRewardReceipt } from "../../../../lib/consumer-rewards-read-model";
import { json } from "../../../../lib/http";

const PRIVATE_HEADERS = { "cache-control": "private, no-store" };

export async function GET(req: Request, { params }: { params: Promise<{ redemptionId: string }> }) {
  try {
    const consumer = await getConsumerFromRequest(req);
    if (!consumer) return json({ ok: false, error: "unauthorized" }, 401, PRIVATE_HEADERS);

    const { redemptionId } = await params;
    const receipt = await getPrivateConsumerRewardReceipt(String(consumer.id || ""), redemptionId);
    if (!receipt) return json({ ok: false, error: "receipt_not_found" }, 404, PRIVATE_HEADERS);
    return json({ ok: true, receipt }, 200, PRIVATE_HEADERS);
  } catch {
    return json({ ok: false, error: "unavailable" }, 503, PRIVATE_HEADERS);
  }
}

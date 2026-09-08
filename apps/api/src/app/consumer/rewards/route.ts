export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { getConsumerFromRequest } from "../../../lib/consumer-auth";
import { json } from "../../../lib/http";
import { CONSUMER_REWARDS_LIMIT, getPrivateConsumerRewards } from "../../../lib/consumer-rewards-read-model";

const PRIVATE_HEADERS = { "cache-control": "private, no-store" };

export async function GET(req: Request) {
  try {
    const consumer = await getConsumerFromRequest(req);
    if (!consumer) return json({ ok: false, error: "unauthorized" }, 401, PRIVATE_HEADERS);
    const items = await getPrivateConsumerRewards(String(consumer.id || ""));
    return json({ ok: true, items, scope: "own_brands", limit: CONSUMER_REWARDS_LIMIT }, 200, PRIVATE_HEADERS);
  } catch {
    return json({ ok: false, error: "unavailable" }, 503, PRIVATE_HEADERS);
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getConsumerFromRequest } from "../../../../lib/consumer-auth";
import { canonicalConsumerTapEventId, getPrivateConsumerTapDetail } from "../../../../lib/consumer-tap-detail";
import { json } from "../../../../lib/http";

const PRIVATE_HEADERS = { "cache-control": "private, no-store" };

export async function GET(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const consumer = await getConsumerFromRequest(req);
    if (!consumer) return json({ ok: false, error: "unauthorized" }, 401, PRIVATE_HEADERS);

    const eventId = canonicalConsumerTapEventId((await params).eventId);
    if (!eventId) return json({ ok: false, error: "invalid_event_id" }, 400, PRIVATE_HEADERS);

    const item = await getPrivateConsumerTapDetail(String(consumer.id || ""), eventId);
    if (!item) return json({ ok: false, error: "tap_not_found" }, 404, PRIVATE_HEADERS);
    return json({ ok: true, item }, 200, PRIVATE_HEADERS);
  } catch {
    // Do not expose database details, session credentials or event identifiers.
    return json({ ok: false, error: "unavailable" }, 503, PRIVATE_HEADERS);
  }
}

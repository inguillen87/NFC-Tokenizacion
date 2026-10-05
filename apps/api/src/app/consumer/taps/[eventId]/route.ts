export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getConsumerFromRequest } from "../../../../lib/consumer-auth";
import { canonicalConsumerTapEventId, getPrivateConsumerTapDetail } from "../../../../lib/consumer-tap-detail";
import { json } from "../../../../lib/http";
import { readCurrentPassportEditorial } from "../../../../lib/current-passport-editorial";

const PRIVATE_HEADERS = { "cache-control": "private, no-store" };

export async function GET(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const consumer = await getConsumerFromRequest(req);
    if (!consumer) return json({ ok: false, error: "unauthorized" }, 401, PRIVATE_HEADERS);

    const eventId = canonicalConsumerTapEventId((await params).eventId);
    if (!eventId) return json({ ok: false, error: "invalid_event_id" }, 400, PRIVATE_HEADERS);

    const item = await getPrivateConsumerTapDetail(String(consumer.id || ""), eventId);
    if (!item) return json({ ok: false, error: "tap_not_found" }, 404, PRIVATE_HEADERS);
    // This lookup is deliberately after the exact consumer/event authorization.
    // Historical result and identity remain untouched beside current content.
    const currentEditorial = await readCurrentPassportEditorial(eventId);
    return json({ ok: true, item: { ...item, currentEditorial } }, 200, PRIVATE_HEADERS);
  } catch {
    // Do not expose database details, session credentials or event identifiers.
    return json({ ok: false, error: "unavailable" }, 503, PRIVATE_HEADERS);
  }
}

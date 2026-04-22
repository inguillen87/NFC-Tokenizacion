export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { json } from "../../../../../../lib/http";
import { getConsumerFromRequest } from "../../../../../../lib/consumer-auth";
import { saveTapForConsumer } from "../../../../../../lib/consumer-portal-service";

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  const { eventId } = await params;
  const event = await saveTapForConsumer({ consumerId: consumer.id, eventId });
  if (!event) return json({ ok: false, error: "event_not_found" }, 404);
  return json({ ok: true, eventId, consumerId: consumer.id, verdict: event.result });
}

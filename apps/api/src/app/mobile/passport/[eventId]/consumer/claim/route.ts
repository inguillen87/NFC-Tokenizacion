export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { json } from "../../../../../../lib/http";
import { getConsumerFromRequest } from "../../../../../../lib/consumer-auth";
import { claimOwnershipForConsumer } from "../../../../../../lib/consumer-portal-service";

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  const { eventId } = await params;
  const claimed = await claimOwnershipForConsumer({ consumerId: consumer.id, eventId, source: "sun_passport" });
  if (!claimed.ok) return json({ ok: false, error: claimed.error, ownership: claimed.ownership || null }, claimed.status);
  return json({ ok: true, eventId, consumerId: consumer.id, ownership: claimed.ownership });
}

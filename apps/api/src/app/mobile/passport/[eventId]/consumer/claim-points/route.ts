export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { json } from "../../../../../../lib/http";
import { getConsumerFromRequest } from "../../../../../../lib/consumer-auth";
import { claimPointsForConsumer } from "../../../../../../lib/consumer-portal-service";

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  const { eventId } = await params;
  const result = await claimPointsForConsumer({ consumerId: consumer.id, eventId });
  return json(result, result.ok ? 200 : 400);
}

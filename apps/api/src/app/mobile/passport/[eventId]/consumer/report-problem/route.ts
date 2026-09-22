import { json } from "../../../../../../lib/http";
import { getConsumerFromRequest } from "../../../../../../lib/consumer-auth";
import { enforceConsumerMutationOrigin } from "../../../../../../lib/consumer-mutation-origin";
import { handleSupportReport } from "../../../../../../lib/support-report-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const originDenied = enforceConsumerMutationOrigin(req);
  if (originDenied) return originDenied;
  try {
    const consumer = await getConsumerFromRequest(req);
    if (!consumer) return json({ ok: false, error: "unauthorized" }, 401, { "cache-control": "private, no-store" });
    return handleSupportReport(req, { id: String(consumer.id), eventId: (await params).eventId });
  } catch { return json({ ok: false, error: "support_session_unavailable" }, 503, { "cache-control": "private, no-store" }); }
}

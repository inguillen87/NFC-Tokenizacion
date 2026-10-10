export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { getConsumerFromRequest } from "../../../lib/consumer-auth";
import { json } from "../../../lib/http";
import { ensureConsumerPortalSchema } from "../../../lib/commercial-runtime-schema";
import { getPrivateConsumerProgramBalances } from "../../../lib/consumer-program-balance-read-model";
export async function GET(req: Request) {
  try {
    const consumer = await getConsumerFromRequest(req);
    if (!consumer) return json({ ok: false, error: "unauthorized" }, 401, { "cache-control": "private, no-store" });
    await ensureConsumerPortalSchema();
    const rows = await getPrivateConsumerProgramBalances(String(consumer.id));
    return json({ ok: true, items: rows }, 200, { "cache-control": "private, no-store" });
  } catch {
    return json({ ok: false, error: "unavailable" }, 503, { "cache-control": "private, no-store" });
  }
}

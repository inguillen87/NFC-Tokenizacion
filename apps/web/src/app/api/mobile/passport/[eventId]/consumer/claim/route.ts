import { proxyToApi } from "../../../../../_lib/runtime-proxy";
import { proxyConsumerTapAction } from "../../../../../_lib/consumer-tap-handoff";
export const runtime = "nodejs";
export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) { const { eventId } = await params; return proxyConsumerTapAction(req, `/mobile/passport/${encodeURIComponent(eventId)}/consumer/claim`, proxyToApi); }

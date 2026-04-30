import { proxyToApi } from "../../../../../_lib/runtime-proxy";
export const runtime = "nodejs";
export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) { const { eventId } = await params; return proxyToApi(req, `/mobile/passport/${encodeURIComponent(eventId)}/consumer/save-product`); }

import { proxyToApi } from "../../../../../_lib/runtime-proxy";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const query = new URL(req.url).search || "";
  return proxyToApi(req, `/mobile/passport/${encodeURIComponent(eventId)}/loyalty/trivia${query}`);
}

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return proxyToApi(req, `/mobile/passport/${encodeURIComponent(eventId)}/loyalty/trivia`);
}

import { proxyToApi } from "../../../_lib/runtime-proxy";
import { DEMO_CONSUMER_CODE, DEMO_CONSUMER_EMAIL } from "../../../../../lib/demo-consumer-data";
export const runtime = "nodejs";
export async function POST(req: Request) {
  const body = await req.clone().json().catch(() => ({} as Record<string, unknown>));
  const email = String((body as Record<string, unknown>).email || "").trim().toLowerCase();
  const upstream = await proxyToApi(req, "/consumer/auth/start");
  if (upstream.ok) return upstream;
  if (email === DEMO_CONSUMER_EMAIL) {
    return Response.json({ ok: true, code: DEMO_CONSUMER_CODE, demo: true });
  }
  return upstream;
}

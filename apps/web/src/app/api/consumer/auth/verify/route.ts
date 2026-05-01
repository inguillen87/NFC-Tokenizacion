import { proxyToApi } from "../../../_lib/runtime-proxy";
import { DEMO_CONSUMER_CODE, DEMO_CONSUMER_COOKIE, DEMO_CONSUMER_EMAIL } from "../../../../../lib/demo-consumer-data";
export const runtime = "nodejs";
export async function POST(req: Request) {
  const body = await req.clone().json().catch(() => ({} as Record<string, unknown>));
  const email = String((body as Record<string, unknown>).email || "").trim().toLowerCase();
  const code = String((body as Record<string, unknown>).code || "").trim();
  const upstream = await proxyToApi(req, "/consumer/auth/verify");
  if (email === DEMO_CONSUMER_EMAIL && code === DEMO_CONSUMER_CODE) {
    if (upstream.ok) {
      const text = await upstream.text();
      const res = new Response(text, { status: upstream.status, headers: new Headers(upstream.headers) });
      res.headers.append("set-cookie", DEMO_CONSUMER_COOKIE);
      return res;
    }
    const res = Response.json({ ok: true, demo: true, fallback: true });
    res.headers.append("set-cookie", DEMO_CONSUMER_COOKIE);
    return res;
  }
  return upstream;
}

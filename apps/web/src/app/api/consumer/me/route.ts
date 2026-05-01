import { proxyToApi } from "../../_lib/runtime-proxy";
import { demoConsumerPayload, hasDemoConsumerCookie } from "../../../../lib/demo-consumer-data";
export const runtime = "nodejs";
export async function GET(req: Request) {
  const upstream = await proxyToApi(req, "/consumer/me");
  if (upstream.ok) return upstream;
  if (process.env.NODE_ENV !== "production" && hasDemoConsumerCookie(req.headers.get("cookie") || "")) {
    const payload = demoConsumerPayload("/consumer/me");
    if (payload) return Response.json(payload);
  }
  return upstream;
}

import { proxyToApi } from "../../../_lib/runtime-proxy";
export const runtime = "nodejs";
export async function POST(req: Request) {
  const body = await req.clone().json().catch(() => ({} as Record<string, unknown>));
  const email = String((body as Record<string, unknown>).email || "").trim().toLowerCase();
  const code = String((body as Record<string, unknown>).code || "").trim();
  const upstream = await proxyToApi(req, "/consumer/auth/verify");
  if (upstream.ok) return upstream;
  if (email === "demo.consumer@nexid.local" && code === "000000") {
    const res = Response.json({ ok: true, demo: true });
    res.headers.append("set-cookie", "nexid_consumer_demo=1; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200");
    return res;
  }
  return upstream;
}

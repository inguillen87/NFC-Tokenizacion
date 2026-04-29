import { proxyToApi } from "../../../_lib/runtime-proxy";
export const runtime = "nodejs";
export async function POST(req: Request) {
  const body = await req.clone().json().catch(() => ({} as Record<string, unknown>));
  const email = String((body as Record<string, unknown>).email || "").trim().toLowerCase();
  const upstream = await proxyToApi(req, "/consumer/auth/start");
  if (upstream.ok) return upstream;
  if (email === "demo.consumer@nexid.local") {
    return Response.json({ ok: true, code: "000000", demo: true });
  }
  return upstream;
}

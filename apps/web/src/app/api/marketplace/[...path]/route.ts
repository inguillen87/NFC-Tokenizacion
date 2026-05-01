export const runtime = "nodejs";

import { proxyToApi } from "../../_lib/runtime-proxy";
import { demoMarketplacePayload, hasDemoConsumerCookie } from "../../../../lib/demo-consumer-data";

async function proxy(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const search = new URL(req.url).search;
  const targetPath = `/marketplace/${path.join("/")}${search}`;
  const upstream = await proxyToApi(req, targetPath);
  if (upstream.ok) return upstream;
  if (process.env.NODE_ENV !== "production" && hasDemoConsumerCookie(req.headers.get("cookie") || "")) {
    const payload = demoMarketplacePayload(targetPath);
    if (payload) return Response.json(payload);
  }
  return upstream;
}

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) { return proxy(req, ctx); }
export async function POST(req: Request, ctx: { params: Promise<{ path: string[] }> }) { return proxy(req, ctx); }

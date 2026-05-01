export const runtime = "nodejs";

import { proxyToApi } from "../../_lib/runtime-proxy";
import { demoConsumerPayload, hasDemoConsumerCookie } from "../../../../lib/demo-consumer-data";

async function proxy(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const targetPath = `/consumer/${path.join('/')}`;
  const upstream = await proxyToApi(req, targetPath);
  if (upstream.ok) return upstream;
  if (process.env.NODE_ENV !== "production" && hasDemoConsumerCookie(req.headers.get("cookie") || "")) {
    const payload = demoConsumerPayload(targetPath);
    if (payload) return Response.json(payload);
  }
  return upstream;
}

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) { return proxy(req, ctx); }
export async function POST(req: Request, ctx: { params: Promise<{ path: string[] }> }) { return proxy(req, ctx); }
export async function PATCH(req: Request, ctx: { params: Promise<{ path: string[] }> }) { return proxy(req, ctx); }
export async function DELETE(req: Request, ctx: { params: Promise<{ path: string[] }> }) { return proxy(req, ctx); }

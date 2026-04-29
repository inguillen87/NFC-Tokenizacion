export const runtime = "nodejs";

import { proxyToApi } from "../../_lib/runtime-proxy";

async function proxy(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyToApi(req, `/mobile/${path.join('/')}`);
}

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) { return proxy(req, ctx); }
export async function POST(req: Request, ctx: { params: Promise<{ path: string[] }> }) { return proxy(req, ctx); }
export async function PATCH(req: Request, ctx: { params: Promise<{ path: string[] }> }) { return proxy(req, ctx); }
export async function DELETE(req: Request, ctx: { params: Promise<{ path: string[] }> }) { return proxy(req, ctx); }

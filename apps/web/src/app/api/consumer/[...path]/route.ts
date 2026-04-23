export const runtime = "nodejs";

import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";

async function proxy(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const target = `${API_BASE}/consumer/${path.join('/')}`;
  const method = req.method;
  const body = method === 'GET' || method === 'HEAD' ? undefined : await req.text();
  const response = await fetch(target, {
    method,
    headers: {
      "content-type": req.headers.get("content-type") || "application/json",
      cookie: req.headers.get("cookie") || "",
    },
    body,
    cache: "no-store",
  });
  const text = await response.text();
  const next = new NextResponse(text, { status: response.status, headers: { "content-type": response.headers.get("content-type") || "application/json" } });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) next.headers.set("set-cookie", setCookie);
  return next;
}

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) { return proxy(req, ctx); }
export async function POST(req: Request, ctx: { params: Promise<{ path: string[] }> }) { return proxy(req, ctx); }
export async function PATCH(req: Request, ctx: { params: Promise<{ path: string[] }> }) { return proxy(req, ctx); }

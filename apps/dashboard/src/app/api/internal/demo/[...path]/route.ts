export const runtime = "nodejs";

import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3003";

async function forward(req: Request, path: string[]) {
  const target = `${API_BASE}/internal/demo/${path.join("/")}${new URL(req.url).search}`;
  const body = req.method === "GET" ? undefined : await req.text();

  const response = await fetch(target, {
    method: req.method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.ADMIN_API_KEY || ""}`,
    },
    body,
    cache: "no-store",
  });

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: { "Content-Type": response.headers.get("content-type") || "application/json" },
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const p = await params;
  return forward(req, p.path || []);
}

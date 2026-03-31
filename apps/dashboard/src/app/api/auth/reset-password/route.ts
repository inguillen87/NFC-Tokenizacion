import { NextResponse } from "next/server";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";
export async function POST(req: Request) {
  const upstream = await fetch(`${API_BASE}/auth/reset-password`, { method: "POST", headers: { "content-type": "application/json" }, body: await req.text(), cache: "no-store" });
  const text = await upstream.text();
  return new NextResponse(text, { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") || "application/json" } });
}

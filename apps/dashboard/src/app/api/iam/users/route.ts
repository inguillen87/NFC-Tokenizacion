import { NextResponse } from "next/server";
import { proxyToApi } from "../../../../lib/api-proxy";

export async function GET() {
  const upstream = await proxyToApi("/admin/users");
  const text = await upstream.text();
  return new NextResponse(text, { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") || "application/json" } });
}

export async function POST(req: Request) {
  const upstream = await proxyToApi("/admin/users", { method: "POST", body: await req.text() });
  const text = await upstream.text();
  return new NextResponse(text, { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") || "application/json" } });
}

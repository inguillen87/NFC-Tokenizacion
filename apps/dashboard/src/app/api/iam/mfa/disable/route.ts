import { NextResponse } from "next/server";
import { proxyToApi } from "../../../../../lib/api-proxy";

export async function POST() {
  const upstream = await proxyToApi("/auth/mfa/disable", { method: "POST" });
  const text = await upstream.text();
  return new NextResponse(text, { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") || "application/json" } });
}

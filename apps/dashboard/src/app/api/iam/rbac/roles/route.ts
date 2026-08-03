import { NextResponse } from "next/server";
import { proxyToApi } from "../../../../../lib/api-proxy";

export async function GET() {
  const upstream = await proxyToApi("/admin/rbac/roles");
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      "cache-control": "no-store",
      "content-type": upstream.headers.get("content-type") || "application/json",
    },
  });
}

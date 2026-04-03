import { NextResponse } from "next/server";
import { proxyToApi } from "../../../../../../lib/api-proxy";

export async function POST(_: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const upstream = await proxyToApi(`/admin/users/${userId}/mfa-reset`, { method: "POST" });
  const text = await upstream.text();
  return new NextResponse(text, { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") || "application/json" } });
}

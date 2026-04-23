export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { productUrls } from "@product/config";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const response = await fetch(`${productUrls.api}/sun/context`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  }).catch(() => null);

  if (!response) {
    return NextResponse.json({ ok: false, reason: "sun context upstream unavailable" }, { status: 503 });
  }

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: { "Content-Type": response.headers.get("content-type") || "application/json" },
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { productUrls } from "@product/config";

function clean(value: unknown) {
  return String(value || "").trim();
}

export async function POST(req: Request) {
  const adminKey = clean(process.env.ADMIN_API_KEY);
  if (!adminKey) {
    return NextResponse.json({ ok: false, reason: "ADMIN_API_KEY missing in web runtime" }, { status: 503 });
  }

  const body = await req.text();
  const response = await fetch(`${productUrls.api}/internal/demo/simulate-tap`, {
    method: "POST",
    headers: {
      "content-type": req.headers.get("content-type") || "application/json",
      Authorization: `Bearer ${adminKey}`,
    },
    body,
    cache: "no-store",
  });
  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") || "application/json" },
  });
}


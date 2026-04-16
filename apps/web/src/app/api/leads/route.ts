export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { productUrls } from "@product/config";

const API_BASE = productUrls.api;

export async function POST(req: Request) {
  const body = await req.text();

  try {
    let response = await fetch(`${API_BASE}/public/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store",
    });

    if (response.status === 404 || response.status === 405) {
      response = await fetch(`${API_BASE}/admin/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        cache: "no-store",
      });
    }

    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") || "application/json" },
    });
  } catch {
    return NextResponse.json({ ok: false, reason: "lead backend unavailable" }, { status: 503 });
  }
}

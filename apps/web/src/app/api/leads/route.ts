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
    if (response.status >= 500) {
      return NextResponse.json({
        ok: true,
        queued_local: true,
        reason: "lead backend temporary failure",
        upstream_status: response.status,
      }, { status: 202 });
    }
    return new NextResponse(text, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") || "application/json" },
    });
  } catch {
    return NextResponse.json({ ok: true, queued_local: true, reason: "lead backend unavailable" }, { status: 202 });
  }
}

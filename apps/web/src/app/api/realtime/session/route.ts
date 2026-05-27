export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { productUrls } from "@product/config";

const API_BASE = productUrls.api;

export async function POST(req: Request) {
  const body = await req.text();
  const locale = req.headers.get("x-nexid-locale") || "es-AR";

  try {
    const response = await fetch(`${API_BASE}/realtime/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/sdp",
        "X-Nexid-Locale": locale,
      },
      body,
      cache: "no-store",
    });

    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") || "application/sdp" },
    });
  } catch {
    return NextResponse.json({ error: "Realtime backend unavailable" }, { status: 503 });
  }
}

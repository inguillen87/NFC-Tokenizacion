export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { productUrls } from "@product/config";

function mapStatus(reason: string, ok: boolean) {
  const normalized = String(reason || "").toUpperCase();
  if (normalized.includes("UNKNOWN_BATCH")) return "UNKNOWN_BATCH";
  if (normalized.includes("NOT_REGISTERED")) return "NOT_REGISTERED";
  if (normalized.includes("NOT_ACTIVE")) return "NOT_ACTIVE";
  if (normalized.includes("REPLAY")) return "REPLAY_SUSPECT";
  if (normalized.includes("INVALID") || normalized.includes("CMAC")) return "INVALID";
  if (ok || normalized.includes("VALID") || normalized.includes("AUTH_OK")) return "VALID";
  return "UNKNOWN";
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const rawUrl = String(body.url || "").trim();
  if (!rawUrl) return NextResponse.json({ ok: false, reason: "url required" }, { status: 400 });

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid url" }, { status: 400 });
  }

  const pathOk = target.pathname.endsWith("/sun");
  if (!pathOk) return NextResponse.json({ ok: false, reason: "url must target /sun" }, { status: 400 });

  const apiOrigin = productUrls.api.replace(/\/$/, "");
  const forward = new URL(`${apiOrigin}/sun`);
  ["v", "bid", "picc_data", "enc", "cmac"].forEach((key) => {
    const value = target.searchParams.get(key);
    if (value) forward.searchParams.set(key, value);
  });

  try {
    const response = await fetch(forward.toString(), { cache: "no-store" });
    const text = await response.text();
    let data: Record<string, unknown> = {};
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      data = { raw: text };
    }

    const reason = String(data.reason || data.result || "");
    const humanStatus = mapStatus(reason, Boolean(data.ok));
    return NextResponse.json({
      ...data,
      upstream_status: response.status,
      human_status: humanStatus,
    }, { status: response.status });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      reason: error instanceof Error ? error.message : "sun validation fetch failed",
      human_status: "UNKNOWN",
    }, { status: 502 });
  }
}

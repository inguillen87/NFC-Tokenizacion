export const runtime = "nodejs";

import { NextResponse } from "next/server";

const VALID_INTENTS = new Set(["request-demo", "talk-to-sales", "become-reseller", "request-quote"]);

function mapIntent(intent: string) {
  if (intent === "request-demo") return "request_demo";
  if (intent === "talk-to-sales") return "talk_sales";
  if (intent === "become-reseller") return "become_reseller";
  if (intent === "request-quote") return "request_quote";
  return intent;
}

export async function POST(req: Request, { params }: { params: Promise<{ intent: string }> }) {
  const { intent } = await params;
  if (!VALID_INTENTS.has(intent)) {
    return NextResponse.json({ ok: false, reason: "unsupported intent" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const payload = {
    ...body,
    source: mapIntent(intent),
  };

  const response = await fetch(new URL("/api/leads", req.url), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  }).catch(() => null);

  if (!response) {
    return NextResponse.json({ ok: false, reason: "leads relay unavailable" }, { status: 503 });
  }

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") || "application/json" },
  });
}

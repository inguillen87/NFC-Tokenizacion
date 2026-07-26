import { NextResponse } from "next/server";
import { proxyToApi } from "../../../../../../lib/api-proxy";

const CONFIRMED_DELIVERY_STATES = new Set(["sent", "delivered", "queued"]);

function isCrossSiteMutation(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) return true;
  return req.headers.get("sec-fetch-site") === "cross-site";
}

export async function POST(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  if (isCrossSiteMutation(req)) {
    return NextResponse.json({ ok: false, reason: "cross_site_request_blocked" }, { status: 403, headers: { "cache-control": "no-store" } });
  }
  const { userId } = await params;
  const upstream = await proxyToApi(`/admin/users/${userId}/reset-password`, { method: "POST" });
  const payload = await upstream.json().catch(() => null) as Record<string, unknown> | null;
  if (!upstream.ok) {
    return NextResponse.json(
      { ok: false, reason: typeof payload?.reason === "string" ? payload.reason : "reset_request_failed" },
      { status: upstream.status, headers: { "cache-control": "no-store" } },
    );
  }

  const reportedDelivery = typeof payload?.deliveryStatus === "string"
    ? payload.deliveryStatus.toLowerCase()
    : typeof payload?.delivery_status === "string"
      ? payload.delivery_status.toLowerCase()
      : "not_configured";
  const deliveryStatus = CONFIRMED_DELIVERY_STATES.has(reportedDelivery) ? reportedDelivery : "not_configured";

  return NextResponse.json(
    { ok: true, deliveryStatus },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}

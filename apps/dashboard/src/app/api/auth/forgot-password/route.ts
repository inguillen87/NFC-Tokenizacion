import {
  consumeAuthRecoveryRateLimit,
  fetchAuthUpstream,
  noStoreJson,
  readBoundedJson,
  requireSameOrigin,
} from "../../../../lib/auth-recovery-proxy";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";

export async function POST(request: Request) {
  if (!requireSameOrigin(request)) return noStoreJson({ ok: false, reason: "same_origin_required" }, 403);
  if (process.env.AUTH_PASSWORD_RESET_DELIVERY_ENABLED !== "true") {
    return noStoreJson({ ok: false, reason: "reset_delivery_not_configured", deliveryStatus: "unavailable" }, 503);
  }

  const retryAfter = consumeAuthRecoveryRateLimit(request, "forgot-password", 5);
  if (retryAfter) {
    const response = noStoreJson({ ok: false, reason: "rate_limited" }, 429);
    response.headers.set("retry-after", String(retryAfter));
    return response;
  }

  const parsed = await readBoundedJson(request);
  if (!parsed.ok) return parsed.response;
  const email = String(parsed.value.email || "").trim().toLowerCase();
  if (email.length < 3 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return noStoreJson({ ok: false, reason: "invalid_email" }, 400);
  }

  try {
    const upstream = await fetchAuthUpstream(`${API_BASE}/auth/forgot-password`, { email });
    const data = await upstream.json().catch(() => null) as { deliveryStatus?: unknown; delivery?: { status?: unknown } } | null;
    const rawDeliveryStatus = String(data?.deliveryStatus || data?.delivery?.status || "").toLowerCase();
    const deliveryStatus = ["sent", "delivered", "queued"].includes(rawDeliveryStatus) ? rawDeliveryStatus : "unconfirmed";

    if (!upstream.ok) return noStoreJson({ ok: false, reason: "reset_request_failed", deliveryStatus: "unconfirmed" }, 502);
    return noStoreJson({ ok: true, deliveryStatus }, 202);
  } catch {
    return noStoreJson({ ok: false, reason: "reset_service_unavailable", deliveryStatus: "unconfirmed" }, 503);
  }
}

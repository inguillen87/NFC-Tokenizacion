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
    return noStoreJson({ ok: false, reason: "reset_delivery_not_configured" }, 503);
  }

  const retryAfter = consumeAuthRecoveryRateLimit(request, "reset-password", 8);
  if (retryAfter) {
    const response = noStoreJson({ ok: false, reason: "rate_limited" }, 429);
    response.headers.set("retry-after", String(retryAfter));
    return response;
  }

  const parsed = await readBoundedJson(request);
  if (!parsed.ok) return parsed.response;
  const token = String(parsed.value.token || "").trim();
  const password = String(parsed.value.password || "");
  if (!token || token.length > 2_048 || password.length < 8 || password.length > 256) {
    return noStoreJson({ ok: false, reason: "invalid_reset_request" }, 400);
  }

  try {
    const upstream = await fetchAuthUpstream(`${API_BASE}/auth/reset-password`, { token, password });
    if (!upstream.ok) return noStoreJson({ ok: false, reason: "reset_failed" }, 400);
    return noStoreJson({ ok: true }, 200);
  } catch {
    return noStoreJson({ ok: false, reason: "reset_service_unavailable" }, 503);
  }
}

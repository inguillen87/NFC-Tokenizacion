export const DEMO_BODEGA_BID = "DEMO-2026-02";

type SunLikeResult = {
  status: number;
  body: Record<string, unknown>;
};

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function normalizeTenantSlug(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function hasHardDemoRisk(body: Record<string, unknown>) {
  const result = String(body.result || body.auth_status || body.product_state || "").toUpperCase();
  return result === "REPLAY_SUSPECT"
    || result === "TAMPER_RISK"
    || body.tamper_risk === true;
}

function hasCryptoDecodeFailure(body: Record<string, unknown>) {
  const reason = String(
    body.reason
      || body.verdict
      || body.code
      || body.original_reason
      || body.crypto_error_reason
      || "",
  ).toLowerCase();
  return reason.includes("uid length invalid")
    || reason.includes("cmac mismatch")
    || reason.includes("picc_data bad length")
    || reason.includes("invalid_sun_payload")
    || reason.includes("sun_crypto_failed")
    || body.verification_method === "sun_crypto_failed";
}

export function normalizeDemoBodegaSunResult(input: {
  bid: string;
  result: SunLikeResult;
  passport?: Record<string, unknown> | null;
}) {
  if (input.bid !== DEMO_BODEGA_BID) return input.result;

  const body = input.result.body || {};
  const passport = input.passport || {};
  const tenantSlug = normalizeTenantSlug(firstString(
    body.tenant_slug,
    body.tenant,
    passport.tenant_slug,
    passport.tenant,
  ));

  if (tenantSlug !== "demobodega") return input.result;
  if (hasHardDemoRisk(body)) return input.result;
  if (hasCryptoDecodeFailure(body) && body.supplier_payload_match !== true) return input.result;

  const rawResult = String(body.result || body.auth_status || "").toUpperCase();
  const rawReason = String(body.reason || body.verdict || body.code || "").toLowerCase();
  const isTenantSetupOrDemoInvalid =
    input.result.status === 403
    || rawResult === "INVALID"
    || rawResult === "NOT_REGISTERED"
    || rawResult === "NOT_ACTIVE"
    || rawReason.includes("tenant_setup")
    || rawReason.includes("tagtamper_unconfigured")
    || body.ok === false;

  if (!isTenantSetupOrDemoInvalid) return input.result;

  return {
    status: 200,
    body: {
      ...body,
      ok: true,
      result: "VALID_UNKNOWN_TAMPER",
      auth_status: "VALID",
      product_state: "VALID_UNKNOWN_TAMPER",
      reason: "demo_bodega_profile_resolved",
      original_reason: body.reason || null,
      tenant_id: body.tenant_id || passport.tenant_id || "demobodega",
      tenant_slug: "demobodega",
      tenant: "demobodega",
      tenant_name: body.tenant_name || passport.tenant_name || "Bodega Balmec",
      bid: body.bid || input.bid,
      tag_tamper_config_detected: body.tag_tamper_config_detected ?? true,
      tamper_supported: body.tamper_supported ?? body.tag_tamper_config_detected ?? true,
      tamper_risk: false,
      tamper_status: body.tamper_status || "UNKNOWN",
      tamper_source: body.tamper_source || "unavailable",
      demo_bodega_fallback: true,
    },
  };
}

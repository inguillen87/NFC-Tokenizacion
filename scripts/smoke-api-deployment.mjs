const baseUrl = normalizeBaseUrl(process.argv[2]);
const edgeSecret = String(process.env.NEXID_EDGE_ORIGIN_SECRET || "").trim();
const runsThroughCloudflare = new URL(baseUrl).hostname === "api.nexid.lat";

if (!edgeSecret && !runsThroughCloudflare) {
  throw new Error("NEXID_EDGE_ORIGIN_SECRET is required unless the smoke targets api.nexid.lat through Cloudflare");
}

const protectedHeaders = edgeSecret
  ? { "x-nexid-edge-auth": edgeSecret }
  : {};

const [health, proof, ownership, invalidSdk] = await Promise.all([
  requestJson("/health"),
  requestJson("/public/proof/demo-cases", { headers: protectedHeaders }),
  requestJson("/public/polygon/ownership", { headers: protectedHeaders }),
  requestJson("/api/v1/sdk/verify", {
    method: "POST",
    headers: {
      ...protectedHeaders,
      "content-type": "application/json",
    },
    body: "{}",
  }),
]);

assert(health.status === 200 && health.body?.ok === true, "health endpoint is not ready");
assert(proof.status === 200 && proof.body?.ok === true, "public proof summary is unavailable");
assert(Array.isArray(proof.body?.cases) && proof.body.cases.length >= 3, "public proof cases are incomplete");
assert(proof.body?.testnet?.iota?.rpc_verified === true, "IOTA RPC evidence is not verified");
assert(proof.body?.testnet?.polygon?.rpc_verified === true, "Polygon RPC evidence is not verified");
assert(proof.body?.testnet?.polygon?.verification_state === "confirmed", "Polygon proof summary is not confirmed");
assert(ownership.status === 200 && ownership.body?.ok === true, "Polygon ownership certificate is unavailable");
assert(ownership.body?.verification_state === "confirmed", "Polygon ownership certificate is not confirmed");
assert(ownership.body?.wallet_control?.verified === true, "Polygon wallet-control evidence is not verified");
assert(ownership.body?.metadata?.document_ok === true, "Polygon metadata evidence is not verified");
assert(ownership.body?.mint?.events_match === true, "Polygon mint events do not match");
assert(invalidSdk.status === 401, `invalid SDK request returned HTTP ${invalidSdk.status}, expected 401`);
assert(invalidSdk.body?.reason === "sdk_api_key_required", "invalid SDK request did not fail with the expected contract");

console.log(JSON.stringify({
  ok: true,
  deployment: baseUrl,
  health: health.body?.ok,
  proof_cases: proof.body.cases.length,
  iota_rpc_verified: proof.body.testnet.iota.rpc_verified,
  iota_verified_anchors: proof.body.testnet.iota.verified_anchor_count,
  polygon_rpc_verified: proof.body.testnet.polygon.rpc_verified,
  polygon_state: proof.body.testnet.polygon.verification_state,
  polygon_token: proof.body.testnet.polygon.demo_token_id,
  polygon_wallet_control: ownership.body.wallet_control.verified,
  polygon_metadata: ownership.body.metadata.document_ok,
  invalid_sdk_status: invalidSdk.status,
}));

function normalizeBaseUrl(value) {
  const parsed = new URL(String(value || ""));
  if (parsed.protocol !== "https:") {
    throw new Error("Deployment URL must use HTTPS");
  }
  parsed.pathname = "";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

async function requestJson(pathname, init = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...init,
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  if (text.length > 2_000_000) {
    throw new Error(`${pathname} returned an oversized response`);
  }
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${pathname} did not return JSON (HTTP ${response.status})`);
  }
  return { status: response.status, body };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

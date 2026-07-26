import assert from "node:assert/strict";
import test from "node:test";
import { probePolygonExecutorReadiness } from "../src/lib/polygon-executor-readiness.ts";

const SECRET = "unit-test-executor-secret";
const CONTRACT = "0x0000000000000000000000000000000000000001";
const SIGNER = "0x0000000000000000000000000000000000000002";

const source = (overrides = {}) => ({
  NODE_ENV: "production",
  TOKENIZATION_EXECUTOR_URL: "https://executor.example.test/mint",
  TOKENIZATION_EXECUTOR_SECRET: SECRET,
  ...overrides,
});

function response(polygon, status = 200) {
  return new Response(JSON.stringify({
    ok: status === 200 && polygon.ok === true,
    capabilities: ["polygon"],
    chains: { polygon },
  }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const verifiedPolygon = {
  ok: true,
  live_verified: true,
  signer_mode: "kms_wrapped",
  chain_id: "80002",
  contract: { address: CONTRACT, deployed: true },
  signer: { address: SIGNER, authorized: true, balance_pol: 0.25 },
};

test("API probes the executor through a bounded authenticated scoped readiness request", async () => {
  let observed;
  const readiness = await probePolygonExecutorReadiness({
    source: source(),
    fetchImpl: async (url, init) => {
      observed = { url, init };
      return response(verifiedPolygon);
    },
  });

  assert.equal(observed.url, "https://executor.example.test/ready?capability=polygon");
  assert.equal(observed.init.method, "GET");
  assert.equal(observed.init.headers["x-tokenization-secret"], SECRET);
  assert.equal(observed.init.redirect, "error");
  assert.ok(observed.init.signal instanceof AbortSignal);
  assert.equal(readiness.liveVerified, true);
  assert.equal(readiness.reason, "live_verified");
  assert.equal(readiness.chainId, "80002");
  assert.equal(readiness.contractDeployed, true);
  assert.equal(readiness.signerAuthorized, true);
});

test("URL and secret configuration alone never pass Polygon readiness", async () => {
  const readiness = await probePolygonExecutorReadiness({
    source: source(),
    fetchImpl: async () => response({
      ...verifiedPolygon,
      ok: false,
      live_verified: false,
      contract: { address: CONTRACT, deployed: false },
    }, 503),
  });
  assert.equal(readiness.configured, true);
  assert.equal(readiness.liveVerified, false);
  assert.equal(readiness.reason, "executor_readiness_http_503");
});

test("production rejects insecure executor readiness URLs and missing secrets", async () => {
  const insecure = await probePolygonExecutorReadiness({ source: source({ TOKENIZATION_EXECUTOR_URL: "http://executor.example.test/mint" }) });
  assert.equal(insecure.liveVerified, false);
  assert.equal(insecure.reason, "executor_readiness_https_required");

  const missingSecret = await probePolygonExecutorReadiness({ source: source({ TOKENIZATION_EXECUTOR_SECRET: "" }) });
  assert.equal(missingSecret.liveVerified, false);
  assert.equal(missingSecret.reason, "executor_secret_missing");
});

test("a nominal 200 still fails closed if any chain evidence is absent", async () => {
  for (const polygon of [
    { ...verifiedPolygon, chain_id: "1" },
    { ...verifiedPolygon, contract: { address: CONTRACT, deployed: false } },
    { ...verifiedPolygon, signer: { address: SIGNER, authorized: false, balance_pol: 0.25 } },
    { ...verifiedPolygon, signer: { address: SIGNER, authorized: true, balance_pol: 0 } },
  ]) {
    const readiness = await probePolygonExecutorReadiness({ source: source(), fetchImpl: async () => response(polygon) });
    assert.equal(readiness.liveVerified, false);
    assert.equal(readiness.reason, "executor_readiness_unverified");
  }
});

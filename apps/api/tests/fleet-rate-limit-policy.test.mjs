import assert from "node:assert/strict";
import test from "node:test";
import { buildFleetRateLimitDecision, classifyFleetRateLimit } from "../src/lib/fleet-rate-limit-policy.ts";

test("fleet policy separates auth, proof writes, webhooks and public traffic", () => {
  assert.equal(classifyFleetRateLimit("/auth/login", "POST"), "auth");
  assert.equal(classifyFleetRateLimit("/api/session/login", "POST"), "auth");
  assert.equal(classifyFleetRateLimit("/consumer/auth/start", "POST"), "auth");
  assert.equal(classifyFleetRateLimit("/api/consumer/auth/verify", "POST"), "auth");
  assert.equal(classifyFleetRateLimit("/consumer/associate/start", "POST"), "auth");
  assert.equal(classifyFleetRateLimit("/consumer/associate/verify", "POST"), "auth");
  assert.equal(classifyFleetRateLimit("/sun/", "GET"), "nfc");
  assert.equal(classifyFleetRateLimit("/sun/simulate", "POST"), "proof_write");
  assert.equal(classifyFleetRateLimit("/admin/proof/anchor", "POST"), "proof_write");
  assert.equal(classifyFleetRateLimit("/admin/proof/events", "POST"), "proof_write");
  assert.equal(classifyFleetRateLimit("/admin/proof/anchors", "POST"), "proof_write");
  assert.equal(classifyFleetRateLimit("/admin/supplier-orders/00000000-0000-4000-8000-000000000000/purpose/classify-trial", "POST"), "proof_write");
  assert.equal(classifyFleetRateLimit("/admin/supplier-orders/00000000-0000-4000-8000-000000000000/lifecycle", "POST"), "proof_write");
  assert.equal(classifyFleetRateLimit("/admin/supplier-orders/00000000-0000-4000-8000-000000000000/sub-batches/BID-001/production-acceptance", "POST"), "proof_write");
  assert.equal(classifyFleetRateLimit("/admin/tenant-vault/acme/artifacts/00000000-0000-4000-8000-000000000000/download", "POST"), "proof_write");
  assert.equal(classifyFleetRateLimit("/admin/supplier-orders/00000000-0000-4000-8000-000000000000/sub-batches/BID-001/production-acceptance/sessions/00000000-0000-4000-8000-000000000001/finalize", "POST"), "proof_write");
  assert.equal(classifyFleetRateLimit("/public/cta/tokenize-request", "POST"), "proof_write");
  assert.equal(classifyFleetRateLimit("/marketplace/p2p/buy", "POST"), "proof_write");
  assert.equal(classifyFleetRateLimit("/assistant/chat", "POST"), "ai_expensive");
  assert.equal(classifyFleetRateLimit("/realtime/session", "POST"), "ai_expensive");
  assert.equal(classifyFleetRateLimit("/admin/campaigns/test-whatsapp", "POST"), "ai_expensive");
  assert.equal(classifyFleetRateLimit("/public/leads", "POST"), "public_write");
  assert.equal(classifyFleetRateLimit("/admin/leads", "POST"), "public_write");
  assert.equal(classifyFleetRateLimit("/admin/orders", "POST"), "public_write");
  assert.equal(classifyFleetRateLimit("/public/proof/verify", "GET"), "proof_write");
  assert.equal(classifyFleetRateLimit("/public/proof/decode", "POST"), "proof_write");
  assert.equal(classifyFleetRateLimit("/public/cta/register-warranty", "POST"), "proof_write");
  assert.equal(classifyFleetRateLimit("/public/cta/report-problem", "POST"), "proof_write");
  assert.equal(classifyFleetRateLimit("/public/cta/provenance", "GET"), "proof_write");
  assert.equal(classifyFleetRateLimit("/internal/webhooks/worker", "POST"), "webhook");
  assert.equal(classifyFleetRateLimit("/admin/webhooks/endpoint-id", "PATCH"), "webhook");
  assert.equal(classifyFleetRateLimit("/webhooks/deliver", "POST"), "webhook");
  assert.equal(classifyFleetRateLimit("/twilio/whatsapp/inbound", "POST"), "webhook");
  assert.equal(classifyFleetRateLimit("/_rate-limit/sdk-auth", "POST"), "sdk_auth");
  assert.equal(classifyFleetRateLimit("/api/v1/sdk/products/BID-1", "GET"), "sdk_read");
  assert.equal(classifyFleetRateLimit("/api/v1/sdk/offline-sync", "POST"), "sdk_write");
  assert.equal(classifyFleetRateLimit("/api/v1/sdk/epcis/capture", "POST"), "sdk_epcis_capture");
  assert.equal(classifyFleetRateLimit("/admin/risk-analytics", "GET"), "observability_read");
  assert.equal(classifyFleetRateLimit("/public/proof/x", "GET"), "public");
});

test("production acceptance mutations cannot bypass proof-write classification by path or method casing", () => {
  const routes = [
    "/admin/supplier-orders/00000000-0000-4000-8000-000000000000/sub-batches/BID-001/production-acceptance",
    "/admin/supplier-orders/00000000-0000-4000-8000-000000000000/sub-batches/BID-001/production-acceptance/plan/00000000-0000-4000-8000-000000000001/decision",
    "/admin/supplier-orders/00000000-0000-4000-8000-000000000000/sub-batches/BID-001/production-acceptance/sessions",
    "/admin/supplier-orders/00000000-0000-4000-8000-000000000000/sub-batches/BID-001/production-acceptance/sessions/00000000-0000-4000-8000-000000000002/finalize",
  ];

  for (const route of routes) {
    for (const method of ["POST", "post", "PoSt", "PATCH", "DELETE"]) {
      assert.equal(classifyFleetRateLimit(route, method), "proof_write", `${method} ${route}`);
    }
    assert.equal(classifyFleetRateLimit(route.toUpperCase(), "POST"), "proof_write");
    assert.equal(classifyFleetRateLimit(`${route}///`, "POST"), "proof_write");
    assert.equal(classifyFleetRateLimit(route, "GET"), "public");
    assert.equal(classifyFleetRateLimit(route, "get"), "public");
  }
});

test("EPCIS capture has a dedicated transaction-amplification limit", () => {
  const decision = buildFleetRateLimitDecision({
    pathname: "/api/v1/sdk/epcis/capture",
    method: "POST",
    tenantId: "tenant-acme",
    subjectId: "sdk-key:key-42",
    clientIp: "203.0.113.10",
  });
  assert.equal(decision.rateClass, "sdk_epcis_capture");
  assert.equal(decision.limit, 2);
  assert.equal(decision.windowSeconds, 60);
});

test("fleet keys bind tenant, subject and IP and expose stable gateway headers", () => {
  const decision = buildFleetRateLimitDecision({
    method: "POST", pathname: "/admin/proof/anchors", tenantId: "tenant-acme", subjectId: "user-42", clientIp: "203.0.113.10",
  });
  assert.equal(decision.key, "proof_write:tenant-acme:user-42:203.0.113.10");
  assert.equal(decision.headers["x-ratelimit-policy"], "nexid-proof_write");
  assert.equal(decision.headers["retry-after"], "60");
});

test("invalid user-controlled dimensions fail closed to non-global buckets", () => {
  const decision = buildFleetRateLimitDecision({ method: "POST", pathname: "/auth/login", tenantId: "../../global", subjectId: "a b", clientIp: "" });
  assert.match(decision.key, /tenant:unknown/);
  assert.match(decision.key, /subject:anonymous/);
  assert.match(decision.key, /ip:unknown/);
});

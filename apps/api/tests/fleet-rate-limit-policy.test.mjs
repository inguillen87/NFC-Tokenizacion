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
  assert.equal(classifyFleetRateLimit("/public/cta/tokenize-request", "POST"), "proof_write");
  assert.equal(classifyFleetRateLimit("/marketplace/p2p/buy", "POST"), "proof_write");
  assert.equal(classifyFleetRateLimit("/assistant/chat", "POST"), "ai_expensive");
  assert.equal(classifyFleetRateLimit("/realtime/session", "POST"), "ai_expensive");
  assert.equal(classifyFleetRateLimit("/public/leads", "POST"), "public_write");
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
  assert.equal(classifyFleetRateLimit("/public/proof/x", "GET"), "public");
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

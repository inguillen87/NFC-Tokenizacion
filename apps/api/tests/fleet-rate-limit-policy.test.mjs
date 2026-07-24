import assert from "node:assert/strict";
import test from "node:test";
import { buildFleetRateLimitDecision, classifyFleetRateLimit } from "../src/lib/fleet-rate-limit-policy.ts";

test("fleet policy separates auth, proof writes, webhooks and public traffic", () => {
  assert.equal(classifyFleetRateLimit("/auth/login", "POST"), "auth");
  assert.equal(classifyFleetRateLimit("/admin/proof/anchors", "POST"), "proof_write");
  assert.equal(classifyFleetRateLimit("/webhooks/deliver", "POST"), "webhook");
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

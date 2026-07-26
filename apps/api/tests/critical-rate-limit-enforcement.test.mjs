import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  adminCriticalRateLimitIdentity,
  enforceCriticalRateLimit,
  enforceSdkAuthenticationRateLimit,
  enforceSdkRateLimit,
  enforceWebhookAuthenticationRateLimit,
} from "../src/lib/critical-rate-limit.ts";
import { rateLimitBucketKey } from "../src/lib/sun-rate-limit-store.ts";

const TEST_PEPPER = "critical-rate-limit-test-pepper-0123456789abcdef";

function request(path, headers = {}) {
  return new Request(`https://api.nexid.lat${path}`, { method: "POST", headers });
}

test("critical limiter consumes the distributed proof budget with centralized request metadata", async () => {
  const captured = [];
  const response = await enforceCriticalRateLimit(
    request("/admin/proof/anchors"),
    { rateClass: "proof_write", tenantId: "tenant-acme", subjectId: "admin:tenant_admin" },
    {
      requestMeta: () => ({ ip: "203.0.113.8", userAgent: null, traceId: "trace-test" }),
      reserve: async (...args) => {
        captured.push(args);
        return { hits: 1, limited: false, retryAfterSeconds: 60 };
      },
    },
  );

  assert.equal(response, null);
  assert.deepEqual(captured, [
    [
      "fleet:proof_write:principal",
      "proof_write:all-tenants:admin:tenant_admin:203.0.113.8",
      60,
      60,
    ],
    [
      "fleet:proof_write:tenant",
      "proof_write:tenant-acme:admin:tenant_admin:203.0.113.8",
      60,
      60,
    ],
  ]);

  const persisted = rateLimitBucketKey(captured[1][0], captured[1][1], {
    NODE_ENV: "production",
    RATE_LIMIT_KEY_PEPPER: TEST_PEPPER,
  });
  assert.match(persisted.scopeKeyHash, /^[0-9a-f]{64}$/);
  assert.doesNotMatch(persisted.scopeKeyHash, /tenant-acme|203\.0\.113\.8|tenant_admin/);
});

test("exhausted critical budget returns a non-cacheable 429 with the database retry window", async () => {
  const response = await enforceCriticalRateLimit(
    request("/internal/webhooks/worker"),
    { rateClass: "webhook", tenantId: "platform", subjectId: "internal:webhook-worker" },
    {
      requestMeta: () => ({ ip: "198.51.100.7", userAgent: null, traceId: "trace-test" }),
      reserve: async () => ({ hits: 121, limited: true, retryAfterSeconds: 17 }),
    },
  );

  assert.equal(response?.status, 429);
  assert.equal(response?.headers.get("cache-control"), "no-store");
  assert.equal(response?.headers.get("retry-after"), "17");
  assert.equal(response?.headers.get("x-ratelimit-policy"), "nexid-webhook");
  assert.deepEqual(await response?.json(), { ok: false, reason: "rate_limited" });
});

test("critical store failures fail closed in production and may fail open only when explicitly allowed", async () => {
  const input = { rateClass: "proof_write", tenantId: "tenant-a", subjectId: "admin:legacy" };
  const dependencies = {
    requestMeta: () => ({ ip: null, userAgent: null, traceId: "trace-test" }),
    reserve: async () => { throw new Error("database unavailable"); },
  };

  const closed = await enforceCriticalRateLimit(request("/admin/proof/events"), input, {
    ...dependencies,
    failClosed: () => true,
  });
  assert.equal(closed?.status, 503);
  assert.equal(closed?.headers.get("cache-control"), "no-store");
  assert.equal(closed?.headers.get("retry-after"), "30");
  assert.deepEqual(await closed?.json(), { ok: false, reason: "rate_limit_unavailable" });

  const open = await enforceCriticalRateLimit(request("/admin/proof/events"), input, {
    ...dependencies,
    failClosed: () => false,
  });
  assert.equal(open, null);
});

test("policy drift fails closed instead of inheriting the public budget", async () => {
  let reservations = 0;
  const response = await enforceCriticalRateLimit(
    request("/unclassified-write"),
    { rateClass: "proof_write", tenantId: "tenant-a", subjectId: "admin:legacy" },
    { reserve: async () => { reservations += 1; return { hits: 1, limited: false, retryAfterSeconds: 60 }; } },
  );
  assert.equal(response?.status, 503);
  assert.equal(reservations, 0);
  assert.deepEqual(await response?.json(), { ok: false, reason: "rate_limit_policy_mismatch" });
});

test("webhook source guard consumes one durable source bucket before authentication", async () => {
  const captured = [];
  const response = await enforceWebhookAuthenticationRateLimit(
    request("/twilio/whatsapp/inbound"),
    {
      requestMeta: () => ({ ip: "203.0.113.90", userAgent: null, traceId: "trace-test" }),
      reserve: async (...args) => {
        captured.push(args);
        return { hits: 1, limited: false, retryAfterSeconds: 60 };
      },
    },
  );
  assert.equal(response, null);
  assert.deepEqual(captured, [[
    "fleet:webhook:source",
    "webhook:platform:webhook:unauthenticated:203.0.113.90",
    60,
    120,
  ]]);
});

test("SDK source and authenticated limits use distinct durable budgets", async () => {
  const sourceReservations = [];
  const sdkRequest = request("/api/v1/sdk/events");
  const sourceResponse = await enforceSdkAuthenticationRateLimit(sdkRequest, {
    requestMeta: () => ({ ip: "203.0.113.91", userAgent: null, traceId: "trace-test" }),
    reserve: async (...args) => {
      sourceReservations.push(args);
      return { hits: 1, limited: false, retryAfterSeconds: 60 };
    },
  });
  assert.equal(sourceResponse, null);
  assert.deepEqual(sourceReservations, [[
    "fleet:sdk_auth:source",
    "sdk_auth:platform:sdk:unauthenticated:203.0.113.91",
    60,
    1_200,
  ]]);

  const authenticatedReservations = [];
  const authenticatedResponse = await enforceSdkRateLimit(sdkRequest, {
    tenantId: "tenant-acme",
    apiKeyId: "key-42",
  }, {
    requestMeta: () => ({ ip: "203.0.113.91", userAgent: null, traceId: "trace-test" }),
    reserve: async (...args) => {
      authenticatedReservations.push(args);
      return { hits: 1, limited: false, retryAfterSeconds: 60 };
    },
  });
  assert.equal(authenticatedResponse, null);
  assert.equal(authenticatedReservations.length, 2);
  assert.equal(authenticatedReservations[0][0], "fleet:sdk_write:principal");
  assert.equal(authenticatedReservations[0][3], 600);
  assert.equal(authenticatedReservations[1][0], "fleet:sdk_write:tenant");
  assert.match(authenticatedReservations[1][1], /sdk_write:tenant-acme:sdk-key:key-42:203\.0\.113\.91/u);
});

test("admin credential bucket cannot be sharded by rotating tenant, scope or dashboard identity", async () => {
  const firstRequest = request("/admin/proof/anchors", {
    authorization: "Bearer stable-admin-credential",
    "x-nexid-tenant-slug": "tenant-a",
    "x-nexid-admin-scope": "tenant_admin",
    "x-dashboard-user": "rotate-me@example.com",
  });
  const rotatedRequest = request("/admin/proof/anchors", {
    authorization: "Bearer stable-admin-credential",
    "x-nexid-tenant-slug": "tenant-b",
    "x-nexid-admin-scope": "super_admin",
    "x-dashboard-user": "different@example.com",
  });
  const identity = adminCriticalRateLimitIdentity(firstRequest);
  const rotatedHeaders = adminCriticalRateLimitIdentity(rotatedRequest);
  const differentCredential = adminCriticalRateLimitIdentity(request("/admin/proof/anchors", {
    authorization: "Bearer another-admin-credential",
  }));
  assert.equal(identity.tenantId, "tenant-a");
  assert.match(identity.subjectId, /^admin-credential:[0-9a-f]{64}$/);
  assert.equal(identity.globalPrincipal, true);
  assert.equal(rotatedHeaders.subjectId, identity.subjectId);
  assert.notEqual(differentCredential.subjectId, identity.subjectId);
  assert.doesNotMatch(identity.subjectId, /stable-admin-credential|example\.com|tenant_admin/);

  const buckets = [];
  let requestIndex = 0;
  for (const candidate of [firstRequest, rotatedRequest]) {
    await enforceCriticalRateLimit(candidate, {
      rateClass: "proof_write",
      ...adminCriticalRateLimitIdentity(candidate),
    }, {
      requestMeta: () => ({
        ip: requestIndex++ === 0 ? "203.0.113.44" : "198.51.100.19",
        userAgent: null,
        traceId: "trace-test",
      }),
      reserve: async (scope, key) => {
        buckets.push({ scope, key });
        return { hits: 1, limited: false, retryAfterSeconds: 60 };
      },
    });
  }
  const principalKeys = buckets.filter((item) => item.scope.endsWith(":principal")).map((item) => item.key);
  const tenantKeys = buckets.filter((item) => item.scope.endsWith(":tenant")).map((item) => item.key);
  assert.equal(principalKeys[0], principalKeys[1]);
  assert.notEqual(tenantKeys[0], tenantKeys[1]);
});

const routes = [
  "../src/app/admin/proof/anchor/route.ts",
  "../src/app/admin/proof/anchors/route.ts",
  "../src/app/admin/proof/events/route.ts",
  "../src/app/admin/tokenization/requests/route.ts",
  "../src/app/admin/webhooks/route.ts",
  "../src/app/admin/webhooks/[id]/route.ts",
  "../src/app/internal/proof/anchors/worker/route.ts",
  "../src/app/internal/tokenization/worker/route.ts",
  "../src/app/internal/webhooks/worker/route.ts",
  "../src/app/public/cta/tokenize-request/route.ts",
  "../src/app/marketplace/p2p/buy/route.ts",
  "../src/app/twilio/whatsapp/inbound/route.ts",
  "../src/app/sun/simulate/route.ts",
];

test("every critical writer invokes the route-local distributed limiter", () => {
  for (const route of routes) {
    const source = readFileSync(new URL(route, import.meta.url), "utf8");
    assert.match(source, /enforceCriticalRateLimit\(req,/u, route);
  }
});

test("credentialed workers authenticate before limiting and before parsing or business DB work", () => {
  for (const route of routes.filter((item) => item.includes("/internal/"))) {
    const source = readFileSync(new URL(route, import.meta.url), "utf8");
    const authorized = route.endsWith("/webhooks/worker/route.ts")
      ? source.indexOf("authenticateWebhookWorkerRequest(req)")
      : source.indexOf("if (!isAuthorized(req))");
    const limited = source.indexOf("enforceCriticalRateLimit(req");
    const body = source.indexOf("req.json()", limited);
    assert.ok(authorized >= 0 && authorized < limited, `${route}: auth must precede limiter`);
    assert.ok(body < 0 || limited < body, `${route}: limiter must precede body parsing`);
  }
});

test("webhook worker authentication and delivery signing inputs remain untouched", () => {
  const worker = readFileSync(new URL("../src/app/internal/webhooks/worker/route.ts", import.meta.url), "utf8");
  const workerAuth = readFileSync(new URL("../src/lib/webhook-worker-auth.ts", import.meta.url), "utf8");
  const delivery = readFileSync(new URL("../src/lib/sdk-webhooks.ts", import.meta.url), "utf8");
  const signing = readFileSync(new URL("../src/lib/webhook-signing.ts", import.meta.url), "utf8");
  assert.match(worker, /authenticateWebhookWorkerRequest/);
  assert.match(workerAuth, /timingSafeEqual/);
  assert.match(workerAuth, /x-internal-webhook-key/);
  assert.match(workerAuth, /verifyIdToken/);
  assert.match(delivery, /createWebhookSignatureHeaders/);
  assert.match(signing, /x-nexid-signature/);
});

test("all credentialed workers use constant-time secret comparisons", () => {
  for (const route of routes.filter((item) => item.includes("/internal/"))) {
    const worker = readFileSync(new URL(route, import.meta.url), "utf8");
    const securitySource = route.endsWith("/webhooks/worker/route.ts")
      ? `${worker}\n${readFileSync(new URL("../src/lib/webhook-worker-auth.ts", import.meta.url), "utf8")}`
      : worker;
    assert.match(securitySource, /timingSafeEqual/, route);
    assert.doesNotMatch(securitySource, /provided\s*===\s*expected|expected\s*===\s*provided/, route);
  }
});

test("static worker and authenticated marketplace principals cannot evade limits by rotating source IP", () => {
  for (const route of routes.filter((item) => item.includes("/internal/") || item.includes("/marketplace/"))) {
    const source = readFileSync(new URL(route, import.meta.url), "utf8");
    assert.match(source, /globalPrincipal:\s*true/u, route);
  }
});

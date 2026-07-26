import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  NEXID_SDK_USER_AGENT,
  NEXID_SDK_VERSION,
  NexIdApiError,
  NexIdClient,
} from "../src/index.ts";

const baseConfig = {
  apiKey: "nxid_test_secret",
  tenantSlug: "tenant-a",
  retry: false,
};

test("SDK runtime identity stays aligned with the workspace package version", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(NEXID_SDK_VERSION, packageJson.version);
  assert.equal(NEXID_SDK_USER_AGENT, `${packageJson.name}/${packageJson.version}`);
});

test("sends server credentials, SDK identity and caller correlation without changing the existing route", async () => {
  let captured;
  const client = new NexIdClient({
    ...baseConfig,
    fetchImpl: async (url, init) => {
      captured = { url: String(url), init };
      return Response.json({ ok: true, eventId: "evt_1", eventType: "shipment.received" }, { status: 201 });
    },
  });

  await client.reportEvent(
    { eventType: "shipment.received", bid: "LOT-1" },
    { requestId: "erp-48392", idempotencyKey: "erp-48392" },
  );

  assert.equal(captured.url, "https://api.nexid.lat/api/v1/sdk/events");
  assert.equal(captured.init.method, "POST");
  assert.equal(captured.init.headers["x-nexid-api-key"], "nxid_test_secret");
  assert.equal(captured.init.headers["x-nexid-tenant-slug"], "tenant-a");
  assert.equal(captured.init.headers["x-nexid-trace-id"], "erp-48392");
  assert.equal(captured.init.headers["x-request-id"], "erp-48392");
  assert.equal(captured.init.headers["idempotency-key"], "erp-48392");
  assert.equal(captured.init.headers["user-agent"], NEXID_SDK_USER_AGENT);
  assert.equal(captured.init.headers["x-nexid-sdk-version"], NEXID_SDK_VERSION);
});

test("returns a typed HTTP error with status, reason, trace id, body and Retry-After", async () => {
  const client = new NexIdClient({
    ...baseConfig,
    fetchImpl: async () => Response.json(
      { ok: false, reason: "sdk_scope_denied", trace_id: "sdk_server_trace" },
      { status: 403, headers: { "retry-after": "7" } },
    ),
  });

  await assert.rejects(
    client.getProduct("LOT-1"),
    (error) => {
      assert.ok(error instanceof NexIdApiError);
      assert.equal(error.status, 403);
      assert.equal(error.reason, "sdk_scope_denied");
      assert.equal(error.traceId, "sdk_server_trace");
      assert.equal(error.retryAfter, 7);
      assert.deepEqual(error.body, { ok: false, reason: "sdk_scope_denied", trace_id: "sdk_server_trace" });
      return true;
    },
  );
});

test("retries only GET reads after 429 or 5xx and preserves one trace id", async () => {
  const calls = [];
  const responses = [
    new Response("busy", { status: 503, headers: { "retry-after": "0" } }),
    Response.json({ ok: false, reason: "rate_limited" }, { status: 429, headers: { "retry-after": "0" } }),
    Response.json({ ok: true, product: {}, tenant: { slug: "tenant-a" }, batch: {}, carrier: {}, stats: {}, tags: [] }),
  ];
  const client = new NexIdClient({
    ...baseConfig,
    retry: { maxRetries: 2, baseDelayMs: 0, maxDelayMs: 0 },
    fetchImpl: async (_url, init) => {
      calls.push(init.headers["x-nexid-trace-id"]);
      return responses.shift();
    },
  });

  const result = await client.getProduct("LOT-1");
  assert.equal(result.ok, true);
  assert.equal(calls.length, 3);
  assert.equal(new Set(calls).size, 1);
});

test("never retries a mutation by default, even after a retryable status", async () => {
  let calls = 0;
  const client = new NexIdClient({
    ...baseConfig,
    retry: { maxRetries: 5, baseDelayMs: 0, maxDelayMs: 0 },
    fetchImpl: async () => {
      calls += 1;
      return Response.json({ ok: false, reason: "upstream_unavailable" }, { status: 503 });
    },
  });

  await assert.rejects(client.reportEvent({ eventType: "shipment.received" }), NexIdApiError);
  assert.equal(calls, 1);
});

test("retries a supported mutation only with an explicit idempotency key", async () => {
  const calls = [];
  const responses = [
    Response.json({ ok: false, reason: "idempotency_store_unavailable" }, { status: 503, headers: { "retry-after": "0" } }),
    Response.json({ ok: true, eventId: "evt_1", eventType: "shipment.received" }, { status: 201 }),
  ];
  const client = new NexIdClient({
    ...baseConfig,
    retry: { maxRetries: 2, baseDelayMs: 0, maxDelayMs: 0 },
    fetchImpl: async (_url, init) => {
      calls.push({ key: init.headers["idempotency-key"], trace: init.headers["x-nexid-trace-id"] });
      return responses.shift();
    },
  });

  const response = await client.reportEvent(
    { eventType: "shipment.received" },
    { idempotencyKey: "erp-event-42", maxRetries: 1 },
  );
  assert.equal(response.eventId, "evt_1");
  assert.equal(calls.length, 2);
  assert.equal(new Set(calls.map((call) => call.key)).size, 1);
  assert.equal(new Set(calls.map((call) => call.trace)).size, 1);
});

test("does not retry logistics mutations because their server route is not yet idempotent", async () => {
  let calls = 0;
  const client = new NexIdClient({
    ...baseConfig,
    retry: { maxRetries: 2, baseDelayMs: 0, maxDelayMs: 0 },
    fetchImpl: async () => {
      calls += 1;
      return Response.json({ ok: false, reason: "unavailable" }, { status: 503 });
    },
  });

  await assert.rejects(
    client.applyDeliverySeal(
      { uidHex: "04AB", shipmentId: "shipment-1" },
      { idempotencyKey: "logistics-correlation-1", maxRetries: 2 },
    ),
    NexIdApiError,
  );
  assert.equal(calls, 1);
});

test("queries and reconciles idempotency by operation and original key", async () => {
  const calls = [];
  const client = new NexIdClient({
    ...baseConfig,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), method: init.method, key: init.headers["idempotency-key"] });
      return Response.json({
        ok: true,
        operation: "reportEvent",
        route: "/api/v1/sdk/events",
        state: "uncertain",
        operationCommitted: true,
        resourceId: "evt_1",
        traceId: "sdk_trace",
        responseStatus: 503,
        replayAvailable: true,
        reconciliationStatus: init.method === "POST" ? "confirmed" : "not_requested",
        reconciliationDetails: {},
        reconciledAt: init.method === "POST" ? "2026-07-26T00:00:02.000Z" : null,
        reconciled: init.method === "POST",
        createdAt: "2026-07-26T00:00:00.000Z",
        updatedAt: "2026-07-26T00:00:01.000Z",
        completedAt: "2026-07-26T00:00:01.000Z",
        expiresAt: "2026-08-02T00:00:00.000Z",
        nextAction: "do_not_use_a_new_key",
      });
    },
  });

  await client.getIdempotencyStatus("reportEvent", "erp/event:42");
  await client.reconcileIdempotency("reportEvent", "erp/event:42");
  assert.deepEqual(calls, [
    { url: "https://api.nexid.lat/api/v1/sdk/idempotency/status?operation=reportEvent", method: "GET", key: "erp/event:42" },
    { url: "https://api.nexid.lat/api/v1/sdk/idempotency/status?operation=reportEvent", method: "POST", key: "erp/event:42" },
  ]);
});

test("supports per-request timeout and caller abort with typed transport reasons", async () => {
  const hangingFetch = async (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
  });
  const client = new NexIdClient({ ...baseConfig, fetchImpl: hangingFetch });

  await assert.rejects(
    client.getProduct("LOT-1", { timeoutMs: 10, maxRetries: 0 }),
    (error) => error instanceof NexIdApiError && error.reason === "request_timeout" && error.status === 0,
  );

  const controller = new AbortController();
  controller.abort(new Error("caller cancelled"));
  await assert.rejects(
    client.getProduct("LOT-1", { signal: controller.signal }),
    (error) => error instanceof NexIdApiError && error.reason === "request_aborted",
  );
});

test("validates secrets, tenant scope, request metadata and base URLs before network I/O", async () => {
  assert.throws(() => new NexIdClient({ apiKey: "bad\nkey", tenantSlug: "tenant" }), /apiKey is invalid/);
  assert.throws(() => new NexIdClient({ apiKey: "key", tenantSlug: "../tenant" }), /tenantSlug/);
  assert.throws(
    () => new NexIdClient({ apiKey: "key", tenantSlug: "tenant", apiBaseUrl: "http://api.nexid.lat" }),
    /production apiBaseUrl must use HTTPS/,
  );
  assert.throws(
    () => new NexIdClient({ apiKey: "key", tenantSlug: "tenant", environment: "private", apiBaseUrl: "file:///tmp/api" }),
    /must use HTTP or HTTPS/,
  );

  const privateClient = new NexIdClient({
    apiKey: "key",
    tenantSlug: "TENANT-A",
    environment: "private",
    apiBaseUrl: "http://127.0.0.1:3003/",
    retry: false,
    fetchImpl: async (_url, init) => Response.json({ tenant: init.headers["x-nexid-tenant-slug"] }),
  });
  assert.deepEqual(await privateClient.getProduct("LOT-1"), { tenant: "tenant-a" });

  await assert.rejects(
    privateClient.getProduct("LOT-1", { requestId: "contains spaces" }),
    /requestId contains unsupported characters/,
  );
});

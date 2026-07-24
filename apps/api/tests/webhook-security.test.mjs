import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import test from "node:test";

import {
  WebhookDeliveryError,
  classifyWebhookStatus,
  isPublicWebhookAddress,
  normalizeWebhookUrl,
  postPinnedWebhook,
  resolveWebhookDestination,
} from "../src/lib/webhook-egress.ts";
import { deriveWebhookEventId, webhookRetryDecision } from "../src/lib/sdk-webhooks.ts";
import { POST as runWebhookWorker } from "../src/app/internal/webhooks/worker/route.ts";

function errorCode(error) {
  return error instanceof WebhookDeliveryError ? error.code : String(error);
}

test("webhook URL policy requires credential-free HTTPS on port 443", () => {
  for (const candidate of [
    "http://example.com/hook",
    "https://user:secret@example.com/hook",
    "https://example.com:8443/hook",
    "file:///etc/passwd",
    "not a URL",
  ]) {
    assert.throws(() => normalizeWebhookUrl(candidate), WebhookDeliveryError, candidate);
  }
  assert.equal(normalizeWebhookUrl("https://example.com/hook?x=1#ignored").toString(), "https://example.com/hook?x=1");
});

test("literal loopback, private, link-local, metadata, reserved and multicast addresses are blocked", async () => {
  const blocked = [
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "198.18.0.1",
    "224.0.0.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "ff02::1",
    "::ffff:127.0.0.1",
    "64:ff9b::7f00:1",
    "4000::1",
  ];
  for (const address of blocked) {
    assert.equal(isPublicWebhookAddress(address), false, address);
    const host = address.includes(":") ? `[${address}]` : address;
    await assert.rejects(resolveWebhookDestination(`https://${host}/hook`), (error) => errorCode(error) === "webhook_private_address_blocked", address);
  }
});

test("DNS resolution fails closed when any A or AAAA answer is private", async () => {
  const privateLookup = async () => [{ address: "10.20.30.40", family: 4 }];
  await assert.rejects(
    resolveWebhookDestination("https://hooks.example.com/event", { lookup: privateLookup }),
    (error) => errorCode(error) === "webhook_private_address_blocked",
  );

  const mixedLookup = async () => [
    { address: "93.184.216.34", family: 4 },
    { address: "fd00::123", family: 6 },
  ];
  await assert.rejects(
    resolveWebhookDestination("https://hooks.example.com/event", { lookup: mixedLookup }),
    (error) => errorCode(error) === "webhook_private_address_blocked",
  );
});

test("a public HTTPS endpoint resolves and returns the exact pinned socket address", async () => {
  const resolved = await resolveWebhookDestination("https://hooks.example.com/event", {
    lookup: async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
    ],
  });
  assert.equal(resolved.url.toString(), "https://hooks.example.com/event");
  assert.equal(resolved.address, "93.184.216.34");
  assert.equal(resolved.family, 4);
  assert.equal(resolved.addresses.length, 2);
});

function fakeHttpsRequest(statusCode, bodyChunks = []) {
  let calls = 0;
  let pinned = null;
  const request = (options, callback) => {
    calls += 1;
    options.lookup(options.hostname, {}, (_error, address, family) => {
      pinned = { address, family };
    });
    const req = new EventEmitter();
    req.destroy = (error) => {
      if (error) queueMicrotask(() => req.emit("error", error));
    };
    req.end = () => {
      queueMicrotask(() => {
        const response = Readable.from(bodyChunks);
        response.statusCode = statusCode;
        callback(response);
      });
    };
    return req;
  };
  return { request, calls: () => calls, pinned: () => pinned };
}

test("redirect responses are rejected without a second request and DNS is pinned", async () => {
  const fake = fakeHttpsRequest(302);
  await assert.rejects(
    postPinnedWebhook({
      url: new URL("https://hooks.example.com/original"),
      address: "93.184.216.34",
      family: 4,
      body: "{}",
      headers: { "content-type": "application/json" },
      timeoutMs: 1_000,
    }, { request: fake.request }),
    (error) => errorCode(error) === "webhook_redirect_not_allowed",
  );
  assert.equal(fake.calls(), 1);
  assert.deepEqual(fake.pinned(), { address: "93.184.216.34", family: 4 });
});

test("bounded response handling accepts 2xx and rejects oversized bodies", async () => {
  const success = fakeHttpsRequest(204);
  const result = await postPinnedWebhook({
    url: new URL("https://hooks.example.com/event"),
    address: "93.184.216.34",
    family: 4,
    body: "{}",
    headers: {},
    timeoutMs: 1_000,
  }, { request: success.request });
  assert.equal(result.statusCode, 204);

  const oversized = fakeHttpsRequest(200, [Buffer.alloc(2_048)]);
  await assert.rejects(
    postPinnedWebhook({
      url: new URL("https://hooks.example.com/event"),
      address: "93.184.216.34",
      family: 4,
      body: "{}",
      headers: {},
      timeoutMs: 1_000,
      maxResponseBytes: 1_024,
    }, { request: oversized.request }),
    (error) => errorCode(error) === "webhook_response_too_large",
  );
});

test("retry classification is bounded and terminal failures go to dead letter", () => {
  assert.deepEqual(classifyWebhookStatus(302), { ok: false, code: "webhook_redirect_not_allowed", retryable: false });
  assert.equal(classifyWebhookStatus(429).retryable, true);
  assert.equal(classifyWebhookStatus(503).retryable, true);
  assert.equal(classifyWebhookStatus(400).retryable, false);

  assert.deepEqual(webhookRetryDecision({ attemptCount: 1, retryable: true, maxAttempts: 3 }), {
    status: "retry_scheduled",
    delaySeconds: 60,
  });
  assert.deepEqual(webhookRetryDecision({ attemptCount: 3, retryable: true, maxAttempts: 3 }), {
    status: "dead_letter",
    delaySeconds: null,
  });
  assert.equal(webhookRetryDecision({ attemptCount: 1, retryable: false }).status, "dead_letter");
});

test("logical webhook IDs are stable per tenant/event key and isolated across scopes", () => {
  const input = { tenantId: "tenant-a", eventName: "sdk.verify", idempotencyKey: "scan-123" };
  const first = deriveWebhookEventId(input);
  assert.equal(deriveWebhookEventId(input), first);
  assert.notEqual(deriveWebhookEventId({ ...input, tenantId: "tenant-b" }), first);
  assert.notEqual(deriveWebhookEventId({ ...input, eventName: "sdk.claim.created" }), first);
  assert.match(first, /^evt_[a-f0-9]{64}$/);
});

test("the internal worker fails closed when its secret is absent or incorrect", async () => {
  const previous = process.env.INTERNAL_WEBHOOK_WORKER_KEY;
  try {
    delete process.env.INTERNAL_WEBHOOK_WORKER_KEY;
    const missing = await runWebhookWorker(new Request("https://api.nexid.lat/internal/webhooks/worker", { method: "POST", body: "{}" }));
    assert.equal(missing.status, 401);

    process.env.INTERNAL_WEBHOOK_WORKER_KEY = "correct-worker-secret";
    const wrong = await runWebhookWorker(new Request("https://api.nexid.lat/internal/webhooks/worker", {
      method: "POST",
      headers: { "x-internal-webhook-key": "wrong" },
      body: "{}",
    }));
    assert.equal(wrong.status, 401);
  } finally {
    if (previous === undefined) delete process.env.INTERNAL_WEBHOOK_WORKER_KEY;
    else process.env.INTERNAL_WEBHOOK_WORKER_KEY = previous;
  }
});

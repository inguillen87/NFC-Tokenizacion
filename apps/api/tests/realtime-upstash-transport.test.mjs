import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const upstashEnvKeys = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "REALTIME_UPSTASH_CHANNEL_PREFIX",
  "REALTIME_UPSTASH_ENVIRONMENT",
  "REALTIME_UPSTASH_HISTORY_MAX_LENGTH",
  "REALTIME_UPSTASH_HISTORY_TTL_SECONDS",
  "REALTIME_UPSTASH_REPLAY_LIMIT",
  "REALTIME_UPSTASH_REPLAY_WINDOW_SECONDS",
  "REALTIME_UPSTASH_HISTORY_READ_TIMEOUT_MS",
];

const testChannelPrefix = "nexid:rt:v1:test";

function upstashTestEnvironment(extra = {}) {
  return {
    VERCEL_ENV: "test",
    UPSTASH_REDIS_REST_URL: "https://redis.example.test",
    UPSTASH_REDIS_REST_TOKEN: "a-secure-token-with-enough-characters",
    REALTIME_UPSTASH_CHANNEL_PREFIX: testChannelPrefix,
    ...extra,
  };
}

function encodedStreamResponse(entries) {
  const base64 = (value) => Buffer.from(String(value), "utf8").toString("base64");
  return new Response(JSON.stringify({
    result: entries.map(([cursor, envelope, channel]) => [
      base64(cursor),
      [
        base64("data"), base64(JSON.stringify(envelope)),
        base64("event"), base64("nexid.event"),
        base64("channel"), base64(channel),
      ],
    ]),
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function realtimeEnvelope(id, sequence) {
  return {
    source: "test-source",
    dispatch_id: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    payload: { event_type: "tap.created", id },
  };
}

function restoreEnvironment(snapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

test("Upstash configuration is explicit, HTTPS-only and bounded", async () => {
  const { resolveUpstashRealtimeConfig } = await import("../src/lib/realtime-upstash-transport.ts");

  assert.equal(resolveUpstashRealtimeConfig({}), null);
  assert.equal(resolveUpstashRealtimeConfig({
    UPSTASH_REDIS_REST_URL: "http://redis.example.test",
    UPSTASH_REDIS_REST_TOKEN: "a-secure-token-with-enough-characters",
    REALTIME_UPSTASH_CHANNEL_PREFIX: testChannelPrefix,
    VERCEL_ENV: "test",
  }), null);
  assert.equal(resolveUpstashRealtimeConfig({
    ...upstashTestEnvironment(),
    REALTIME_UPSTASH_CHANNEL_PREFIX: "nexid:rt:v1:production",
  }), null, "the namespace must match the current deployment environment");
  assert.equal(resolveUpstashRealtimeConfig({
    ...upstashTestEnvironment(),
    REALTIME_UPSTASH_CHANNEL_PREFIX: "",
  }), null, "the broker namespace must never fall back to a shared default");

  const config = resolveUpstashRealtimeConfig(upstashTestEnvironment({
    UPSTASH_REDIS_REST_URL: "https://redis.example.test/?secret=must-not-be-retained",
    REALTIME_UPSTASH_HISTORY_MAX_LENGTH: "999999",
    REALTIME_UPSTASH_HISTORY_TTL_SECONDS: "999999",
    REALTIME_UPSTASH_REPLAY_LIMIT: "999999",
    REALTIME_UPSTASH_REPLAY_WINDOW_SECONDS: "999999",
    REALTIME_UPSTASH_HISTORY_READ_TIMEOUT_MS: "999999",
  }));

  assert.ok(config);
  assert.equal(config.url, "https://redis.example.test");
  assert.equal(config.channelPrefix, testChannelPrefix);
  assert.equal(config.historyMaxLength, 1_000);
  assert.equal(config.historyTtlSeconds, 86_400);
  assert.equal(config.replayLimit, 1_000);
  assert.equal(config.replayWindowMs, 86_400_000);
  assert.equal(config.historyReadTimeoutMs, 10_000);
});

test("publish channels isolate tenants and require explicit global intent", async () => {
  const {
    resolveUpstashPublishChannels,
    resolveUpstashRealtimeChannel,
  } = await import("../src/lib/realtime-upstash-transport.ts");

  assert.deepEqual(
    resolveUpstashPublishChannels({ tenant_slug: "Bodega-Balmec", tenant_id: "tenant-1" }, undefined, testChannelPrefix),
    [`${testChannelPrefix}:tenant:bodega-balmec`, `${testChannelPrefix}:global`],
  );
  assert.deepEqual(
    resolveUpstashPublishChannels({}, { global: true }, testChannelPrefix),
    [`${testChannelPrefix}:global`],
  );
  assert.equal(resolveUpstashPublishChannels({}), null);
  assert.equal(resolveUpstashPublishChannels({ tenant_id: "tenant-1" }, { global: true }, testChannelPrefix), null);
  assert.equal(resolveUpstashPublishChannels({ tenant_slug: "bodega-balmec" }, { global: true }, testChannelPrefix), null);
  assert.equal(
    resolveUpstashPublishChannels(
      { tenant_slug: "bodega-balmec" },
      { tenantSlug: "different-tenant" },
      testChannelPrefix,
    ),
    null,
  );
  assert.equal(resolveUpstashPublishChannels({ tenant_slug: "../global" }, undefined, testChannelPrefix), null);
  assert.equal(
    resolveUpstashRealtimeChannel({ tenantSlug: "Bodega-Balmec" }, testChannelPrefix),
    `${testChannelPrefix}:tenant:bodega-balmec`,
  );
  assert.equal(resolveUpstashRealtimeChannel({ global: true }, testChannelPrefix), `${testChannelPrefix}:global`);
});

test("Redis Stream cursors are constrained by format and replay age", async () => {
  const { resolveBoundedUpstashCursor } = await import("../src/lib/realtime-upstash-transport.ts");
  const now = 2_000_000_000_000;

  assert.equal(resolveBoundedUpstashCursor(`${now - 1_000}-0`, now, 300_000), `${now - 1_000}-0`);
  assert.equal(resolveBoundedUpstashCursor(`${now - 300_001}-0`, now, 300_000), null);
  assert.equal(resolveBoundedUpstashCursor(`${now + 60_001}-0`, now, 300_000), null);
  assert.equal(resolveBoundedUpstashCursor("not-a-cursor", now, 300_000), null);
});

test("REALTIME_MODE=upstash fails closed without server credentials or scope", async () => {
  const snapshot = Object.fromEntries([
    "REALTIME_MODE",
    ...upstashEnvKeys,
  ].map((key) => [key, process.env[key]]));
  process.env.REALTIME_MODE = "upstash";
  for (const key of upstashEnvKeys) delete process.env[key];

  try {
    const {
      publishRealtimeEvent,
      resolveRealtimeMode,
      subscribeRealtimeEvent,
    } = await import("../src/lib/realtime-events.ts");

    assert.equal(resolveRealtimeMode(), "upstash");
    assert.equal(resolveRealtimeMode({ REALTIME_MODE: "unsupported" }), null);

    const missingCredentials = await subscribeRealtimeEvent(() => {}, {
      tenantSlug: "bodega-balmec",
    });
    assert.equal(missingCredentials.distributedReady, false);
    assert.equal(missingCredentials.transport, "upstash");

    const missingScope = await subscribeRealtimeEvent(() => {});
    assert.equal(missingScope.distributedReady, false);
    assert.equal(missingScope.transport, "upstash");

    const publish = await publishRealtimeEvent({
      event_type: "tap.created",
      tenant_slug: "bodega-balmec",
    });
    assert.equal(publish.distributed, false);
    assert.equal(publish.transport, "upstash");
  } finally {
    restoreEnvironment(snapshot);
  }
});

test("managed subscription buffers replay races and resets when its upstream SSE ends", async () => {
  const {
    resolveUpstashRealtimeConfig,
    subscribeUpstashRealtimeEvent,
  } = await import("../src/lib/realtime-upstash-transport.ts");
  const config = resolveUpstashRealtimeConfig(upstashTestEnvironment({
    UPSTASH_REDIS_REST_URL: "https://redis-subscription-test.example.test",
    REALTIME_UPSTASH_REPLAY_WINDOW_SECONDS: "300",
  }));
  assert.ok(config);

  const channel = `${testChannelPrefix}:tenant:bodega-balmec`;
  const now = Date.now();
  const historyCursor = `${now - 2_000}-0`;
  const liveCursor = `${now - 1_000}-0`;
  const historyEnvelope = {
    source: "history-source",
    dispatch_id: "11111111-1111-4111-8111-111111111111",
    payload: { event_type: "tap.created", id: "history-event" },
  };
  const liveEnvelope = {
    source: "live-source",
    dispatch_id: "22222222-2222-4222-8222-222222222222",
    payload: { event_type: "tap.created", id: "live-event" },
  };
  const encoder = new TextEncoder();
  let upstreamController;
  let historyRequestBody;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (request, init = {}) => {
    const url = String(request);
    if (url.includes("/subscribe/")) {
      return new Response(new ReadableStream({
        start(controller) {
          upstreamController = controller;
          controller.enqueue(encoder.encode(`data: subscribe,${channel},1\n\n`));
        },
      }), {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    }

    historyRequestBody = JSON.parse(String(init.body || "[]"));
    upstreamController.enqueue(encoder.encode(`data: message,${channel},${JSON.stringify({
      data: liveEnvelope,
      event: "nexid.event",
      channel,
      id: liveCursor,
    })}\n\n`));
    await new Promise((resolve) => setTimeout(resolve, 0));
    return encodedStreamResponse([[historyCursor, historyEnvelope, channel]]);
  };

  const received = [];
  let resolveReset;
  const reset = new Promise((resolve) => { resolveReset = resolve; });
  try {
    const subscription = await subscribeUpstashRealtimeEvent({
      config,
      channel,
      onData: (message) => received.push(message),
      onTransportReset: resolveReset,
    });

    assert.equal(subscription.replay, "bounded_history");
    assert.equal(historyRequestBody[0], "XREVRANGE");
    assert.equal(historyRequestBody[1], channel);
    assert.deepEqual(received.map((message) => message.envelope.payload.id), [
      "history-event",
      "live-event",
    ]);

    upstreamController.close();
    let resetTimeout;
    try {
      await Promise.race([
        reset,
        new Promise((_, reject) => {
          resetTimeout = setTimeout(() => reject(new Error("reset timeout")), 1_000);
        }),
      ]);
    } finally {
      clearTimeout(resetTimeout);
    }
    subscription.unsubscribe();
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a first connection replays the newest bounded history in causal order", async () => {
  const {
    resolveUpstashRealtimeConfig,
    subscribeUpstashRealtimeEvent,
  } = await import("../src/lib/realtime-upstash-transport.ts");
  const config = resolveUpstashRealtimeConfig(upstashTestEnvironment({
    UPSTASH_REDIS_REST_URL: "https://redis-recent-history.example.test",
    REALTIME_UPSTASH_REPLAY_LIMIT: "2",
  }));
  assert.ok(config);

  const channel = `${testChannelPrefix}:tenant:recent-history`;
  const now = Date.now();
  const olderCursor = `${now - 2_000}-0`;
  const newestCursor = `${now - 1_000}-0`;
  const encoder = new TextEncoder();
  const originalFetch = globalThis.fetch;
  let historyRequestBody;
  globalThis.fetch = async (request, init = {}) => {
    if (String(request).includes("/subscribe/")) {
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: subscribe,${channel},1\n\n`));
        },
      }), { status: 200, headers: { "content-type": "text/event-stream" } });
    }
    historyRequestBody = JSON.parse(String(init.body || "[]"));
    // Redis returns XREVRANGE newest-first; the transport must restore causal order.
    return encodedStreamResponse([
      [newestCursor, realtimeEnvelope("newest", 2), channel],
      [olderCursor, realtimeEnvelope("older", 1), channel],
    ]);
  };

  const received = [];
  try {
    const subscription = await subscribeUpstashRealtimeEvent({
      config,
      channel,
      onData: (message) => received.push(message),
      onTransportReset: () => assert.fail("transport must stay connected"),
    });
    assert.equal(subscription.replay, "bounded_history");
    assert.equal(subscription.replayResetReason, null);
    assert.equal(historyRequestBody[0], "XREVRANGE");
    assert.equal(historyRequestBody.at(-1), 2);
    assert.deepEqual(received.map((message) => message.envelope.payload.id), ["older", "newest"]);
    subscription.unsubscribe();
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a replay backlog beyond the hard limit resets the cursor and recovers the newest slice", async () => {
  const {
    resolveUpstashRealtimeConfig,
    subscribeUpstashRealtimeEvent,
  } = await import("../src/lib/realtime-upstash-transport.ts");
  const config = resolveUpstashRealtimeConfig(upstashTestEnvironment({
    UPSTASH_REDIS_REST_URL: "https://redis-truncated-replay.example.test",
    REALTIME_UPSTASH_REPLAY_LIMIT: "2",
  }));
  assert.ok(config);

  const channel = `${testChannelPrefix}:tenant:truncated-replay`;
  const now = Date.now();
  const cursor = `${now - 5_000}-0`;
  const firstCursor = `${now - 4_000}-0`;
  const secondCursor = `${now - 3_000}-0`;
  const newestCursor = `${now - 2_000}-0`;
  const encoder = new TextEncoder();
  const originalFetch = globalThis.fetch;
  const historyCommands = [];
  globalThis.fetch = async (request, init = {}) => {
    if (String(request).includes("/subscribe/")) {
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: subscribe,${channel},1\n\n`));
        },
      }), { status: 200, headers: { "content-type": "text/event-stream" } });
    }
    const command = JSON.parse(String(init.body || "[]"));
    historyCommands.push(command);
    if (command[0] === "XRANGE") {
      return encodedStreamResponse([
        [cursor, realtimeEnvelope("cursor", 10), channel],
        [firstCursor, realtimeEnvelope("first", 11), channel],
        [secondCursor, realtimeEnvelope("second", 12), channel],
        [newestCursor, realtimeEnvelope("newest", 13), channel],
      ]);
    }
    return encodedStreamResponse([
      [newestCursor, realtimeEnvelope("newest", 13), channel],
      [secondCursor, realtimeEnvelope("second", 12), channel],
    ]);
  };

  const received = [];
  try {
    const subscription = await subscribeUpstashRealtimeEvent({
      config,
      channel,
      after: cursor,
      onData: (message) => received.push(message),
      onTransportReset: () => assert.fail("transport must stay connected"),
    });
    assert.equal(subscription.replay, "snapshot_reset");
    assert.equal(subscription.replayResetReason, "replay_backlog_truncated");
    assert.equal(historyCommands[0][0], "XRANGE");
    assert.equal(historyCommands[0].at(-1), 4, "cursor + replay limit + one truncation sentinel");
    assert.equal(historyCommands[1][0], "XREVRANGE");
    assert.deepEqual(received.map((message) => message.envelope.payload.id), ["second", "newest"]);
    subscription.unsubscribe();
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a cursor trimmed out of Redis resets instead of reconnecting in a replay loop", async () => {
  const {
    resolveUpstashRealtimeConfig,
    subscribeUpstashRealtimeEvent,
  } = await import("../src/lib/realtime-upstash-transport.ts");
  const config = resolveUpstashRealtimeConfig(upstashTestEnvironment({
    UPSTASH_REDIS_REST_URL: "https://redis-missing-cursor.example.test",
    REALTIME_UPSTASH_REPLAY_LIMIT: "2",
  }));
  assert.ok(config);

  const channel = `${testChannelPrefix}:tenant:missing-cursor`;
  const now = Date.now();
  const requestedCursor = `${now - 5_000}-0`;
  const olderAvailableCursor = `${now - 4_000}-0`;
  const newestAvailableCursor = `${now - 3_000}-0`;
  const encoder = new TextEncoder();
  const originalFetch = globalThis.fetch;
  const historyCommands = [];
  globalThis.fetch = async (request, init = {}) => {
    if (String(request).includes("/subscribe/")) {
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: subscribe,${channel},1\n\n`));
        },
      }), { status: 200, headers: { "content-type": "text/event-stream" } });
    }
    const command = JSON.parse(String(init.body || "[]"));
    historyCommands.push(command);
    if (command[0] === "XRANGE") {
      // Redis returns the next retained item because the requested cursor was
      // already trimmed. Treating this as a valid replay would hide the gap.
      return encodedStreamResponse([
        [olderAvailableCursor, realtimeEnvelope("available-after-gap", 20), channel],
      ]);
    }
    return encodedStreamResponse([
      [newestAvailableCursor, realtimeEnvelope("newest", 21), channel],
      [olderAvailableCursor, realtimeEnvelope("older", 20), channel],
    ]);
  };

  const received = [];
  try {
    const subscription = await subscribeUpstashRealtimeEvent({
      config,
      channel,
      after: requestedCursor,
      onData: (message) => received.push(message),
      onTransportReset: () => assert.fail("transport must stay connected"),
    });
    assert.equal(subscription.replay, "snapshot_reset");
    assert.equal(subscription.replayResetReason, "cursor_unavailable");
    assert.deepEqual(historyCommands.map((command) => command[0]), ["XRANGE", "XREVRANGE"]);
    assert.deepEqual(received.map((message) => message.envelope.payload.id), ["older", "newest"]);
    subscription.unsubscribe();
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("history replay is abortable by both its hard timeout and the caller request", async () => {
  const {
    resolveUpstashRealtimeConfig,
    subscribeUpstashRealtimeEvent,
  } = await import("../src/lib/realtime-upstash-transport.ts");
  const channel = `${testChannelPrefix}:tenant:history-timeout`;
  const encoder = new TextEncoder();
  const originalFetch = globalThis.fetch;

  const runAbortedReplay = async ({ timeoutMs, abortCaller }) => {
    const config = resolveUpstashRealtimeConfig(upstashTestEnvironment({
      UPSTASH_REDIS_REST_URL: `https://redis-history-abort-${timeoutMs}.example.test`,
      REALTIME_UPSTASH_HISTORY_READ_TIMEOUT_MS: String(timeoutMs),
    }));
    assert.ok(config);
    const requestAbortController = new AbortController();
    let historySignal;
    globalThis.fetch = async (request, init = {}) => {
      if (String(request).includes("/subscribe/")) {
        return new Response(new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(`data: subscribe,${channel},1\n\n`));
          },
        }), { status: 200, headers: { "content-type": "text/event-stream" } });
      }
      historySignal = init.signal;
      if (abortCaller) queueMicrotask(() => requestAbortController.abort("request_closed"));
      return new Promise((_, reject) => {
        const rejectAbort = () => reject(new Error("fetch_aborted"));
        if (init.signal?.aborted) rejectAbort();
        else init.signal?.addEventListener("abort", rejectAbort, { once: true });
      });
    };

    const subscription = subscribeUpstashRealtimeEvent({
      config,
      channel,
      signal: requestAbortController.signal,
      onData: () => {},
      onTransportReset: () => {},
    });
    await assert.rejects(
      subscription,
      abortCaller ? /upstash_realtime_subscriber_unavailable/ : /upstash_realtime_history_timeout/,
    );
    assert.ok(historySignal instanceof AbortSignal);
    assert.equal(historySignal.aborted, true);
  };

  try {
    await runAbortedReplay({ timeoutMs: 100, abortCaller: false });
    await runAbortedReplay({ timeoutMs: 10_000, abortCaller: true });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("request abort cancels an Upstash subscription before its handshake completes", async () => {
  const {
    resolveUpstashRealtimeConfig,
    subscribeUpstashRealtimeEvent,
  } = await import("../src/lib/realtime-upstash-transport.ts");
  const config = resolveUpstashRealtimeConfig(upstashTestEnvironment({
    UPSTASH_REDIS_REST_URL: "https://redis-subscribe-abort.example.test",
  }));
  assert.ok(config);

  const originalFetch = globalThis.fetch;
  const requestAbortController = new AbortController();
  let subscribeSignal;
  globalThis.fetch = async (_request, init = {}) => {
    subscribeSignal = init.signal;
    return new Promise((_, reject) => {
      const rejectAbort = () => reject(new Error("fetch_aborted"));
      if (init.signal?.aborted) rejectAbort();
      else init.signal?.addEventListener("abort", rejectAbort, { once: true });
    });
  };

  try {
    const subscription = subscribeUpstashRealtimeEvent({
      config,
      channel: `${testChannelPrefix}:tenant:subscribe-abort`,
      signal: requestAbortController.signal,
      onData: () => {},
      onTransportReset: () => {},
    });
    requestAbortController.abort("request_closed");
    await assert.rejects(subscription, /upstash_realtime_subscriber_unavailable/);
    assert.ok(subscribeSignal instanceof AbortSignal);
    assert.equal(subscribeSignal.aborted, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("implementation uses the official managed transport without exposing credentials", async () => {
  const source = await readFile(new URL("../src/lib/realtime-upstash-transport.ts", import.meta.url), "utf8");
  const eventsSource = await readFile(new URL("../src/lib/realtime-events.ts", import.meta.url), "utf8");
  const envExample = await readFile(new URL("../.env.example", import.meta.url), "utf8");
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

  assert.equal(packageJson.dependencies["@upstash/realtime"], "1.1.0");
  assert.equal(packageJson.dependencies["@upstash/redis"], "1.38.3");
  assert.match(source, /new Realtime\(/);
  assert.match(source, /\.emit\("nexid\.event", envelope\)/);
  assert.match(source, /\/subscribe\/\$\{encodeURIComponent\(input\.channel\)\}/);
  assert.match(source, /if \(chunk\.done\) \{\s*failTransport\(\)/);
  assert.match(source, /if \(!abortController\.signal\.aborted\) failTransport\(\)/);
  assert.match(source, /onTransportReset: \(\) => void/);
  assert.match(source, /history: \{/);
  assert.match(source, /maxLength: config\.historyMaxLength/);
  assert.match(source, /expireAfterSecs: config\.historyTtlSeconds/);
  assert.match(eventsSource, /resolveUpstashPublishChannels/);
  assert.match(eventsSource, /resolveUpstashRealtimeChannel\(scope, channelPrefix\)/);
  assert.doesNotMatch(source, /console\.(?:log|info|warn|error)/);
  assert.match(envExample, /^UPSTASH_REDIS_REST_URL=$/m);
  assert.match(envExample, /^UPSTASH_REDIS_REST_TOKEN=$/m);
  assert.doesNotMatch(envExample, /NEXT_PUBLIC_UPSTASH_REDIS/);
});

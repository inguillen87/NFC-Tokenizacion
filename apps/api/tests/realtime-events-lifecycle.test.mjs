import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("memory realtime subscriptions deliver locally and unsubscribe cleanly", async () => {
  const previousMode = process.env.REALTIME_MODE;
  process.env.REALTIME_MODE = "memory";
  const { onRealtimeEvent, publishRealtimeEvent } = await import("../src/lib/realtime-events.ts");
  const received = [];
  const unsubscribe = onRealtimeEvent((event) => received.push(event));

  await publishRealtimeEvent({ id: "evt-1", result: "VALID" });
  assert.equal(received.length, 1);
  assert.equal(received[0].id, "evt-1");
  assert.equal(received[0].result, "VALID");
  assert.match(received[0].realtime_delivery_id, /^rtv1_[a-f0-9]{32}$/);

  unsubscribe();
  await publishRealtimeEvent({ id: "evt-2", result: "TAMPER" });
  assert.equal(received.length, 1);

  if (previousMode === undefined) delete process.env.REALTIME_MODE;
  else process.env.REALTIME_MODE = previousMode;
});

test("production requires an explicit safe realtime mode and gates the PostgreSQL pilot", async () => {
  const {
    isRealtimeProductionEnvironment,
    resolveRealtimeMode,
  } = await import("../src/lib/realtime-events.ts");

  assert.equal(isRealtimeProductionEnvironment({ VERCEL_ENV: "production", NODE_ENV: "development" }), true);
  assert.equal(isRealtimeProductionEnvironment({ VERCEL_ENV: "preview", NODE_ENV: "production" }), false);
  assert.equal(isRealtimeProductionEnvironment({ NODE_ENV: "production" }), true);
  assert.equal(resolveRealtimeMode({ VERCEL_ENV: "production" }), null);
  assert.equal(resolveRealtimeMode({ VERCEL_ENV: "production", REALTIME_MODE: "memory" }), null);
  assert.equal(resolveRealtimeMode({ VERCEL_ENV: "production", REALTIME_MODE: "upstash" }), "upstash");
  assert.equal(resolveRealtimeMode({ VERCEL_ENV: "production", REALTIME_MODE: "postgres" }), null);
  assert.equal(resolveRealtimeMode({
    VERCEL_ENV: "production",
    REALTIME_MODE: "postgres",
    REALTIME_POSTGRES_PILOT_ENABLED: "true",
  }), "postgres");
  assert.equal(resolveRealtimeMode({ REALTIME_MODE: "memory" }), "memory");
  assert.equal(resolveRealtimeMode({}), "postgres");
});

test("the production mode and PostgreSQL pilot gate are explicit in operator configuration", async () => {
  const [envExample, runbook] = await Promise.all([
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
    readFile(new URL("../../../docs/realtime-tenant-stream.md", import.meta.url), "utf8"),
  ]);
  assert.match(envExample, /^REALTIME_MODE=upstash$/m);
  assert.match(envExample, /^REALTIME_POSTGRES_PILOT_ENABLED=false$/m);
  assert.match(runbook, /REALTIME_MODE=postgres\s+REALTIME_POSTGRES_PILOT_ENABLED=true/);
  assert.match(runbook, /`REALTIME_MODE` ausente, inválido o igual a `memory` deja el transporte indisponible/);
});

test("postgres realtime lifecycle handles socket failures instead of crashing the process", async () => {
  const source = await readFile(new URL("../src/lib/realtime-events.ts", import.meta.url), "utf8");

  assert.match(source, /resolveRealtimeListenerDatabaseUrl/);
  assert.match(source, /resolveRealtimePublisherDatabaseUrl/);
  assert.match(source, /pool\.on\("error", \(\) => resetPgListener/);
  assert.match(source, /client\.on\("error", onDisconnect\)/);
  assert.match(source, /client\.on\("end", onDisconnect\)/);
  assert.match(source, /schedulePgListenerReconnect/);
  assert.match(source, /emitTransportReset\("listener_disconnected"\)/);
  assert.match(source, /if \(store\.emitter\.listenerCount\("event"\) === 0\) stopPgListener\(\)/);
  assert.match(source, /store\.publishPool = null/);
  assert.match(source, /attempt \+ 1 < PUBLISH_MAX_ATTEMPTS/);
  assert.match(source, /PUBLISH_RETRY_BASE_MS \* \(2 \*\* attempt\)/);
  assert.match(source, /resolveJitteredRealtimeDelay/);
  assert.match(source, /emitTransportReset\("publisher_unavailable"\)/);
  assert.match(source, /export async function subscribeRealtimeEvent/);
  assert.match(source, /const distributedReady = mode === "postgres" \? await startPgListener\(\) : true/);
  assert.match(source, /distributed: await publishDistributed\(safePayload\)/);
  assert.doesNotMatch(source, /void pool\.query\("SELECT pg_notify/);
});

test("readiness-aware subscription is ready in memory mode and fails closed without a distributed URL", async () => {
  const previousMode = process.env.REALTIME_MODE;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousUnpooledUrl = process.env.DATABASE_URL_UNPOOLED;
  const previousNonPoolingUrl = process.env.POSTGRES_URL_NON_POOLING;
  const { subscribeRealtimeEvent, publishRealtimeEvent } = await import("../src/lib/realtime-events.ts");

  process.env.REALTIME_MODE = "memory";
  const received = [];
  const memorySubscription = await subscribeRealtimeEvent((event) => received.push(event));
  assert.equal(memorySubscription.distributedReady, true);
  assert.equal(memorySubscription.transport, "memory");
  await publishRealtimeEvent({ id: "evt-memory", result: "VALID" });
  assert.equal(received.some((event) => event.id === "evt-memory"), true);
  memorySubscription.unsubscribe();

  process.env.REALTIME_MODE = "postgres";
  delete process.env.DATABASE_URL;
  delete process.env.DATABASE_URL_UNPOOLED;
  delete process.env.POSTGRES_URL_NON_POOLING;
  const unavailableSubscription = await subscribeRealtimeEvent(() => {});
  assert.equal(unavailableSubscription.distributedReady, false);
  assert.equal(unavailableSubscription.transport, "postgres");
  unavailableSubscription.unsubscribe();

  if (previousMode === undefined) delete process.env.REALTIME_MODE;
  else process.env.REALTIME_MODE = previousMode;
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
  if (previousUnpooledUrl === undefined) delete process.env.DATABASE_URL_UNPOOLED;
  else process.env.DATABASE_URL_UNPOOLED = previousUnpooledUrl;
  if (previousNonPoolingUrl === undefined) delete process.env.POSTGRES_URL_NON_POOLING;
  else process.env.POSTGRES_URL_NON_POOLING = previousNonPoolingUrl;
});

test("LISTEN prefers an unpooled URL while pg_notify may use the pooled runtime URL", async () => {
  const source = await readFile(new URL("../src/lib/realtime-events.ts", import.meta.url), "utf8");
  const {
    resolveRealtimeListenerDatabaseUrl,
    resolveRealtimePublisherDatabaseUrl,
  } = await import("../src/lib/realtime-events.ts");
  const listenerResolver = source.match(/export function resolveRealtimeListenerDatabaseUrl[\s\S]*?\n\}/)?.[0] || "";
  const publisherResolver = source.match(/export function resolveRealtimePublisherDatabaseUrl[\s\S]*?\n\}/)?.[0] || "";
  const env = {
    DATABASE_URL: "postgresql://runtime:secret@ep-example-pooler.example.test/nexid",
    DATABASE_URL_UNPOOLED: "postgresql://listener:secret@ep-example.example.test/nexid",
    POSTGRES_URL_NON_POOLING: "postgresql://fallback:secret@ep-fallback.example.test/nexid",
  };

  assert.equal(resolveRealtimeListenerDatabaseUrl(env), env.DATABASE_URL_UNPOOLED);
  assert.equal(resolveRealtimePublisherDatabaseUrl(env), env.DATABASE_URL);
  assert.ok(listenerResolver.indexOf("env.DATABASE_URL_UNPOOLED") < listenerResolver.indexOf("env.POSTGRES_URL_NON_POOLING"));
  assert.ok(listenerResolver.indexOf("env.POSTGRES_URL_NON_POOLING") < listenerResolver.indexOf("env.DATABASE_URL,"));
  assert.match(listenerResolver, /!isPooledPostgresConnection\(connection\.candidate\)/);
  assert.ok(publisherResolver.indexOf("env.DATABASE_URL,") < publisherResolver.indexOf("env.DATABASE_URL_UNPOOLED"));
  assert.match(source, /const url = resolveRealtimeListenerDatabaseUrl\(\)/);
  assert.match(source, /const connectionString = resolveRealtimePublisherDatabaseUrl\(\)/);
});

test("LISTEN rejects pooled-only configuration and accepts direct fallbacks", async () => {
  const source = await readFile(new URL("../src/lib/realtime-events.ts", import.meta.url), "utf8");
  const { resolveRealtimeListenerDatabaseUrl } = await import("../src/lib/realtime-events.ts");
  const pooled = "postgresql://runtime:secret@ep-example-pooler.example.test/nexid?pgbouncer=true";
  const nonPooling = "postgresql://listener:secret@ep-direct.example.test/nexid";

  assert.equal(resolveRealtimeListenerDatabaseUrl({ DATABASE_URL: pooled }), null);
  assert.equal(resolveRealtimeListenerDatabaseUrl({ DATABASE_URL_UNPOOLED: pooled, POSTGRES_URL_NON_POOLING: nonPooling }), nonPooling);
  assert.equal(resolveRealtimeListenerDatabaseUrl({ DATABASE_URL: nonPooling }), nonPooling);
  assert.equal(resolveRealtimeListenerDatabaseUrl({ DATABASE_URL: "https://example.test/not-postgres" }), null);
  assert.match(source, /parsed\.protocol !== "postgres:" && parsed\.protocol !== "postgresql:"/);
  assert.match(source, /\(\^\|\[\.-\]\)\(pooler\|pgbouncer\)\(\[\.-\]\|\$\)/);
  assert.match(source, /searchParams\.get\("pool_mode"\)/);
  assert.match(source, /searchParams\.get\("pgbouncer"\)/);
});

test("source never passes database URLs into realtime operational logs", async () => {
  const source = await readFile(new URL("../src/lib/realtime-events.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /console\.(?:info|warn|error)\([^\n]*(?:DATABASE_URL|connectionString|url)/i);
});


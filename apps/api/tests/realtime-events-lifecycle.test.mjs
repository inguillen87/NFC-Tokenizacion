import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("memory realtime subscriptions deliver locally and unsubscribe cleanly", async () => {
  const previousMode = process.env.REALTIME_MODE;
  process.env.REALTIME_MODE = "memory";
  const { onRealtimeEvent, publishRealtimeEvent } = await import("../src/lib/realtime-events.ts");
  const received = [];
  const unsubscribe = onRealtimeEvent((event) => received.push(event));

  publishRealtimeEvent({ id: "evt-1", result: "VALID" });
  assert.deepEqual(received, [{ id: "evt-1", result: "VALID" }]);

  unsubscribe();
  publishRealtimeEvent({ id: "evt-2", result: "TAMPER" });
  assert.equal(received.length, 1);

  if (previousMode === undefined) delete process.env.REALTIME_MODE;
  else process.env.REALTIME_MODE = previousMode;
});

test("postgres realtime lifecycle handles socket failures instead of crashing the process", async () => {
  const source = await readFile(new URL("../src/lib/realtime-events.ts", import.meta.url), "utf8");

  assert.match(source, /resolveRealtimeListenerDatabaseUrl/);
  assert.match(source, /resolveRealtimePublisherDatabaseUrl/);
  assert.match(source, /pool\.on\("error", \(\) => resetPgListener/);
  assert.match(source, /client\.on\("error", onDisconnect\)/);
  assert.match(source, /client\.on\("end", onDisconnect\)/);
  assert.match(source, /schedulePgListenerReconnect/);
  assert.match(source, /if \(emitter\.listenerCount\("event"\) === 0\) stopPgListener\(\)/);
  assert.match(source, /store\.publishPool = null/);
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


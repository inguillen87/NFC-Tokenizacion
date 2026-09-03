import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "@neondatabase/serverless";

type RealtimeEventPayload = {
  id?: string | number;
  event_type?: string;
  alert_id?: string;
  tenant_id?: string;
  severity?: string;
  type?: string;
  tenant_slug?: string;
  batch_id?: string;
  tag_id?: string;
  product_name?: string;
  bid?: string;
  uid_hex?: string;
  verdict?: string;
  risk_level?: string;
  result?: string;
  reason?: string | null;
  city?: string | null;
  country_code?: string | null;
  lat?: number | null;
  lng?: number | null;
  location_source?: string | null;
  location_accuracy_m?: number | null;
  device_label?: string | null;
  device_os?: string | null;
  device_type?: string | null;
  source?: string | null;
  created_at?: string;
  meta?: Record<string, unknown> | null;
  trace_id?: string | null;
  lead_id?: string;
  ticket_id?: string;
  incident_id?: string;
  incident_event_id?: string;
  incident_status?: string;
  incident_severity?: string;
  incident_title?: string;
  sdk_event_id?: string;
  contact?: string;
  company?: string;
  status?: string;
  title?: string;
  external_event_type?: string;
};

const BUS_KEY = "__nexid_realtime_bus__";
const INSTANCE_ID = randomUUID();
const CHANNEL = String(process.env.REALTIME_PG_CHANNEL || "nexid_events").replace(/[^a-zA-Z0-9_]/g, "");

type BusStore = {
  emitter: EventEmitter;
  started: boolean;
  startPromise: Promise<void> | null;
  pool: Pool | null;
  listenerClient: PoolClient | null;
  publishPool: Pool | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
};

function getStore(): BusStore {
  const scope = globalThis as typeof globalThis & { [BUS_KEY]?: BusStore };
  if (!scope[BUS_KEY]) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(400);
    scope[BUS_KEY] = {
      emitter,
      started: false,
      startPromise: null,
      pool: null,
      listenerClient: null,
      publishPool: null,
      reconnectTimer: null,
    };
  }
  return scope[BUS_KEY]!;
}

function postgresRealtimeEnabled() {
  const mode = String(process.env.REALTIME_MODE || "postgres").trim().toLowerCase();
  return mode !== "memory";
}

function validPostgresConnectionString(value: unknown) {
  const candidate = String(value || "").trim();
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") return null;
    return { candidate, parsed };
  } catch {
    return null;
  }
}

function isPooledPostgresConnection(value: string) {
  const connection = validPostgresConnectionString(value);
  if (!connection) return true;
  const host = connection.parsed.hostname.toLowerCase();
  const poolMode = String(connection.parsed.searchParams.get("pool_mode") || "").toLowerCase();
  const pgbouncer = String(connection.parsed.searchParams.get("pgbouncer") || "").toLowerCase();
  return /(^|[.-])(pooler|pgbouncer)([.-]|$)/.test(host)
    || Boolean(poolMode)
    || pgbouncer === "true"
    || pgbouncer === "1";
}

/**
 * LISTEN needs a session-affine PostgreSQL connection. Prefer the explicit
 * Neon/Vercel unpooled variables and only accept DATABASE_URL as a fallback
 * when its host and options are recognisably direct.
 */
export function resolveRealtimeListenerDatabaseUrl(env: NodeJS.ProcessEnv = process.env) {
  const candidates = [
    env.DATABASE_URL_UNPOOLED,
    env.POSTGRES_URL_NON_POOLING,
    env.DATABASE_URL,
  ];
  for (const candidate of candidates) {
    const connection = validPostgresConnectionString(candidate);
    if (connection && !isPooledPostgresConnection(connection.candidate)) return connection.candidate;
  }
  return null;
}

/** pg_notify is a single statement, so the regular pooled runtime URL is safe. */
export function resolveRealtimePublisherDatabaseUrl(env: NodeJS.ProcessEnv = process.env) {
  for (const candidate of [env.DATABASE_URL, env.DATABASE_URL_UNPOOLED, env.POSTGRES_URL_NON_POOLING]) {
    const connection = validPostgresConnectionString(candidate);
    if (connection) return connection.candidate;
  }
  return null;
}

function listenerEnabled() {
  return postgresRealtimeEnabled() && Boolean(resolveRealtimeListenerDatabaseUrl());
}

function publisherEnabled() {
  return postgresRealtimeEnabled() && Boolean(resolveRealtimePublisherDatabaseUrl());
}

function safeParse(data: string): { source?: string; payload?: RealtimeEventPayload } | null {
  try {
    const parsed = JSON.parse(data) as { source?: string; payload?: RealtimeEventPayload };
    return parsed;
  } catch {
    return null;
  }
}

function schedulePgListenerReconnect() {
  const store = getStore();
  if (
    store.reconnectTimer
    || !listenerEnabled()
    || store.emitter.listenerCount("event") === 0
  ) return;

  store.reconnectTimer = setTimeout(() => {
    store.reconnectTimer = null;
    void startPgListener();
  }, 1_000);
  store.reconnectTimer.unref?.();
}

function resetPgListener(pool: Pool, client: PoolClient | null, reconnect: boolean) {
  const store = getStore();
  if (store.pool !== pool) return;

  store.started = false;
  store.pool = null;
  store.listenerClient = null;
  try {
    client?.release(true);
  } catch {
    // The socket may already be closed.
  }
  void pool.end().catch(() => null);
  if (reconnect) schedulePgListenerReconnect();
}

function stopPgListener() {
  const store = getStore();
  if (store.reconnectTimer) {
    clearTimeout(store.reconnectTimer);
    store.reconnectTimer = null;
  }
  const pool = store.pool;
  const client = store.listenerClient;
  store.started = false;
  store.pool = null;
  store.listenerClient = null;
  if (!pool) return;
  try {
    client?.release(true);
  } catch {
    // The socket may already be closed.
  }
  void pool.end().catch(() => null);
}

async function startPgListener() {
  const store = getStore();
  if (store.started || store.startPromise || !listenerEnabled()) return;

  store.startPromise = (async () => {
    const url = resolveRealtimeListenerDatabaseUrl();
    if (!url) return;
    const pool = new Pool({ connectionString: url, max: 1 });
    store.pool = pool;
    pool.on("error", () => resetPgListener(pool, store.listenerClient, true));
    const client = await pool.connect();
    store.listenerClient = client;
    const onDisconnect = () => resetPgListener(pool, client, true);
    client.on("error", onDisconnect);
    client.on("end", onDisconnect);
    client.on("notification", (msg) => {
      if (msg.channel !== CHANNEL || !msg.payload) return;
      const envelope = safeParse(msg.payload);
      if (!envelope?.payload) return;
      if (envelope.source && envelope.source === INSTANCE_ID) return;
      store.emitter.emit("event", envelope.payload);
    });
    await client.query(`LISTEN "${CHANNEL}"`);
    store.started = true;
    if (store.emitter.listenerCount("event") === 0) stopPgListener();
  })().catch(() => {
    const pool = store.pool;
    const client = store.listenerClient;
    store.started = false;
    store.pool = null;
    store.listenerClient = null;
    try {
      client?.release(true);
    } catch {
      // The socket may already be closed.
    }
    if (pool) void pool.end().catch(() => null);
    schedulePgListenerReconnect();
  }).finally(() => {
    store.startPromise = null;
  });

  await store.startPromise;
}

function publishDistributed(payload: RealtimeEventPayload) {
  if (!publisherEnabled()) return;
  const envelope = JSON.stringify({ source: INSTANCE_ID, payload });
  // notify through postgres to reach all running instances without polling
  const store = getStore();
  if (!store.publishPool) {
    const connectionString = resolveRealtimePublisherDatabaseUrl();
    if (!connectionString) return;
    const pool = new Pool({ connectionString, max: 1 });
    pool.on("error", () => {
      if (store.publishPool !== pool) return;
      store.publishPool = null;
      void pool.end().catch(() => null);
    });
    store.publishPool = pool;
  }
  const pool = store.publishPool;
  void pool.query("SELECT pg_notify($1, $2)", [CHANNEL, envelope]).catch(() => {
    if (store.publishPool === pool) store.publishPool = null;
    void pool.end().catch(() => null);
  });
}

export function publishRealtimeEvent(payload: RealtimeEventPayload) {
  const store = getStore();
  store.emitter.emit("event", payload);
  publishDistributed(payload);
}

export function onRealtimeEvent(listener: (payload: RealtimeEventPayload) => void) {
  const emitter = getStore().emitter;
  void startPgListener();
  emitter.on("event", listener);
  return () => {
    emitter.off("event", listener);
    if (emitter.listenerCount("event") === 0) stopPgListener();
  };
}

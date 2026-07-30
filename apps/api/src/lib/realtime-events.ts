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

function distributedEnabled() {
  const mode = String(process.env.REALTIME_MODE || "postgres").trim().toLowerCase();
  return mode !== "memory" && Boolean(process.env.DATABASE_URL);
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
    || !distributedEnabled()
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
  if (store.started || store.startPromise || !distributedEnabled()) return;

  store.startPromise = (async () => {
    const url = process.env.DATABASE_URL;
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
  if (!distributedEnabled()) return;
  const envelope = JSON.stringify({ source: INSTANCE_ID, payload });
  // notify through postgres to reach all running instances without polling
  const store = getStore();
  if (!store.publishPool) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL!, max: 1 });
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

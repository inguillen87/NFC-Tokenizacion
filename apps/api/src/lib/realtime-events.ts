import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { Pool } from "@neondatabase/serverless";

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
  source?: string | null;
  created_at?: string;
  trace_id?: string | null;
  lead_id?: string;
  contact?: string;
  company?: string;
  status?: string;
  title?: string;
};

const BUS_KEY = "__nexid_realtime_bus__";
const INSTANCE_ID = randomUUID();
const CHANNEL = String(process.env.REALTIME_PG_CHANNEL || "nexid_events").replace(/[^a-zA-Z0-9_]/g, "");

type BusStore = {
  emitter: EventEmitter;
  started: boolean;
  startPromise: Promise<void> | null;
  pool: Pool | null;
  publishPool: Pool | null;
};

function getStore(): BusStore {
  const scope = globalThis as typeof globalThis & { [BUS_KEY]?: BusStore };
  if (!scope[BUS_KEY]) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(400);
    scope[BUS_KEY] = { emitter, started: false, startPromise: null, pool: null, publishPool: null };
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

async function startPgListener() {
  const store = getStore();
  if (store.started || store.startPromise || !distributedEnabled()) return;

  store.startPromise = (async () => {
    const url = process.env.DATABASE_URL;
    if (!url) return;
    const pool = new Pool({ connectionString: url, max: 1 });
    store.pool = pool;
    const client = await pool.connect();
    client.on("notification", (msg) => {
      if (msg.channel !== CHANNEL || !msg.payload) return;
      const envelope = safeParse(msg.payload);
      if (!envelope?.payload) return;
      if (envelope.source && envelope.source === INSTANCE_ID) return;
      store.emitter.emit("event", envelope.payload);
    });
    await client.query(`LISTEN "${CHANNEL}"`);
    store.started = true;
  })().catch(() => {
    store.started = false;
    store.pool = null;
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
  store.publishPool = store.publishPool || new Pool({ connectionString: process.env.DATABASE_URL!, max: 1 });
  void store.publishPool.query("SELECT pg_notify($1, $2)", [CHANNEL, envelope]).catch(() => null);
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
  return () => emitter.off("event", listener);
}

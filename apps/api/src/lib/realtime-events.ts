import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "@neondatabase/serverless";
import { minimizeRealtimePayloadForBroker } from "./realtime-broker-payload";
import { resolveJitteredRealtimeDelay } from "./realtime-timing";
import {
  resolveUpstashChannelPrefix,
  resolveUpstashPublishChannels,
  resolveUpstashRealtimeChannel,
  resolveUpstashRealtimeConfig,
  publishUpstashRealtimeEvent,
  subscribeUpstashRealtimeEvent,
  type RealtimePublishScope,
  type RealtimeSubscriptionScope,
} from "./realtime-upstash-transport";

export type RealtimeEventPayload = {
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
  verdict?: string;
  risk_level?: string;
  cmac_ok?: boolean | null;
  allowlisted?: boolean | null;
  known_actor_count?: number;
  known_actor?: boolean;
  commercial_consent_granted?: boolean;
  commercial_consent_channels?: string[];
  result?: string;
  reason?: string | null;
  city?: string | null;
  country_code?: string | null;
  lat?: number | null;
  lng?: number | null;
  location_source?: string | null;
  location_accuracy_m?: number | null;
  device_os?: string | null;
  device_type?: string | null;
  source?: string | null;
  created_at?: string;
  realtime_cursor?: string;
  realtime_channel?: string;
  lead_id?: string;
  ticket_id?: string;
  incident_id?: string;
  incident_event_id?: string;
  incident_status?: string;
  incident_severity?: string;
  event_id?: string;
  sdk_event_id?: string;
  status?: string;
  external_event_type?: string;
  realtime_delivery_id?: string;
  tap_projection?: Record<string, unknown>;
};

const BUS_KEY = "__nexid_realtime_bus__";
const INSTANCE_ID = randomUUID();
const CHANNEL = String(process.env.REALTIME_PG_CHANNEL || "nexid_events").replace(/[^a-zA-Z0-9_]/g, "");
const PUBLISH_MAX_ATTEMPTS = 3;
const PUBLISH_RETRY_BASE_MS = 250;
const LOCAL_UPSTASH_EVENT_PREFIX = "upstash:";

export type RealtimeMode = "memory" | "postgres" | "upstash";

export function isRealtimeProductionEnvironment(env: NodeJS.ProcessEnv = process.env) {
  const vercelEnvironment = String(env.VERCEL_ENV || "").trim().toLowerCase();
  if (vercelEnvironment) return vercelEnvironment === "production";
  return String(env.NODE_ENV || "").trim().toLowerCase() === "production";
}

export function resolveRealtimeMode(env: NodeJS.ProcessEnv = process.env): RealtimeMode | null {
  const configuredMode = String(env.REALTIME_MODE || "").trim().toLowerCase();
  const production = isRealtimeProductionEnvironment(env);
  if (production && !configuredMode) return null;
  const mode = configuredMode || "postgres";
  if (mode !== "memory" && mode !== "postgres" && mode !== "upstash") return null;
  if (production && mode === "memory") return null;
  if (
    production
    && mode === "postgres"
    && String(env.REALTIME_POSTGRES_PILOT_ENABLED || "").trim().toLowerCase() !== "true"
  ) return null;
  return mode;
}

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
  return resolveRealtimeMode() === "postgres";
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

function brokerSafePayload(value: unknown): RealtimeEventPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return minimizeRealtimePayloadForBroker(value as Record<string, unknown>) as RealtimeEventPayload;
}

function safeParse(data: string): { source?: string; payload?: RealtimeEventPayload } | null {
  try {
    const parsed = JSON.parse(data) as { source?: string; payload?: RealtimeEventPayload };
    const payload = brokerSafePayload(parsed.payload);
    return payload ? { source: parsed.source, payload } : null;
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
  }, resolveJitteredRealtimeDelay(1_000, { jitterRatio: 0.2 }));
  store.reconnectTimer.unref?.();
}

function localUpstashEventName(channel: string) {
  return `${LOCAL_UPSTASH_EVENT_PREFIX}${channel}`;
}

function transportResetPayload(reason: "listener_disconnected" | "publisher_unavailable") {
  return {
    event_type: "realtime.transport_reset",
    reason,
    source: "system",
    created_at: new Date().toISOString(),
  } satisfies RealtimeEventPayload;
}

function emitTransportReset(
  reason: "listener_disconnected" | "publisher_unavailable",
  upstashChannels?: string[],
) {
  const store = getStore();
  const payload = transportResetPayload(reason);
  if (upstashChannels?.length) {
    for (const channel of upstashChannels) {
      store.emitter.emit(localUpstashEventName(channel), payload);
    }
    return;
  }
  store.emitter.emit("event", payload);
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
  if (reconnect) {
    emitTransportReset("listener_disconnected");
    schedulePgListenerReconnect();
  }
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

async function startPgListener(): Promise<boolean> {
  const store = getStore();
  if (!postgresRealtimeEnabled()) return true;
  if (store.started) return true;
  if (store.startPromise) {
    await store.startPromise;
    return store.started;
  }
  if (!listenerEnabled()) return false;

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
    emitTransportReset("listener_disconnected");
    schedulePgListenerReconnect();
  }).finally(() => {
    store.startPromise = null;
  });

  await store.startPromise;
  return store.started;
}

function waitForPublishRetry(delayMs: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}

async function publishDistributed(payload: RealtimeEventPayload): Promise<boolean> {
  if (!postgresRealtimeEnabled()) return true;
  if (!publisherEnabled()) {
    emitTransportReset("publisher_unavailable");
    return false;
  }
  const envelope = JSON.stringify({ source: INSTANCE_ID, payload });
  // PostgreSQL NOTIFY has an 8 KB payload ceiling. Fail visibly rather than
  // silently truncating or pretending that a cross-instance event was sent.
  if (Buffer.byteLength(envelope, "utf8") > 7_500) {
    emitTransportReset("publisher_unavailable");
    return false;
  }
  // notify through postgres to reach all running instances without polling
  const store = getStore();
  for (let attempt = 0; attempt < PUBLISH_MAX_ATTEMPTS; attempt += 1) {
    if (!store.publishPool) {
      const connectionString = resolveRealtimePublisherDatabaseUrl();
      if (!connectionString) break;
      const nextPool = new Pool({ connectionString, max: 1 });
      nextPool.on("error", () => {
        if (store.publishPool !== nextPool) return;
        store.publishPool = null;
        void nextPool.end().catch(() => null);
      });
      store.publishPool = nextPool;
    }
    const pool = store.publishPool;
    try {
      await pool.query("SELECT pg_notify($1, $2)", [CHANNEL, envelope]);
      return true;
    } catch {
      if (store.publishPool === pool) store.publishPool = null;
      void pool.end().catch(() => null);
      if (attempt + 1 < PUBLISH_MAX_ATTEMPTS) {
        await waitForPublishRetry(resolveJitteredRealtimeDelay(
          PUBLISH_RETRY_BASE_MS * (2 ** attempt),
          { jitterRatio: 0.2 },
        ));
      }
    }
  }
  emitTransportReset("publisher_unavailable");
  return false;
}

export async function publishRealtimeEvent(
  payload: RealtimeEventPayload,
  explicitScope?: RealtimePublishScope,
) {
  const mode = resolveRealtimeMode();
  const store = getStore();
  const brokerInput = explicitScope && "tenantSlug" in explicitScope && !payload.tenant_slug
    ? { ...payload, tenant_slug: explicitScope.tenantSlug }
    : payload;
  // This projection is the only payload allowed to reach memory, PostgreSQL or
  // the managed broker. Rich domain/contact objects remain in their durable
  // stores and cannot leak through a newly added publisher by accident.
  const safePayload = brokerSafePayload(brokerInput);
  if (!safePayload) {
    return { distributed: false, transport: "misconfigured" as const, attempts: 0 };
  }
  if (mode === "memory") {
    store.emitter.emit("event", safePayload);
    return { distributed: true, transport: "memory" as const, attempts: 1 };
  }
  if (mode === "postgres") {
    // PostgreSQL remains an explicit pilot transport. Local listeners are
    // notified synchronously and cross-instance delivery is awaited.
    store.emitter.emit("event", safePayload);
    return {
      distributed: await publishDistributed(safePayload),
      transport: "postgres" as const,
    };
  }
  if (mode !== "upstash") {
    console.warn("[realtime_publish_unavailable]", JSON.stringify({
      transport: "misconfigured",
      reason: "mode_invalid",
      attempts: 0,
    }));
    return { distributed: false, transport: "misconfigured" as const, attempts: 0 };
  }

  const config = resolveUpstashRealtimeConfig();
  const channelPrefix = resolveUpstashChannelPrefix();
  const channels = channelPrefix
    ? resolveUpstashPublishChannels(
      // Resolve scope against the original payload so an invalid or conflicting
      // tenant slug cannot disappear during minimization and become authorized.
      payload as Record<string, unknown>,
      explicitScope,
      channelPrefix,
    )
    : null;
  if (!config || !channels?.length) {
    console.warn("[realtime_publish_unavailable]", JSON.stringify({
      transport: "upstash",
      reason: !config ? "configuration_unavailable" : "scope_invalid",
      attempts: 0,
    }));
    return { distributed: false, transport: "upstash" as const, attempts: 0 };
  }

  // No local fast path here: every subscriber consumes the same managed
  // stream. Retrying the pair can repeat a channel after partial fanout, so the
  // stable realtime_delivery_id is mandatory and consumers dedupe exact copies.
  for (let attempt = 0; attempt < PUBLISH_MAX_ATTEMPTS; attempt += 1) {
    try {
      await publishUpstashRealtimeEvent({
        config,
        channels,
        source: INSTANCE_ID,
        payload: safePayload as Record<string, unknown>,
      });
      return { distributed: true, transport: "upstash" as const, attempts: attempt + 1 };
    } catch {
      if (attempt + 1 < PUBLISH_MAX_ATTEMPTS) {
        await waitForPublishRetry(resolveJitteredRealtimeDelay(
          PUBLISH_RETRY_BASE_MS * (2 ** attempt),
          { jitterRatio: 0.2 },
        ));
      }
    }
  }
  console.warn("[realtime_publish_unavailable]", JSON.stringify({
    transport: "upstash",
    reason: "publish_failed",
    attempts: PUBLISH_MAX_ATTEMPTS,
    channel_count: channels.length,
  }));
  emitTransportReset("publisher_unavailable", channels);
  return { distributed: false, transport: "upstash" as const, attempts: PUBLISH_MAX_ATTEMPTS };
}

export function onRealtimeEvent(listener: (payload: RealtimeEventPayload) => void) {
  const mode = resolveRealtimeMode();
  if (mode === "upstash") {
    throw new Error("realtime_scoped_subscription_required");
  }
  if (!mode) {
    throw new Error("realtime_transport_misconfigured");
  }
  const emitter = getStore().emitter;
  emitter.on("event", listener);
  if (mode === "postgres") void startPgListener();
  return () => {
    emitter.off("event", listener);
    if (mode === "postgres" && emitter.listenerCount("event") === 0) stopPgListener();
  };
}

export async function subscribeRealtimeEvent(
  listener: (payload: RealtimeEventPayload) => void,
  scope?: RealtimeSubscriptionScope,
) {
  const mode = resolveRealtimeMode();
  if (mode === "upstash") {
    const config = resolveUpstashRealtimeConfig();
    const channelPrefix = resolveUpstashChannelPrefix();
    const channel = channelPrefix
      ? resolveUpstashRealtimeChannel(scope, channelPrefix)
      : null;
    if (!config || !channel) {
      return {
        distributedReady: false,
        transport: "upstash" as const,
        unsubscribe() {},
      };
    }

    const emitter = getStore().emitter;
    const localEventName = localUpstashEventName(channel);
    emitter.on(localEventName, listener);
    try {
      const remote = await subscribeUpstashRealtimeEvent({
        config,
        channel,
        after: scope?.after,
        signal: scope?.signal,
        onData({ envelope, cursor, channel: messageChannel }) {
          const safePayload = brokerSafePayload(envelope.payload);
          if (!safePayload) return;
          listener({
            ...safePayload,
            realtime_cursor: cursor,
            realtime_channel: messageChannel,
          });
        },
        onTransportReset() {
          listener(transportResetPayload("listener_disconnected"));
        },
      });
      return {
        distributedReady: true,
        transport: "upstash" as const,
        replay: remote.replay,
        replayResetReason: remote.replayResetReason,
        unsubscribe() {
          emitter.off(localEventName, listener);
          remote.unsubscribe();
        },
      };
    } catch {
      emitter.off(localEventName, listener);
      return {
        distributedReady: false,
        transport: "upstash" as const,
        unsubscribe() {},
      };
    }
  }

  const emitter = getStore().emitter;
  if (!mode) {
    return {
      distributedReady: false,
      transport: "misconfigured" as const,
      unsubscribe() {},
    };
  }
  // Register before awaiting LISTEN readiness so in-process events cannot fall
  // through the startup gap. The caller buffers until its snapshot is ready.
  emitter.on("event", listener);
  const distributedReady = mode === "postgres" ? await startPgListener() : true;
  return {
    distributedReady,
    transport: mode,
    unsubscribe() {
      emitter.off("event", listener);
      if (mode === "postgres" && emitter.listenerCount("event") === 0) stopPgListener();
    },
  };
}

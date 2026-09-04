import { createHash, randomUUID } from "node:crypto";
import { Realtime, isRealtimeCursor } from "@upstash/realtime";
import { Redis } from "@upstash/redis";
import { z } from "zod/v4";

const DEFAULT_HISTORY_MAX_LENGTH = 500;
const DEFAULT_HISTORY_TTL_SECONDS = 15 * 60;
const DEFAULT_REPLAY_LIMIT = 200;
const DEFAULT_REPLAY_WINDOW_SECONDS = 5 * 60;
const DEFAULT_HISTORY_READ_TIMEOUT_MS = 5_000;
const SUBSCRIBE_READY_TIMEOUT_MS = 10_000;
const TENANT_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,118}[a-z0-9])?$/;
const CHANNEL_PREFIX_PATTERN = /^[a-z0-9](?:[a-z0-9:_-]{0,62}[a-z0-9])?$/i;
const DEPLOYMENT_ENVIRONMENT_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,30}[a-z0-9])?$/i;

const envelopeSchema = z.object({
  source: z.string().min(1).max(128),
  dispatch_id: z.string().uuid(),
  payload: z.record(z.string(), z.unknown()),
});

const realtimeSchema = {
  nexid: {
    event: envelopeSchema,
  },
} as const;

export type UpstashRealtimeEnvelope = z.infer<typeof envelopeSchema>;

export type UpstashRealtimeConfig = {
  url: string;
  token: string;
  channelPrefix: string;
  historyMaxLength: number;
  historyTtlSeconds: number;
  replayLimit: number;
  replayWindowMs: number;
  historyReadTimeoutMs: number;
};

export type UpstashRealtimeReplayMode = "cursor" | "bounded_history" | "snapshot_reset";
export type UpstashRealtimeReplayResetReason =
  | "cursor_invalid_or_expired"
  | "cursor_unavailable"
  | "replay_backlog_truncated";

export type RealtimeChannelScope =
  | { tenantSlug: string; global?: never }
  | { global: true; tenantSlug?: never };

export type RealtimePublishScope = RealtimeChannelScope;

export type RealtimeSubscriptionScope = RealtimeChannelScope & {
  after?: string | null;
  signal?: AbortSignal;
};

type UpstashRuntimeStore = {
  fingerprint: string;
  redis: Redis;
};

const RUNTIME_KEY = "__nexid_upstash_realtime_runtime__";

function boundedInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

function normalizeHttpsUrl(value: unknown) {
  const candidate = String(value || "").trim();
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:") return null;
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function normalizeRealtimeTenantSlug(value: unknown) {
  const normalized = String(value || "").trim().toLowerCase();
  return TENANT_SLUG_PATTERN.test(normalized) ? normalized : null;
}

export function resolveRealtimeDeploymentEnvironment(env: NodeJS.ProcessEnv = process.env) {
  const value = String(
    env.VERCEL_ENV
    || env.REALTIME_UPSTASH_ENVIRONMENT
    || env.NODE_ENV
    || "",
  ).trim().toLowerCase();
  return DEPLOYMENT_ENVIRONMENT_PATTERN.test(value) ? value : null;
}

export function resolveUpstashChannelPrefix(env: NodeJS.ProcessEnv = process.env) {
  const value = String(env.REALTIME_UPSTASH_CHANNEL_PREFIX || "").trim().toLowerCase();
  const environment = resolveRealtimeDeploymentEnvironment(env);
  if (!environment || !CHANNEL_PREFIX_PATTERN.test(value)) return null;
  // A broker can be shared by Production, Preview and local development. The
  // environment suffix is mandatory so a bad deployment can never subscribe
  // to another environment's tenant or Super Admin aggregate.
  return value.endsWith(`:${environment}`) ? value : null;
}

export function resolveUpstashRealtimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): UpstashRealtimeConfig | null {
  const url = normalizeHttpsUrl(env.UPSTASH_REDIS_REST_URL);
  const token = String(env.UPSTASH_REDIS_REST_TOKEN || "").trim();
  const channelPrefix = resolveUpstashChannelPrefix(env);
  if (!url || token.length < 16 || !channelPrefix) return null;

  const historyMaxLength = boundedInteger(
    env.REALTIME_UPSTASH_HISTORY_MAX_LENGTH,
    DEFAULT_HISTORY_MAX_LENGTH,
    50,
    1_000,
  );
  const historyTtlSeconds = boundedInteger(
    env.REALTIME_UPSTASH_HISTORY_TTL_SECONDS,
    DEFAULT_HISTORY_TTL_SECONDS,
    60,
    86_400,
  );
  const replayLimit = boundedInteger(
    env.REALTIME_UPSTASH_REPLAY_LIMIT,
    Math.min(DEFAULT_REPLAY_LIMIT, historyMaxLength),
    1,
    Math.min(1_000, historyMaxLength),
  );
  const replayWindowSeconds = boundedInteger(
    env.REALTIME_UPSTASH_REPLAY_WINDOW_SECONDS,
    Math.min(DEFAULT_REPLAY_WINDOW_SECONDS, historyTtlSeconds),
    30,
    historyTtlSeconds,
  );
  const historyReadTimeoutMs = boundedInteger(
    env.REALTIME_UPSTASH_HISTORY_READ_TIMEOUT_MS,
    DEFAULT_HISTORY_READ_TIMEOUT_MS,
    100,
    10_000,
  );
  return {
    url,
    token,
    channelPrefix,
    historyMaxLength,
    historyTtlSeconds,
    replayLimit,
    replayWindowMs: replayWindowSeconds * 1_000,
    historyReadTimeoutMs,
  };
}

export function resolveUpstashRealtimeChannel(
  scope: RealtimeChannelScope | null | undefined,
  channelPrefix: string,
) {
  if (!scope) return null;
  if ("tenantSlug" in scope) {
    const tenantSlug = normalizeRealtimeTenantSlug(scope.tenantSlug);
    return tenantSlug ? `${channelPrefix}:tenant:${tenantSlug}` : null;
  }
  return scope.global === true ? `${channelPrefix}:global` : null;
}

/**
 * Tenant events fan out to their isolated channel plus the explicit Super Admin
 * aggregate. Platform-wide events require `{ global: true }`; a missing tenant
 * can never silently escalate itself into the global channel.
 */
export function resolveUpstashPublishChannels(
  payload: Record<string, unknown>,
  explicitScope?: RealtimePublishScope,
  channelPrefix?: string,
) {
  if (!channelPrefix || !CHANNEL_PREFIX_PATTERN.test(channelPrefix)) return null;
  const rawPayloadTenantSlug = String(payload.tenant_slug || "").trim();
  const payloadTenantSlug = normalizeRealtimeTenantSlug(rawPayloadTenantSlug);
  const payloadTenantId = String(payload.tenant_id || "").trim();

  if (rawPayloadTenantSlug && !payloadTenantSlug) return null;

  if (explicitScope && "global" in explicitScope) {
    if (payloadTenantSlug || payloadTenantId) return null;
    const globalChannel = resolveUpstashRealtimeChannel(explicitScope, channelPrefix);
    return globalChannel ? [globalChannel] : null;
  }

  const explicitTenantSlug = explicitScope && "tenantSlug" in explicitScope
    ? normalizeRealtimeTenantSlug(explicitScope.tenantSlug)
    : null;
  if (explicitScope && "tenantSlug" in explicitScope && !explicitTenantSlug) return null;
  if (explicitTenantSlug && payloadTenantSlug && explicitTenantSlug !== payloadTenantSlug) return null;

  const tenantSlug = explicitTenantSlug || payloadTenantSlug;
  if (!tenantSlug) return null;

  const tenantChannel = resolveUpstashRealtimeChannel({ tenantSlug }, channelPrefix);
  const globalChannel = resolveUpstashRealtimeChannel({ global: true }, channelPrefix);
  return tenantChannel && globalChannel ? [tenantChannel, globalChannel] : null;
}

/**
 * Realtime cursors are Redis Stream IDs (`milliseconds-sequence`). The stream is
 * already capped by max length and TTL; the age check adds a second replay bound.
 */
export function resolveBoundedUpstashCursor(
  value: unknown,
  nowMs: number,
  maximumAgeMs: number,
) {
  const candidate = String(value || "").trim();
  if (!candidate || !isRealtimeCursor(candidate)) return null;
  const timestampMs = Number(candidate.split("-", 1)[0]);
  if (!Number.isSafeInteger(timestampMs)) return null;
  if (timestampMs > nowMs + 60_000) return null;
  if (timestampMs < nowMs - maximumAgeMs) return null;
  return candidate;
}

function runtimeFingerprint(config: UpstashRealtimeConfig) {
  return createHash("sha256")
    .update([
      config.url,
      config.token,
    ].join("\u0000"))
    .digest("hex");
}

function createRedis(config: UpstashRealtimeConfig, signal?: AbortSignal) {
  return new Redis({
    url: config.url,
    token: config.token,
    enableTelemetry: false,
    ...(signal ? { signal: () => signal, retry: false } : {}),
  });
}

function getRedis(config: UpstashRealtimeConfig) {
  const scope = globalThis as typeof globalThis & { [RUNTIME_KEY]?: UpstashRuntimeStore };
  const fingerprint = runtimeFingerprint(config);
  if (!scope[RUNTIME_KEY] || scope[RUNTIME_KEY]!.fingerprint !== fingerprint) {
    scope[RUNTIME_KEY] = {
      fingerprint,
      redis: createRedis(config),
    };
  }
  return scope[RUNTIME_KEY]!.redis;
}

function createRealtime(config: UpstashRealtimeConfig) {
  return new Realtime({
    schema: realtimeSchema,
    redis: getRedis(config),
    history: {
      maxLength: config.historyMaxLength,
      expireAfterSecs: config.historyTtlSeconds,
    },
  });
}

export async function publishUpstashRealtimeEvent(input: {
  config: UpstashRealtimeConfig;
  channels: string[];
  source: string;
  payload: Record<string, unknown>;
}) {
  const envelope: UpstashRealtimeEnvelope = {
    source: input.source,
    dispatch_id: randomUUID(),
    payload: input.payload,
  };
  const realtime = createRealtime(input.config);
  const results = await Promise.allSettled(
    input.channels.map((channel) => realtime.channel(channel).emit("nexid.event", envelope)),
  );
  if (results.some((result) => result.status === "rejected")) {
    throw new Error("upstash_realtime_publish_failed");
  }
}

export async function subscribeUpstashRealtimeEvent(input: {
  config: UpstashRealtimeConfig;
  channel: string;
  after?: string | null;
  onData: (message: {
    envelope: UpstashRealtimeEnvelope;
    cursor: string;
    channel: string;
  }) => void;
  onTransportReset: () => void;
  signal?: AbortSignal;
}) {
  if (input.signal?.aborted) {
    throw new Error("upstash_realtime_subscriber_unavailable");
  }

  type TransportMessage = {
    event?: unknown;
    data?: unknown;
    channel?: unknown;
    id?: unknown;
  };

  const requestedCursor = String(input.after || "").trim();
  const after = resolveBoundedUpstashCursor(
    requestedCursor,
    Date.now(),
    input.config.replayWindowMs,
  );
  const startupBuffer: TransportMessage[] = [];
  let startupBufferOverflow = false;
  let historyReady = false;
  let readyForCaller = false;
  let transportFailed = false;
  let closed = false;
  let lastCursor: string | null = after;
  let replay: UpstashRealtimeReplayMode = requestedCursor
    ? after ? "cursor" : "snapshot_reset"
    : "bounded_history";
  let replayResetReason: UpstashRealtimeReplayResetReason | null = requestedCursor && !after
    ? "cursor_invalid_or_expired"
    : null;
  const abortController = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let startupSettled = false;
  let resolveStartup!: () => void;
  let rejectStartup!: (error: Error) => void;
  const subscribed = new Promise<void>((resolve, reject) => {
    resolveStartup = resolve;
    rejectStartup = reject;
  });

  const compareCursors = (left: string, right: string) => {
    const [leftTime = 0n, leftSequence = 0n] = left.split("-").map(BigInt);
    const [rightTime = 0n, rightSequence = 0n] = right.split("-").map(BigInt);
    if (leftTime < rightTime) return -1;
    if (leftTime > rightTime) return 1;
    if (leftSequence < rightSequence) return -1;
    if (leftSequence > rightSequence) return 1;
    return 0;
  };

  const parseMessage = (value: TransportMessage, fallbackCursor?: string) => {
    if (value.event !== "nexid.event" || value.channel !== input.channel) return null;
    const cursor = String(value.id || fallbackCursor || "");
    if (!isRealtimeCursor(cursor)) return null;
    const envelope = envelopeSchema.safeParse(value.data);
    if (!envelope.success) return null;
    return { envelope: envelope.data, cursor, channel: input.channel };
  };

  const deliver = (value: TransportMessage, fallbackCursor?: string) => {
    if (closed) return;
    const message = parseMessage(value, fallbackCursor);
    if (!message) return;
    if (lastCursor && compareCursors(message.cursor, lastCursor) <= 0) return;
    lastCursor = message.cursor;
    input.onData(message);
  };

  const unsubscribe = async () => {
    if (closed) return;
    closed = true;
    input.signal?.removeEventListener("abort", onExternalAbort);
    abortController.abort();
    try {
      await reader?.cancel();
    } catch {
      // The upstream subscription may already have ended.
    }
  };
  const onExternalAbort = () => {
    if (!startupSettled) {
      startupSettled = true;
      rejectStartup(new Error("upstash_realtime_subscriber_unavailable"));
    }
    void unsubscribe();
  };
  input.signal?.addEventListener("abort", onExternalAbort, { once: true });
  if (input.signal?.aborted) onExternalAbort();

  const readyTimeout = setTimeout(() => {
    if (startupSettled) return;
    startupSettled = true;
    rejectStartup(new Error("upstash_realtime_subscribe_timeout"));
    void unsubscribe();
  }, SUBSCRIBE_READY_TIMEOUT_MS);
  readyTimeout.unref?.();

  const readHistory = async <T>(operation: (redis: Redis) => Promise<T>) => {
    const historyAbortController = new AbortController();
    const abortHistory = () => historyAbortController.abort(abortController.signal.reason);
    if (abortController.signal.aborted) abortHistory();
    else abortController.signal.addEventListener("abort", abortHistory, { once: true });
    const timeout = setTimeout(() => {
      historyAbortController.abort(new Error("upstash_realtime_history_timeout"));
    }, input.config.historyReadTimeoutMs);
    timeout.unref?.();
    try {
      return await operation(createRedis(input.config, historyAbortController.signal));
    } catch (error) {
      if (abortController.signal.aborted) {
        throw new Error("upstash_realtime_subscriber_unavailable");
      }
      if (historyAbortController.signal.aborted) {
        throw new Error("upstash_realtime_history_timeout");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      abortController.signal.removeEventListener("abort", abortHistory);
    }
  };

  const readRecentHistory = async () => {
    const earliestCursor = `${Math.max(0, Date.now() - input.config.replayWindowMs)}-0`;
    const recent = await readHistory((redis) => redis.xrevrange<TransportMessage>(
      input.channel,
      "+",
      earliestCursor,
      input.config.replayLimit,
    ));
    return Object.entries(recent).sort(([left], [right]) => compareCursors(left, right));
  };

  const failTransport = () => {
    if (closed) return;
    if (!startupSettled) {
      startupSettled = true;
      rejectStartup(new Error("upstash_realtime_subscriber_unavailable"));
    } else if (!readyForCaller) {
      transportFailed = true;
    } else {
      try {
        input.onTransportReset();
      } catch {
        // The request may already be closing.
      }
    }
    void unsubscribe();
  };

  const acceptMessage = (message: TransportMessage) => {
    if (closed) return;
    if (!historyReady) {
      if (startupBuffer.length < input.config.historyMaxLength) startupBuffer.push(message);
      else startupBufferOverflow = true;
      return;
    }
    deliver(message);
  };
  const markSubscribed = () => {
    if (startupSettled) return;
    startupSettled = true;
    resolveStartup();
  };

  try {
    const subscribeUrl = `${input.config.url}/subscribe/${encodeURIComponent(input.channel)}`;
    const response = await fetch(subscribeUrl, {
      method: "POST",
      headers: {
        accept: "text/event-stream",
        authorization: `Bearer ${input.config.token}`,
        "cache-control": "no-cache",
        "content-type": "application/json",
      },
      body: "[]",
      cache: "no-store",
      signal: abortController.signal,
    });
    if (!response.ok || !response.body) {
      throw new Error("upstash_realtime_subscriber_unavailable");
    }

    reader = response.body.getReader();
    const consume = async () => {
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        while (!closed) {
          const chunk = await reader!.read();
          if (chunk.done) {
            failTransport();
            return;
          }
          buffer += decoder.decode(chunk.value, { stream: true });
          if (buffer.length > 1_048_576) {
            failTransport();
            return;
          }
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const raw = line.slice(5).trimStart();
            const firstComma = raw.indexOf(",");
            const secondComma = raw.indexOf(",", firstComma + 1);
            if (firstComma < 1 || secondComma < 0) continue;
            const type = raw.slice(0, firstComma);
            const channel = raw.slice(firstComma + 1, secondComma);
            if (channel !== input.channel) continue;
            const value = raw.slice(secondComma + 1);
            if (type === "subscribe") {
              markSubscribed();
              continue;
            }
            if (type === "unsubscribe") {
              failTransport();
              return;
            }
            if (type !== "message") continue;
            try {
              acceptMessage(JSON.parse(value) as TransportMessage);
            } catch {
              failTransport();
              return;
            }
          }
        }
      } catch {
        if (!abortController.signal.aborted) failTransport();
      } finally {
        try {
          await reader?.cancel();
        } catch {
          // The network stream may already have failed.
        }
      }
    };
    void consume();
  } catch {
    failTransport();
  }

  try {
    await subscribed;
    clearTimeout(readyTimeout);
    if (closed) throw new Error("upstash_realtime_subscriber_unavailable");

    let entries: Array<[string, TransportMessage]>;
    if (after) {
      const history = await readHistory((redis) => redis.xrange<TransportMessage>(
        input.channel,
        after,
        "+",
        // The cursor itself is inclusive. One extra unseen event lets us detect
        // a backlog that cannot be replayed completely within the hard limit.
        input.config.replayLimit + 2,
      ));
      const cursorEntries = Object.entries(history)
        .sort(([left], [right]) => compareCursors(left, right));
      const cursorAvailable = cursorEntries[0]?.[0] === after;
      const backlogTruncated = cursorAvailable
        && cursorEntries.length > input.config.replayLimit + 1;
      if (!cursorAvailable || backlogTruncated) {
        replay = "snapshot_reset";
        replayResetReason = cursorAvailable
          ? "replay_backlog_truncated"
          : "cursor_unavailable";
        lastCursor = null;
        entries = await readRecentHistory();
      } else {
        entries = cursorEntries.slice(1);
      }
    } else {
      // XREVRANGE reads the newest bounded slice. Sorting back to ascending
      // order preserves causal delivery while avoiding an old-first replay
      // that would omit the events closest to the reconnect.
      entries = await readRecentHistory();
      lastCursor = null;
    }
    if (closed || transportFailed) {
      throw new Error("upstash_realtime_subscriber_unavailable");
    }
    for (const [cursor, value] of entries) {
      deliver(value, cursor);
    }
    if (startupBufferOverflow) {
      throw new Error("upstash_realtime_startup_buffer_overflow");
    }
    historyReady = true;
    startupBuffer.splice(0).forEach((message) => deliver(message));
    if (closed || transportFailed) {
      throw new Error("upstash_realtime_subscriber_unavailable");
    }
    readyForCaller = true;
  } catch (error) {
    clearTimeout(readyTimeout);
    await unsubscribe();
    throw error;
  }

  return {
    channel: input.channel,
    replay,
    replayResetReason,
    unsubscribe() {
      void unsubscribe();
    },
  };
}

import { resolveJitteredRealtimeDelay } from "./realtime-timing";

export type RealtimeStreamSubscription = {
  distributedReady: boolean;
  transport: string;
  replay?: "cursor" | "bounded_history" | "snapshot_reset";
  replayResetReason?:
    | "cursor_invalid_or_expired"
    | "cursor_unavailable"
    | "replay_backlog_truncated"
    | null;
  unsubscribe: () => void;
};

export function createBoundedRealtimeProjectionDeduper<Row>(
  keyOf: (row: Row) => string,
  fingerprintOf: (row: Row) => string,
  maxEntries = 10_000,
) {
  const boundedMaxEntries = Math.max(1, maxEntries);
  const seen = new Map<string, string>();

  return (row: Row) => {
    const key = keyOf(row).trim();
    if (!key) return false;
    const fingerprint = fingerprintOf(row);
    if (seen.get(key) === fingerprint) return false;
    seen.delete(key);
    seen.set(key, fingerprint);
    if (seen.size > boundedMaxEntries) {
      const oldest = seen.keys().next().value as string | undefined;
      if (oldest) seen.delete(oldest);
    }
    return true;
  };
}

type TimerHandle = ReturnType<typeof setTimeout>;

export type RealtimeStreamLifecycleOptions<Row, Payload> = {
  signal: AbortSignal;
  subscribe: (listener: (payload: Payload) => void) => Promise<RealtimeStreamSubscription>;
  fetchSnapshot: () => Promise<Row[]>;
  rememberSnapshotRow: (row: Row) => void;
  emitConnected: (subscription: RealtimeStreamSubscription) => void;
  emitSnapshot: (rows: Row[], subscription: RealtimeStreamSubscription) => void;
  handlePayload: (payload: Payload) => void;
  isTerminalPayload: (payload: Payload) => boolean;
  emitTransportUnavailable: () => void;
  emitSnapshotUnavailable: (error: unknown) => void;
  emitStartupBufferOverflow: () => void;
  emitHeartbeat: (now: number) => void;
  closeController: () => void;
  isExternallyCancelled: () => boolean;
  registerShutdown: (shutdown: ((closeController?: boolean) => void) | null) => void;
  startupBufferLimit?: number;
  heartbeatMs?: number;
  lifetimeMs?: number;
  lifetimeJitterRatio?: number;
  randomImpl?: () => number;
  setIntervalImpl?: (callback: () => void, delayMs: number) => TimerHandle;
  clearIntervalImpl?: (handle: TimerHandle) => void;
  setTimeoutImpl?: (callback: () => void, delayMs: number) => TimerHandle;
  clearTimeoutImpl?: (handle: TimerHandle) => void;
};

/**
 * Coordinates the finite startup phase of the SSE stream.
 *
 * The subscription is deliberately established before the durable snapshot.
 * Non-terminal notifications are buffered until snapshot rows have populated
 * the caller's deduper. Transport resets bypass the buffer so an unhealthy
 * stream can never publish a ready snapshot or arm timers after closing.
 */
export async function runRealtimeStreamLifecycle<Row, Payload>(
  options: RealtimeStreamLifecycleOptions<Row, Payload>,
): Promise<void> {
  const startupBufferLimit = Math.max(1, options.startupBufferLimit ?? 500);
  const heartbeatMs = Math.max(1, options.heartbeatMs ?? 15_000);
  const lifetimeMs = Math.max(1, options.lifetimeMs ?? 4 * 60 * 1_000);
  const rotatedLifetimeMs = resolveJitteredRealtimeDelay(lifetimeMs, {
    jitterRatio: options.lifetimeJitterRatio ?? 0.1,
    random: options.randomImpl,
  });
  const setIntervalImpl = options.setIntervalImpl ?? setInterval;
  const clearIntervalImpl = options.clearIntervalImpl ?? clearInterval;
  const setTimeoutImpl = options.setTimeoutImpl ?? setTimeout;
  const clearTimeoutImpl = options.clearTimeoutImpl ?? clearTimeout;

  const startupBuffer: Payload[] = [];
  let startupBufferOverflow = false;
  let snapshotReady = false;
  let closed = false;
  let unsubscribe = () => {};
  let heartbeat: TimerHandle | null = null;
  let lifetime: TimerHandle | null = null;

  const shutdown = (closeController = true) => {
    if (closed) return;
    closed = true;
    if (heartbeat) clearIntervalImpl(heartbeat);
    if (lifetime) clearTimeoutImpl(lifetime);
    unsubscribe();
    options.signal.removeEventListener("abort", onAbort);
    options.registerShutdown(null);
    if (closeController) options.closeController();
  };
  const onAbort = () => shutdown();

  options.registerShutdown(shutdown);
  options.signal.addEventListener("abort", onAbort, { once: true });
  if (options.signal.aborted || options.isExternallyCancelled()) {
    shutdown();
    return;
  }

  let subscription: RealtimeStreamSubscription;
  try {
    subscription = await options.subscribe((payload) => {
      if (closed || options.isExternallyCancelled()) return;
      if (options.isTerminalPayload(payload)) {
        options.handlePayload(payload);
        shutdown();
        return;
      }
      if (!snapshotReady) {
        if (startupBuffer.length < startupBufferLimit) startupBuffer.push(payload);
        else startupBufferOverflow = true;
        return;
      }
      options.handlePayload(payload);
    });
  } catch {
    if (closed || options.isExternallyCancelled()) return;
    options.emitTransportUnavailable();
    shutdown();
    return;
  }

  if (closed || options.isExternallyCancelled()) {
    subscription.unsubscribe();
    return;
  }
  unsubscribe = subscription.unsubscribe;

  if (!subscription.distributedReady) {
    options.emitTransportUnavailable();
    shutdown();
    return;
  }

  let snapshotRows: Row[];
  try {
    snapshotRows = await options.fetchSnapshot();
  } catch (error) {
    if (closed || options.isExternallyCancelled()) return;
    options.emitSnapshotUnavailable(error);
    shutdown();
    return;
  }

  if (closed || options.isExternallyCancelled()) return;
  if (startupBufferOverflow) {
    options.emitStartupBufferOverflow();
    shutdown();
    return;
  }
  snapshotRows.forEach(options.rememberSnapshotRow);
  options.emitConnected(subscription);
  options.emitSnapshot(snapshotRows, subscription);
  snapshotReady = true;
  startupBuffer.splice(0).forEach(options.handlePayload);

  if (closed || options.isExternallyCancelled()) return;
  heartbeat = setIntervalImpl(() => {
    if (closed || options.isExternallyCancelled()) return;
    options.emitHeartbeat(Date.now());
  }, heartbeatMs);
  lifetime = setTimeoutImpl(() => shutdown(), rotatedLifetimeMs);
}

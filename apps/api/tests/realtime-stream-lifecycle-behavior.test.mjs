import test from "node:test";
import assert from "node:assert/strict";

const {
  createBoundedRealtimeProjectionDeduper,
  runRealtimeStreamLifecycle,
} = await import("../src/lib/realtime-stream-lifecycle.ts");

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function waitUntil(predicate, message) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return;
    await Promise.resolve();
  }
  assert.fail(message);
}

test("subscription precedes the snapshot and buffered events flush through the snapshot deduper", async () => {
  const abortController = new AbortController();
  const snapshotGate = deferred();
  const order = [];
  const emittedEventIds = [];
  const scheduledIntervals = [];
  const scheduledTimeouts = [];
  const clearedIntervals = [];
  const clearedTimeouts = [];
  let listener;
  let shutdown = () => {};
  let unsubscribeCount = 0;

  const remember = createBoundedRealtimeProjectionDeduper(
    (row) => row.eventId,
    (row) => JSON.stringify(row),
    10,
  );

  const lifecycle = runRealtimeStreamLifecycle({
    signal: abortController.signal,
    subscribe: async (nextListener) => {
      order.push("subscribe");
      listener = nextListener;
      return {
        distributedReady: true,
        transport: "postgres_notify",
        unsubscribe: () => {
          unsubscribeCount += 1;
        },
      };
    },
    fetchSnapshot: () => {
      order.push("snapshot:start");
      return snapshotGate.promise;
    },
    rememberSnapshotRow: (row) => {
      order.push(`snapshot:remember:${row.eventId}`);
      remember(row);
    },
    emitConnected: () => order.push("connected"),
    emitSnapshot: () => order.push("snapshot:emit"),
    handlePayload: (payload) => {
      order.push(`payload:${payload.eventId}`);
      if (remember(payload)) emittedEventIds.push(payload.eventId);
    },
    isTerminalPayload: () => false,
    emitTransportUnavailable: () => assert.fail("transport must be ready"),
    emitSnapshotUnavailable: () => assert.fail("snapshot must succeed"),
    emitStartupBufferOverflow: () => assert.fail("buffer must not overflow"),
    emitHeartbeat: () => {},
    closeController: () => order.push("closed"),
    isExternallyCancelled: () => false,
    registerShutdown: (nextShutdown) => {
      if (nextShutdown) shutdown = nextShutdown;
    },
    setIntervalImpl: (callback, delayMs) => {
      const handle = { callback, delayMs, kind: "interval" };
      scheduledIntervals.push(handle);
      return handle;
    },
    clearIntervalImpl: (handle) => clearedIntervals.push(handle),
    setTimeoutImpl: (callback, delayMs) => {
      const handle = { callback, delayMs, kind: "timeout" };
      scheduledTimeouts.push(handle);
      return handle;
    },
    clearTimeoutImpl: (handle) => clearedTimeouts.push(handle),
  });

  await waitUntil(() => order.includes("snapshot:start"), "snapshot did not start");
  assert.deepEqual(order.slice(0, 2), ["subscribe", "snapshot:start"]);

  listener({ eventId: "101", revision: 1 });
  listener({ eventId: "102", revision: 1 });
  listener({ eventId: "102", revision: 1 });
  assert.deepEqual(emittedEventIds, [], "startup events must remain buffered");

  snapshotGate.resolve([{ eventId: "101", revision: 1 }]);
  await lifecycle;

  assert.deepEqual(emittedEventIds, ["102"]);
  assert.ok(order.indexOf("snapshot:remember:101") < order.indexOf("payload:101"));
  assert.ok(order.indexOf("snapshot:emit") < order.indexOf("payload:101"));
  listener({ eventId: "102", revision: 2 });
  listener({ eventId: "102", revision: 2 });
  assert.deepEqual(
    emittedEventIds,
    ["102", "102"],
    "an updated persisted projection must emit once while its exact duplicate stays suppressed",
  );
  assert.equal(scheduledIntervals.length, 1);
  assert.equal(scheduledTimeouts.length, 1);
  assert.ok(scheduledTimeouts[0].delayMs >= 216_000);
  assert.ok(scheduledTimeouts[0].delayMs <= 264_000);

  shutdown(false);
  assert.equal(unsubscribeCount, 1);
  assert.deepEqual(clearedIntervals, scheduledIntervals);
  assert.deepEqual(clearedTimeouts, scheduledTimeouts);
});

test("a transport reset during the snapshot closes immediately and never arms timers", async () => {
  const abortController = new AbortController();
  const snapshotGate = deferred();
  const frames = [];
  let listener;
  let fetchStarted = false;
  let closed = false;
  let unsubscribeCount = 0;
  let intervalCount = 0;
  let timeoutCount = 0;

  const lifecycle = runRealtimeStreamLifecycle({
    signal: abortController.signal,
    subscribe: async (nextListener) => {
      listener = nextListener;
      return {
        distributedReady: true,
        transport: "postgres_notify",
        unsubscribe: () => {
          unsubscribeCount += 1;
        },
      };
    },
    fetchSnapshot: () => {
      fetchStarted = true;
      return snapshotGate.promise;
    },
    rememberSnapshotRow: () => {
      if (closed) assert.fail("snapshot row processed after close");
    },
    emitConnected: () => {
      if (closed) assert.fail("connected frame emitted after close");
      frames.push("connected");
    },
    emitSnapshot: () => {
      if (closed) assert.fail("snapshot frame emitted after close");
      frames.push("snapshot");
    },
    handlePayload: (payload) => {
      if (closed) assert.fail("payload handled after close");
      frames.push(payload.event_type);
    },
    isTerminalPayload: (payload) => payload.event_type === "realtime.transport_reset",
    emitTransportUnavailable: () => assert.fail("transport must be ready"),
    emitSnapshotUnavailable: () => assert.fail("closed snapshot errors stay silent"),
    emitStartupBufferOverflow: () => assert.fail("buffer must not overflow"),
    emitHeartbeat: () => {
      if (closed) assert.fail("heartbeat emitted after close");
    },
    closeController: () => {
      closed = true;
    },
    isExternallyCancelled: () => false,
    registerShutdown: () => {},
    setIntervalImpl: () => {
      intervalCount += 1;
      return {};
    },
    clearIntervalImpl: () => {},
    setTimeoutImpl: () => {
      timeoutCount += 1;
      return {};
    },
    clearTimeoutImpl: () => {},
  });

  await waitUntil(() => fetchStarted, "snapshot did not start");
  listener({ event_type: "realtime.transport_reset" });
  assert.equal(closed, true);
  assert.equal(unsubscribeCount, 1);
  assert.deepEqual(frames, ["realtime.transport_reset"]);

  listener({ event_type: "tap.persisted", eventId: "after-close" });
  snapshotGate.resolve([{ eventId: "late-snapshot" }]);
  await lifecycle;

  assert.deepEqual(frames, ["realtime.transport_reset"]);
  assert.equal(intervalCount, 0);
  assert.equal(timeoutCount, 0);
});

test("request abort during the snapshot closes without post-close frames or timers", async () => {
  const abortController = new AbortController();
  const snapshotGate = deferred();
  let fetchStarted = false;
  let closed = false;
  let unsubscribeCount = 0;
  let frameCount = 0;
  let timerCount = 0;

  const lifecycle = runRealtimeStreamLifecycle({
    signal: abortController.signal,
    subscribe: async () => ({
      distributedReady: true,
      transport: "postgres_notify",
      unsubscribe: () => {
        unsubscribeCount += 1;
      },
    }),
    fetchSnapshot: () => {
      fetchStarted = true;
      return snapshotGate.promise;
    },
    rememberSnapshotRow: () => {
      frameCount += 1;
    },
    emitConnected: () => {
      frameCount += 1;
    },
    emitSnapshot: () => {
      frameCount += 1;
    },
    handlePayload: () => {
      frameCount += 1;
    },
    isTerminalPayload: () => false,
    emitTransportUnavailable: () => {
      frameCount += 1;
    },
    emitSnapshotUnavailable: () => {
      frameCount += 1;
    },
    emitStartupBufferOverflow: () => {
      frameCount += 1;
    },
    emitHeartbeat: () => {
      frameCount += 1;
    },
    closeController: () => {
      closed = true;
    },
    isExternallyCancelled: () => false,
    registerShutdown: () => {},
    setIntervalImpl: () => {
      timerCount += 1;
      return {};
    },
    clearIntervalImpl: () => {},
    setTimeoutImpl: () => {
      timerCount += 1;
      return {};
    },
    clearTimeoutImpl: () => {},
  });

  await waitUntil(() => fetchStarted, "snapshot did not start");
  abortController.abort();
  assert.equal(closed, true);
  assert.equal(unsubscribeCount, 1);

  snapshotGate.resolve([{ eventId: "late-snapshot" }]);
  await lifecycle;

  assert.equal(frameCount, 0);
  assert.equal(timerCount, 0);
});

test("a rejected transport subscription fails closed without fetching or arming timers", async () => {
  const abortController = new AbortController();
  const frames = [];
  let snapshotCount = 0;
  let timerCount = 0;
  let closed = false;

  await runRealtimeStreamLifecycle({
    signal: abortController.signal,
    subscribe: async () => {
      throw new Error("broker unavailable");
    },
    fetchSnapshot: async () => {
      snapshotCount += 1;
      return [];
    },
    rememberSnapshotRow: () => {},
    emitConnected: () => frames.push("connected"),
    emitSnapshot: () => frames.push("snapshot"),
    handlePayload: () => frames.push("payload"),
    isTerminalPayload: () => false,
    emitTransportUnavailable: () => frames.push("transport_unavailable"),
    emitSnapshotUnavailable: () => frames.push("snapshot_unavailable"),
    emitStartupBufferOverflow: () => frames.push("buffer_overflow"),
    emitHeartbeat: () => frames.push("heartbeat"),
    closeController: () => {
      closed = true;
    },
    isExternallyCancelled: () => false,
    registerShutdown: () => {},
    setIntervalImpl: () => {
      timerCount += 1;
      return {};
    },
    clearIntervalImpl: () => {},
    setTimeoutImpl: () => {
      timerCount += 1;
      return {};
    },
    clearTimeoutImpl: () => {},
  });

  assert.equal(closed, true);
  assert.equal(snapshotCount, 0);
  assert.equal(timerCount, 0);
  assert.deepEqual(frames, ["transport_unavailable"]);
});

test("startup buffer overflow fails closed before advertising a ready snapshot", async () => {
  const abortController = new AbortController();
  const snapshotGate = deferred();
  const frames = [];
  let listener;
  let unsubscribeCount = 0;
  let timerCount = 0;

  const lifecycle = runRealtimeStreamLifecycle({
    signal: abortController.signal,
    subscribe: async (nextListener) => {
      listener = nextListener;
      return {
        distributedReady: true,
        transport: "upstash",
        unsubscribe: () => {
          unsubscribeCount += 1;
        },
      };
    },
    fetchSnapshot: () => snapshotGate.promise,
    rememberSnapshotRow: () => frames.push("remember"),
    emitConnected: () => frames.push("connected"),
    emitSnapshot: () => frames.push("snapshot"),
    handlePayload: () => frames.push("payload"),
    isTerminalPayload: () => false,
    emitTransportUnavailable: () => frames.push("transport_unavailable"),
    emitSnapshotUnavailable: () => frames.push("snapshot_unavailable"),
    emitStartupBufferOverflow: () => frames.push("buffer_overflow"),
    emitHeartbeat: () => frames.push("heartbeat"),
    closeController: () => frames.push("closed"),
    isExternallyCancelled: () => false,
    registerShutdown: () => {},
    startupBufferLimit: 1,
    setIntervalImpl: () => {
      timerCount += 1;
      return {};
    },
    clearIntervalImpl: () => {},
    setTimeoutImpl: () => {
      timerCount += 1;
      return {};
    },
    clearTimeoutImpl: () => {},
  });

  await waitUntil(() => typeof listener === "function", "listener was not registered");
  listener({ eventId: "first" });
  listener({ eventId: "overflow" });
  snapshotGate.resolve([{ eventId: "snapshot-row" }]);
  await lifecycle;

  assert.deepEqual(frames, ["buffer_overflow", "closed"]);
  assert.equal(unsubscribeCount, 1);
  assert.equal(timerCount, 0);
});

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

  assert.match(source, /pool\.on\("error", \(\) => resetPgListener/);
  assert.match(source, /client\.on\("error", onDisconnect\)/);
  assert.match(source, /client\.on\("end", onDisconnect\)/);
  assert.match(source, /schedulePgListenerReconnect/);
  assert.match(source, /if \(emitter\.listenerCount\("event"\) === 0\) stopPgListener\(\)/);
  assert.match(source, /store\.publishPool = null/);
});


import test from "node:test";
import assert from "node:assert/strict";

const { resolveJitteredRealtimeDelay } = await import("../src/lib/realtime-timing.ts");

test("realtime jitter is symmetric, bounded and deterministic with an injected sample", () => {
  assert.equal(resolveJitteredRealtimeDelay(1_000, { jitterRatio: 0.2, random: () => 0 }), 800);
  assert.equal(resolveJitteredRealtimeDelay(1_000, { jitterRatio: 0.2, random: () => 0.5 }), 1_000);
  assert.equal(resolveJitteredRealtimeDelay(1_000, { jitterRatio: 0.2, random: () => 1 }), 1_200);
});

test("realtime jitter clamps unsafe inputs", () => {
  assert.equal(resolveJitteredRealtimeDelay(1_000, { jitterRatio: 5, random: () => -1 }), 500);
  assert.equal(resolveJitteredRealtimeDelay(1_000, { jitterRatio: -1, random: () => 1 }), 1_000);
  assert.equal(resolveJitteredRealtimeDelay(0, { random: () => Number.NaN }), 1);
});

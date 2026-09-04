import test from "node:test";
import assert from "node:assert/strict";

const { createBoundedRealtimeSseOutputQueue } = await import("../src/lib/realtime-sse-output-queue.ts");
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function fakeController(initialDesiredSize = 0) {
  let desiredSize = initialDesiredSize;
  const chunks = [];
  let closeCount = 0;
  return {
    controller: {
      get desiredSize() {
        return desiredSize;
      },
      enqueue(chunk) {
        chunks.push(decoder.decode(chunk));
      },
      close() {
        closeCount += 1;
      },
    },
    chunks,
    setDesiredSize(value) {
      desiredSize = value;
    },
    get closeCount() {
      return closeCount;
    },
  };
}

test("post-start SSE output queues under backpressure and flushes in order", () => {
  const target = fakeController(0);
  const queue = createBoundedRealtimeSseOutputQueue({
    controller: target.controller,
    overflowFrame: encoder.encode("reset"),
    onOverflow: () => assert.fail("the bounded queue must not overflow"),
    maxPendingFrames: 3,
    maxPendingBytes: 64,
  });

  assert.equal(queue.write(encoder.encode("one")), true);
  assert.equal(queue.write(encoder.encode("two")), true);
  assert.equal(queue.pendingFrames, 2);
  target.setDesiredSize(64);
  queue.flush();
  assert.deepEqual(target.chunks, ["one", "two"]);
  assert.equal(queue.pendingFrames, 0);
  assert.equal(queue.pendingBytes, 0);
});

test("SSE output overflow discards pending deltas, emits one reset and closes", () => {
  const target = fakeController(0);
  let overflowCount = 0;
  const queue = createBoundedRealtimeSseOutputQueue({
    controller: target.controller,
    overflowFrame: encoder.encode("id:\nevent: warning\ndata: snapshot_reset\n\n"),
    onOverflow: () => {
      overflowCount += 1;
    },
    maxPendingFrames: 2,
    maxPendingBytes: 64,
  });

  queue.write(encoder.encode("delta-one"));
  queue.write(encoder.encode("delta-two"));
  assert.equal(queue.write(encoder.encode("delta-overflow")), false);

  assert.equal(queue.overflowed, true);
  assert.equal(queue.closed, true);
  assert.equal(queue.pendingFrames, 0);
  assert.equal(queue.pendingBytes, 0);
  assert.equal(overflowCount, 1);
  assert.equal(target.closeCount, 1);
  assert.deepEqual(target.chunks, ["id:\nevent: warning\ndata: snapshot_reset\n\n"]);
  assert.equal(queue.write(encoder.encode("late")), false);
});

test("one oversized frame resets even when the downstream currently has capacity", () => {
  const target = fakeController(128);
  const queue = createBoundedRealtimeSseOutputQueue({
    controller: target.controller,
    overflowFrame: encoder.encode("snapshot_reset"),
    onOverflow: () => {},
    maxPendingFrames: 2,
    maxPendingBytes: 8,
  });

  assert.equal(queue.write(encoder.encode("larger-than-eight")), false);
  assert.equal(queue.overflowed, true);
  assert.deepEqual(target.chunks, ["snapshot_reset"]);
});

test("planned rotation drains the already bounded application queue before close", () => {
  const target = fakeController(0);
  const queue = createBoundedRealtimeSseOutputQueue({
    controller: target.controller,
    overflowFrame: encoder.encode("reset"),
    onOverflow: () => assert.fail("must not overflow"),
    maxPendingFrames: 3,
    maxPendingBytes: 64,
  });
  queue.write(encoder.encode("accepted-one"));
  queue.write(encoder.encode("accepted-two"));
  queue.close();
  assert.deepEqual(target.chunks, ["accepted-one", "accepted-two"]);
  assert.equal(target.closeCount, 1);
});

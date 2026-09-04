export type RealtimeSseOutputController = {
  readonly desiredSize: number | null;
  enqueue: (chunk: Uint8Array) => void;
  close: () => void;
};

export type RealtimeSseOutputQueueOptions = {
  controller: RealtimeSseOutputController;
  overflowFrame: Uint8Array;
  onOverflow: () => void;
  maxPendingFrames?: number;
  maxPendingBytes?: number;
};

/**
 * Keeps application-owned SSE output bounded once the browser or network stops
 * consuming. On overflow, queued deltas are discarded and a terminal reset
 * frame is emitted so EventSource reconnects from a fresh durable snapshot.
 */
export function createBoundedRealtimeSseOutputQueue(
  options: RealtimeSseOutputQueueOptions,
) {
  const maxPendingFrames = Math.max(1, Math.floor(options.maxPendingFrames ?? 256));
  const maxPendingBytes = Math.max(1, Math.floor(options.maxPendingBytes ?? 1024 * 1024));
  const pending: Uint8Array[] = [];
  let pendingBytes = 0;
  let closed = false;
  let overflowed = false;

  const clearPending = () => {
    pending.splice(0);
    pendingBytes = 0;
  };

  const enqueueNow = (chunk: Uint8Array) => {
    try {
      options.controller.enqueue(chunk);
      return true;
    } catch {
      closed = true;
      clearPending();
      return false;
    }
  };

  const terminateForOverflow = () => {
    if (closed) return;
    overflowed = true;
    clearPending();
    // The reset frame is intentionally allowed beyond normal backpressure. It
    // replaces every pending delta and is the only frame retained for recovery.
    enqueueNow(options.overflowFrame);
    try {
      options.controller.close();
    } catch {
      // A concurrent client cancellation may already have closed the stream.
    }
    closed = true;
    options.onOverflow();
  };

  const flush = () => {
    if (closed) return;
    while (pending.length > 0 && Number(options.controller.desiredSize || 0) > 0) {
      const next = pending.shift()!;
      pendingBytes -= next.byteLength;
      if (!enqueueNow(next)) return;
    }
  };

  const write = (chunk: Uint8Array) => {
    if (closed) return false;
    flush();
    if (chunk.byteLength > maxPendingBytes) {
      terminateForOverflow();
      return false;
    }
    if (pending.length === 0 && Number(options.controller.desiredSize || 0) > 0) {
      return enqueueNow(chunk);
    }
    if (
      pending.length + 1 > maxPendingFrames
      || pendingBytes + chunk.byteLength > maxPendingBytes
    ) {
      terminateForOverflow();
      return false;
    }
    pending.push(chunk);
    pendingBytes += chunk.byteLength;
    return true;
  };

  const close = () => {
    if (closed) return;
    // The application queue is already bounded. Drain it before a planned
    // rotation so accepted frames are not silently dropped at shutdown.
    while (pending.length > 0) {
      const next = pending.shift()!;
      pendingBytes -= next.byteLength;
      if (!enqueueNow(next)) return;
    }
    try {
      options.controller.close();
    } catch {
      // Reader cancellation can race the lifecycle timeout.
    }
    closed = true;
  };

  return {
    write,
    flush,
    close,
    get pendingFrames() {
      return pending.length;
    },
    get pendingBytes() {
      return pendingBytes;
    },
    get closed() {
      return closed;
    },
    get overflowed() {
      return overflowed;
    },
  };
}

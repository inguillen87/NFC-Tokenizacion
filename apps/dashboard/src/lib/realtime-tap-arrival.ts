import { dashboardRealtimeSnapshotConfirmsReady } from "./dashboard-realtime-buffer";
import { strictCoordinatePair } from "./geo-coordinates";

export type RealtimeTapArrival = {
  key: string;
  eventIds: string[];
  expiresAt: number;
};

export function realtimeTapArrivalIsVisible(
  frame: { newPhysicalTapArrival?: boolean; sequence: number; receivedAt: string },
  event: { tenantSlug?: string | null; occurredAt: string; lat?: number | null; lng?: number | null },
  view: { connected: boolean; active: boolean; snapshotSequence: number; tenant: string; windowStart: number; now: number },
) {
  const receivedAt = Date.parse(frame.receivedAt);
  return frame.newPhysicalTapArrival === true && view.connected && view.active
    && frame.sequence > view.snapshotSequence
    && Number.isFinite(receivedAt) && receivedAt <= view.now && view.now - receivedAt < 1_500
    && (!view.tenant || event.tenantSlug === view.tenant)
    && Date.parse(event.occurredAt) >= view.windowStart
    && strictCoordinatePair(event.lat, event.lng) !== null;
}

const PHYSICAL_TAP_TYPES = new Set(["TAP_VALID", "TAP_INVALID", "REPLAY_SUSPECT"]);
const MAX_RECENT_EVENTS = 256;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/** Presentation-only gate. Rejected animations must never reject event data. */
export function createRealtimeTapArrivalGate(expected: { tenant: string; window: string; source: string }) {
  let requestId = "";
  let connectedAt = Number.NaN;
  let latestArrivalAt = Number.NEGATIVE_INFINITY;
  let ready = false;
  const seen = new Set<string>();
  const remember = (id: string) => {
    seen.add(id);
    if (seen.size > MAX_RECENT_EVENTS) seen.delete(seen.values().next().value!);
  };
  return {
    pause() { ready = false; },
    connect(value: unknown) {
      const data = record(value);
      ready = false;
      requestId = String(data?.stream_request_id || "");
      connectedAt = data?.availability === "ready" ? Date.parse(String(data.ts || "")) : Number.NaN;
    },
    snapshot(value: unknown) {
      const data = record(value);
      ready = Boolean(data && requestId && Number.isFinite(connectedAt)
        && data.stream_request_id === requestId
        && dashboardRealtimeSnapshotConfirmsReady(data, expected));
      if (!ready || !Array.isArray(data?.rows)) return;
      for (const value of data.rows) {
        const id = String(record(value)?.eventId || "");
        if (id) remember(id);
      }
    },
    accept(value: unknown) {
      const data = record(value);
      if (!ready || !data || data.stream_request_id !== requestId) return false;
      const tenant = String(data.tenantSlug || "").trim().toLowerCase();
      if (!tenant || (expected.tenant && tenant !== expected.tenant)) return false;
      if (data.source !== "production" || data.eventSource !== "real" || expected.source === "demo") return false;
      const id = String(data.eventId || "");
      if (!id || seen.has(id)) return false;
      remember(id);
      const occurredAt = Date.parse(String(data.occurredAt || ""));
      const sentAt = Date.parse(String(data.stream_sent_at || ""));
      // A fresh server connection boundary rejects startup/history/replay and
      // updates to old reads, including same-id location enrichment. Late or
      // ambiguous deliveries remain valid data, just without an arrival cue.
      const accepted = PHYSICAL_TAP_TYPES.has(String(data.eventType || ""))
        && Number.isFinite(occurredAt) && Number.isFinite(sentAt)
        && occurredAt > Math.max(connectedAt, latestArrivalAt) && sentAt >= occurredAt
        && sentAt - occurredAt <= 30_000;
      // A monotonic timestamp guard also rejects duplicates after bounded ID
      // retention fills. Out-of-order/tied reads may safely omit a cue.
      if (accepted) latestArrivalAt = occurredAt;
      return accepted;
    },
  };
}

type MotionPreference = {
  matches: boolean;
  addEventListener: (type: "change", listener: () => void) => void;
  removeEventListener: (type: "change", listener: () => void) => void;
};

/** One finite, cancellable visual cue; no state updates, polling or recursion after expiry. */
export function startFiniteTapArrivalAnimation(options: {
  expiresAt: number;
  motion: MotionPreference;
  now: () => number;
  requestFrame: (callback: () => void) => number;
  cancelFrame: (id: number) => void;
  paint: (progress: number) => void;
  clear: () => void;
}) {
  const startedAt = options.now();
  const duration = Math.min(1_500, options.expiresAt - startedAt);
  let frame: number | null = null;
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (frame !== null) options.cancelFrame(frame);
    options.motion.removeEventListener("change", onMotionChange);
    options.clear();
  };
  const onMotionChange = () => { if (options.motion.matches) stop(); };
  if (options.motion.matches || duration <= 0) { stop(); return stop; }
  const tick = () => {
    if (stopped) return;
    const progress = Math.max(0, (options.now() - startedAt) / duration);
    if (progress >= 1) { stop(); return; }
    options.paint(progress);
    frame = options.requestFrame(tick);
  };
  options.motion.addEventListener("change", onMotionChange);
  tick();
  return stop;
}

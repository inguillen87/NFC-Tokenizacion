export type SequencedDashboardRealtimeFrame = {
  scopeKey: string;
  sequence: number;
};

export const DASHBOARD_REALTIME_EVENT_BUFFER_LIMIT = 256;

export type DashboardRealtimeEventBuffer<T extends SequencedDashboardRealtimeFrame> = {
  frames: T[];
  droppedThroughSequence: number;
};

export function appendDashboardRealtimeFrame<T extends SequencedDashboardRealtimeFrame>(
  current: readonly T[],
  frame: T,
  limit = DASHBOARD_REALTIME_EVENT_BUFFER_LIMIT,
): T[] {
  const boundedLimit = Math.max(1, Math.trunc(Number(limit) || DASHBOARD_REALTIME_EVENT_BUFFER_LIMIT));
  if (current.length < boundedLimit) return [...current, frame];
  return [...current.slice(current.length - boundedLimit + 1), frame];
}

export function unreadDashboardRealtimeFrames<T extends SequencedDashboardRealtimeFrame>(
  frames: readonly T[],
  afterSequence: number,
  scopeKey: string,
): T[] {
  return frames.filter((frame) => frame.scopeKey === scopeKey && frame.sequence > afterSequence);
}

export function appendDashboardRealtimeBuffer<T extends SequencedDashboardRealtimeFrame>(
  current: DashboardRealtimeEventBuffer<T>,
  frame: T,
  limit = DASHBOARD_REALTIME_EVENT_BUFFER_LIMIT,
): DashboardRealtimeEventBuffer<T> {
  const boundedLimit = Math.max(1, Math.trunc(Number(limit) || DASHBOARD_REALTIME_EVENT_BUFFER_LIMIT));
  const combined = [...current.frames, frame];
  if (combined.length <= boundedLimit) return { ...current, frames: combined };
  const dropped = combined.slice(0, combined.length - boundedLimit);
  return {
    frames: combined.slice(-boundedLimit),
    droppedThroughSequence: Math.max(
      current.droppedThroughSequence,
      dropped[dropped.length - 1]?.sequence || 0,
    ),
  };
}

export function dashboardRealtimeConsumerFellBehind(
  consumedThroughSequence: number,
  droppedThroughSequence: number,
) {
  return droppedThroughSequence > consumedThroughSequence;
}

export function dashboardRealtimeControlConfirmsReady(data: unknown) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  return String((data as { availability?: unknown }).availability || "").trim().toLowerCase() === "ready";
}

export function dashboardRealtimeSnapshotConfirmsReady(
  data: unknown,
  expected: { tenant: string; window: string; source: string },
) {
  if (!dashboardRealtimeControlConfirmsReady(data)) return false;
  const snapshot = data as {
    rows?: unknown;
    scope?: { tenant?: unknown; window?: unknown };
    source?: unknown;
  };
  if (!Array.isArray(snapshot.rows) || !snapshot.scope) return false;
  const expectedTenant = String(expected.tenant || "").trim().toLowerCase() || "global";
  return String(snapshot.scope.tenant || "").trim().toLowerCase() === expectedTenant
    && String(snapshot.scope.window || "").trim().toLowerCase() === String(expected.window || "").trim().toLowerCase()
    && String(snapshot.source || "").trim().toLowerCase() === String(expected.source || "").trim().toLowerCase();
}

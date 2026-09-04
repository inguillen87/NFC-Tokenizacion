export const REALTIME_STREAM_WINDOW_IDS = ["5m", "1h", "24h", "7d", "30d", "all"] as const;

export type RealtimeStreamWindowId = (typeof REALTIME_STREAM_WINDOW_IDS)[number];

export type RealtimeStreamWindow = {
  id: RealtimeStreamWindowId;
  interval: string;
  maxAgeMs: number | null;
};

const REALTIME_STREAM_WINDOWS: Record<RealtimeStreamWindowId, RealtimeStreamWindow> = {
  "5m": { id: "5m", interval: "5 minutes", maxAgeMs: 5 * 60 * 1_000 },
  "1h": { id: "1h", interval: "1 hour", maxAgeMs: 60 * 60 * 1_000 },
  "24h": { id: "24h", interval: "24 hours", maxAgeMs: 24 * 60 * 60 * 1_000 },
  "7d": { id: "7d", interval: "7 days", maxAgeMs: 7 * 24 * 60 * 60 * 1_000 },
  "30d": { id: "30d", interval: "30 days", maxAgeMs: 30 * 24 * 60 * 60 * 1_000 },
  all: { id: "all", interval: "", maxAgeMs: null },
};

export function resolveRealtimeStreamWindow(value: unknown): RealtimeStreamWindow | null {
  const candidate = String(value ?? "24h").trim().toLowerCase();
  if (!REALTIME_STREAM_WINDOW_IDS.includes(candidate as RealtimeStreamWindowId)) return null;
  return REALTIME_STREAM_WINDOWS[candidate as RealtimeStreamWindowId];
}

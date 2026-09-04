export type RealtimeJitterOptions = {
  jitterRatio?: number;
  random?: () => number;
};

/**
 * Adds bounded symmetric jitter so deploys or broker incidents do not make all
 * API instances reconnect or retry on the same millisecond boundary.
 */
export function resolveJitteredRealtimeDelay(
  baseDelayMs: number,
  options: RealtimeJitterOptions = {},
) {
  const base = Math.max(1, Math.floor(Number(baseDelayMs) || 1));
  const ratio = Math.min(0.5, Math.max(0, Number(options.jitterRatio ?? 0.2) || 0));
  const sampled = Number(options.random?.() ?? Math.random());
  const random = Number.isFinite(sampled) ? Math.min(1, Math.max(0, sampled)) : 0.5;
  const factor = 1 - ratio + (2 * ratio * random);
  return Math.max(1, Math.round(base * factor));
}

export const LIVE_DEMO_SUCCESS_POLL_MS = 4_000;
export const LIVE_DEMO_ERROR_RETRY_BASE_MS = 30_000;
export const LIVE_DEMO_ERROR_RETRY_MAX_MS = 60_000;
export const LIVE_DEMO_REQUEST_TIMEOUT_MS = 10_000;

export function liveDemoRetryDelay(failureCount: number): number {
  const normalizedFailureCount = Number.isFinite(failureCount)
    ? Math.max(1, Math.floor(failureCount))
    : 1;
  const exponentialDelay = LIVE_DEMO_ERROR_RETRY_BASE_MS * (2 ** (normalizedFailureCount - 1));

  return Math.min(exponentialDelay, LIVE_DEMO_ERROR_RETRY_MAX_MS);
}

export function hasLiveDemoItems(value: unknown): value is { items: unknown[] } {
  return typeof value === "object"
    && value !== null
    && Array.isArray((value as { items?: unknown }).items);
}

export const LIVE_DEMO_REQUEST_TIMEOUT_MS = 10_000;

export function hasLiveDemoItems(value: unknown): value is { items: unknown[] } {
  return typeof value === "object"
    && value !== null
    && Array.isArray((value as { items?: unknown }).items);
}

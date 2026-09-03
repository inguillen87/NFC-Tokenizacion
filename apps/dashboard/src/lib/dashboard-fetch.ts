export const DASHBOARD_FETCH_TIMEOUT_MS = 8_000;

/**
 * Runs dashboard network calls with one bounded AbortSignal while preserving a
 * caller-provided cancellation signal. This module is intentionally safe to
 * import from both server and client components.
 */
export async function dashboardFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DASHBOARD_FETCH_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const upstreamSignal = init.signal;
  const abortFromUpstream = () => controller.abort(upstreamSignal?.reason);

  if (upstreamSignal?.aborted) {
    abortFromUpstream();
  } else {
    upstreamSignal?.addEventListener("abort", abortFromUpstream, { once: true });
  }

  const timeout = setTimeout(() => {
    controller.abort(new DOMException("Dashboard request timed out", "TimeoutError"));
  }, Math.max(1, timeoutMs));

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
    upstreamSignal?.removeEventListener("abort", abortFromUpstream);
  }
}

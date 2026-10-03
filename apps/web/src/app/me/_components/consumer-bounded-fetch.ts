export const CONSUMER_READ_TIMEOUT_MS = 6_000;

export type ConsumerJsonResult =
  | { status: "ready"; data: unknown }
  | { status: "http-error"; httpStatus: number }
  | { status: "unavailable"; reason: "timeout" | "network" | "invalid-json" };

function cancelBody(response: Response | undefined) {
  try { void response?.body?.cancel().catch(() => {}); } catch { /* The reader may already own the body. */ }
}

/** One deadline covers both response headers and the complete JSON body. */
export async function fetchConsumerJson(
  url: string,
  init: Omit<RequestInit, "signal">,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<ConsumerJsonResult> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? CONSUMER_READ_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  let response: Response | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<ConsumerJsonResult>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      cancelBody(response);
      resolve({ status: "unavailable", reason: "timeout" });
    }, timeoutMs);
  });
  const request = (async (): Promise<ConsumerJsonResult> => {
    try {
      response = await fetchImpl(url, { ...init, signal: controller.signal });
      if (controller.signal.aborted) {
        cancelBody(response);
        return { status: "unavailable", reason: "timeout" };
      }
      if (!response.ok) {
        cancelBody(response);
        return { status: "http-error", httpStatus: response.status };
      }
      try {
        const data: unknown = await response.json();
        return controller.signal.aborted
          ? { status: "unavailable", reason: "timeout" }
          : { status: "ready", data };
      } catch {
        cancelBody(response);
        return { status: "unavailable", reason: controller.signal.aborted ? "timeout" : "invalid-json" };
      }
    } catch {
      return { status: "unavailable", reason: controller.signal.aborted ? "timeout" : "network" };
    }
  })();
  try {
    // Abort alone is insufficient when a transport or body reader ignores it.
    return await Promise.race([request, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export function consumerSessionState(result: ConsumerJsonResult): "authenticated" | "unauthenticated" | "unavailable" {
  if (result.status === "http-error") return result.httpStatus === 401 ? "unauthenticated" : "unavailable";
  if (result.status !== "ready" || !result.data || typeof result.data !== "object" || Array.isArray(result.data)) return "unavailable";
  const session = result.data as Record<string, unknown>;
  if (session.ok !== true || typeof session.authenticated !== "boolean") return "unavailable";
  return session.authenticated ? "authenticated" : "unauthenticated";
}

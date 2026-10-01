export const CONSUMER_REQUEST_TIMEOUT_MS = 12_000;

type ConsumerResponse =
  | { status: "received"; ok: boolean; httpStatus: number; payload: Record<string, unknown> | null }
  | { status: "unavailable"; reason: "timeout" | "connection" };

/** One request only: an interrupted mutation may already have reached the server. */
export async function requestConsumerJson(
  url: string,
  options: RequestInit = {},
  timeoutMs = CONSUMER_REQUEST_TIMEOUT_MS,
): Promise<ConsumerResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const body: unknown = await response.json().catch(() => null);
    if (controller.signal.aborted) return { status: "unavailable", reason: "timeout" };
    const payload = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
    return { status: "received", ok: response.ok, httpStatus: response.status, payload };
  } catch {
    return { status: "unavailable", reason: controller.signal.aborted ? "timeout" : "connection" };
  } finally {
    clearTimeout(timeout);
  }
}

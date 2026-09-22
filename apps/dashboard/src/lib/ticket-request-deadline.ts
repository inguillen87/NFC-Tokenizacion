/** One deadline covers both headers and JSON. Abort is not transport completion. */
export function readTicketResponse(
  fetcher: typeof fetch,
  url: string,
  options: RequestInit,
  controller: AbortController,
): Promise<{ response: Response; body: unknown }> {
  const { signal } = controller;
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      if (timer !== undefined) clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
    };
    const fail = (reason: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(reason);
    };
    const onAbort = () => fail(signal.reason ?? new DOMException("Ticket request canceled", "AbortError"));
    if (signal.aborted) { onAbort(); return; }
    signal.addEventListener("abort", onAbort, { once: true });
    timer = setTimeout(() => {
      controller.abort(new DOMException("Ticket request deadline exceeded", "TimeoutError"));
    }, 15_000);

    // Attach both handlers even if an injected transport throws or later rejects.
    // Domain parsing and writer state changes deliberately stay outside this task.
    const read = async () => {
      const response = await fetcher(url, { ...options, signal });
      if (signal.aborted) {
        // Best-effort disposal only: cancellation itself must never extend the deadline.
        void response.body?.cancel().catch(() => undefined);
        signal.throwIfAborted();
      }
      const body: unknown = await response.json().catch(() => null);
      signal.throwIfAborted();
      return { response, body };
    };
    read().then(result => {
      if (settled) return;
      if (signal.aborted) { onAbort(); return; }
      settled = true;
      cleanup();
      resolve(result);
    }, fail);
  });
}

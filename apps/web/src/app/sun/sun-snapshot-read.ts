import type { SunAvailability } from "./sun-availability";

export type SunReadResult = {
  availability: Extract<SunAvailability, "ready" | "inaccessible" | "unavailable">;
  contract: Record<string, unknown> | null;
};

const unavailable: SunReadResult = { availability: "unavailable", contract: null };
const MAX_BYTES = 1048576;

/** One bounded GET, including headers and streamed body. Never retries a scan. */
async function readSunJson(url: string, envelope: boolean, fetcher: typeof fetch, timeoutMs: number, headers?: HeadersInit): Promise<SunReadResult> {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 8000) return unavailable;
  const controller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<SunReadResult>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      void reader?.cancel().catch(() => {});
      resolve(unavailable);
    }, timeoutMs);
  });

  async function read(): Promise<SunReadResult> {
    const response = await fetcher(url, { method: "GET", cache: "no-store", redirect: "error", signal: controller.signal, headers });
    if (controller.signal.aborted || !response.ok || response.redirected) {
      void response.body?.cancel().catch(() => {});
      // Missing and inaccessible snapshots have the same public API answer.
      // Do not infer existence, expiry or a specific permission failure.
      return !controller.signal.aborted && [400, 401, 403, 404].includes(response.status)
        ? { availability: "inaccessible", contract: null }
        : unavailable;
    }
    if (!response.headers.get("content-type")?.includes("application/json") || Number(response.headers.get("content-length")) > MAX_BYTES || !response.body) {
      void response.body?.cancel().catch(() => {});
      return unavailable;
    }
    reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const part = await reader.read();
      if (controller.signal.aborted) return unavailable;
      if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_BYTES) return unavailable;
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    const contract = envelope ? (body?.ok === true ? body.contract : null) : body;
    if (!contract || typeof contract !== "object" || Array.isArray(contract)
      || typeof contract.status?.code !== "string" || !contract.status.code.trim()) return unavailable;
    return { availability: "ready", contract };
  }

  try { return await Promise.race([read(), deadline]); }
  catch { return unavailable; }
  finally {
    clearTimeout(timer);
    controller.abort();
    void reader?.cancel().catch(() => {});
    try { reader?.releaseLock(); } catch {}
  }
}

export function readSunSnapshotResult(url: string, fetcher: typeof fetch = fetch, timeoutMs = 8000): Promise<SunReadResult> {
  return readSunJson(url, true, fetcher, timeoutMs);
}

export function readSunPublicContract(url: string, headers?: HeadersInit, fetcher: typeof fetch = fetch, timeoutMs = 8000): Promise<SunReadResult> {
  return readSunJson(url, false, fetcher, timeoutMs, headers);
}

/** Compatibility for callers that need only the received snapshot contract. */
export async function readSunSnapshot(url: string, fetcher: typeof fetch = fetch, timeoutMs = 8000): Promise<Record<string, unknown> | null> {
  return (await readSunSnapshotResult(url, fetcher, timeoutMs)).contract;
}

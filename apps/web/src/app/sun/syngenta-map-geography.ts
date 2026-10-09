import type { GeoJSONSourceSpecification } from "maplibre-gl";

type Geography = Exclude<GeoJSONSourceSpecification["data"], string | undefined>;
const PATH = "/sun/valle-secreto/world-reference.geojson";
const MAX_BYTES = 230_000;
let geography: Promise<Geography> | null = null;

/** Public, local geography only. A point/reset/theme change must not cancel
 * the shared download or ask MapLibre to request it again from a new worker.
 * This cache contains no visitor location, permissions or conversation.
 */
export function loadSyngentaMapGeography(fetchImpl: typeof fetch = fetch, timeoutMs = 6_000): Promise<Geography> {
  if (geography) return geography;
  const request = (async () => {
    const signal = AbortSignal.timeout(Math.max(1, Math.min(6_000, timeoutMs)));
    const response = await fetchImpl(PATH, { credentials: "omit", referrerPolicy: "no-referrer", redirect: "error", cache: "force-cache", signal });
    if (!response.ok || !response.body) throw new Error("reference_map_unavailable");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    let reject: (reason: Error) => void = () => {};
    const stopped = new Promise<never>((_, stop) => { reject = stop; });
    const abort = () => { reject(new Error("reference_map_timeout")); void reader.cancel().catch(() => {}); };
    signal.addEventListener("abort", abort, { once: true });
    try {
      if (signal.aborted) throw new Error("reference_map_timeout");
      while (true) {
        const { value, done } = await Promise.race([reader.read(), stopped]);
        if (done) break;
        size += value.length;
        if (size > MAX_BYTES) throw new Error("reference_map_too_large");
        chunks.push(value);
      }
    } finally { signal.removeEventListener("abort", abort); void reader.cancel().catch(() => {}); reader.releaseLock(); }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!data || data.type !== "FeatureCollection" || !Array.isArray(data.features) || !data.features.length || data.features.length > 250) throw new Error("reference_map_invalid");
    return data as Geography;
  })();
  geography = request;
  void request.catch(() => { if (geography === request) geography = null; });
  return request;
}

import { productUrls } from "@product/config";
import { stripConsumerTapCapabilityCookies } from "./consumer-tap-handoff";
import { fetchRuntimeApi } from "./server-api-transport";

type Target = "/public/sommelier/demo/session" | "/sommelier/chat";
const PRIVATE_HEADERS = { "cache-control": "private, no-store", vary: "Cookie", "referrer-policy": "no-referrer" };
const fail = (status: number, error: string) => Response.json({ ok: false, error }, { status, headers: PRIVATE_HEADERS });

async function readBounded(stream: ReadableStream<Uint8Array> | null, max: number, input?: { signal: AbortSignal; timeoutMs: number }) {
  if (!stream) return "";
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectInput: (error: Error) => void = () => {};
  const stopped = new Promise<never>((_resolve, reject) => { rejectInput = reject; });
  const cancel = () => { rejectInput(new Error("input_timeout")); void reader.cancel().catch(() => {}); };
  if (input) {
    input.signal.addEventListener("abort", cancel, { once: true });
    timer = setTimeout(cancel, input.timeoutMs);
  }
  try {
    if (input?.signal.aborted) { void reader.cancel().catch(() => {}); throw new Error("input_timeout"); }
    while (true) {
      const { value, done } = await Promise.race([reader.read(), stopped]);
      if (done) break;
      size += value.byteLength;
      if (size > max) { void reader.cancel().catch(() => {}); throw new Error("too_large"); }
      chunks.push(value);
    }
  } finally { if (timer) clearTimeout(timer); input?.signal.removeEventListener("abort", cancel); reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

/** Stateless BFF. Only API authenticates grants, facts, tenants and distributed spend. */
export async function proxySommelierRequest(req: Request, target: Target, options: { fetchImpl?: typeof fetch; apiBase?: string; timeoutMs?: number } = {}) {
  const origin = new URL(req.url).origin;
  if (req.method !== "POST" || req.headers.get("origin") !== origin
    || (req.headers.has("sec-fetch-site") && req.headers.get("sec-fetch-site") !== "same-origin")) return fail(403, "forbidden");
  if (req.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") return fail(415, "unsupported_media_type");
  const length = req.headers.get("content-length");
  if (length !== null && (!/^[0-9]+$/.test(length) || Number(length) > 12_288)) return fail(413, "payload_too_large");
  let body: string;
  try { body = await readBounded(req.body, 12_288, { signal: req.signal, timeoutMs: Math.min(2_000, options.timeoutMs ?? 2_000) }); }
  catch (error) { return error instanceof Error && error.message === "too_large" ? fail(413, "payload_too_large") : fail(408, "request_body_unavailable"); }
  let base: URL;
  try {
    base = new URL(options.apiBase ?? process.env.SOMMELIER_API_BASE_URL ?? productUrls.api);
    if (base.username || base.password || base.search || base.hash || base.pathname !== "/"
      || (base.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && /^localhost$|^127\.0\.0\.1$/.test(base.hostname)))) return fail(503, "service_unavailable");
  } catch { return fail(503, "service_unavailable"); }
  const headers: Record<string, string> = { "content-type": "application/json", origin, "sec-fetch-site": "same-origin" };
  const cookies = stripConsumerTapCapabilityCookies(req.headers.get("cookie"));
  if (cookies) headers.cookie = cookies;
  for (const name of ["authorization", "user-agent", "x-forwarded-for", "x-real-ip"]) {
    const value = req.headers.get(name);
    if (value) headers[name] = value;
  }
  const controller = new AbortController();
  let upstream: Response | undefined;
  let interrupt: (value: Response) => void = () => {};
  const interrupted = new Promise<Response>(resolve => { interrupt = resolve; });
  const cancel = () => {
    controller.abort();
    try { void upstream?.body?.cancel().catch(() => {}); } catch { /* reader may hold body */ }
    interrupt(fail(503, "service_unavailable"));
  };
  if (req.signal.aborted) return fail(503, "service_unavailable");
  req.signal.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(cancel, options.timeoutMs ?? 11_000);
  const forward = (async () => {
    try {
      upstream = await (options.fetchImpl ?? fetchRuntimeApi)(new URL(target, base).href, { method: "POST", headers, body, cache: "no-store", signal: controller.signal });
      if (controller.signal.aborted) { void upstream.body?.cancel().catch(() => {}); return interrupted; }
      const text = await readBounded(upstream.body, 24_576, { signal: controller.signal, timeoutMs: options.timeoutMs ?? 11_000 });
      if (controller.signal.aborted) return interrupted;
      const response = new Response(text, { status: upstream.status, headers: { ...PRIVATE_HEADERS, "content-type": "application/json" } });
      const retry = upstream.headers.get("retry-after");
      if (retry && /^[0-9]{1,6}$/.test(retry)) response.headers.set("retry-after", retry);
      const setCookies = (upstream.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [upstream.headers.get("set-cookie") || ""];
      for (const cookie of setCookies) {
        if (!/^(?:__Host-nexid_sommelier_demo|nexid_sommelier_demo|__Host-nexid_syngenta_demo|nexid_syngenta_demo)=/.test(cookie) || !/;\s*HttpOnly(?:;|$)/i.test(cookie) || !/;\s*Path=\/(?:;|$)/i.test(cookie)) continue;
        if (origin.startsWith("https:") && !/;\s*Secure(?:;|$)/i.test(cookie)) continue;
        response.headers.append("set-cookie", cookie.replace(/;\s*Domain=[^;]+/gi, ""));
      }
      return response;
    } catch { return fail(503, "service_unavailable"); }
  })();
  try { return await Promise.race([forward, interrupted]); }
  finally { clearTimeout(timer); req.signal.removeEventListener("abort", cancel); }
}

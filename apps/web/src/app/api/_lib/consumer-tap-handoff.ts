export const CONSUMER_TAP_CAPABILITY_COOKIE_PREFIX = "__Host-nexid_tap_";
const DEV_COOKIE_PREFIX = "nexid_tap_";
const MAX_STORED_CAPABILITIES = 3;
const MAX_BODY_BYTES = 8 * 1024;
const MAX_TOKEN_CHARS = 3400;
const EVENT_ID = /^[1-9][0-9]{0,18}$/;
const CAPABILITY_FIELDS = ["fresh_token", "freshToken", "sun_fresh", "sunFresh"] as const;
const ACTION_PATH = /^\/mobile\/passport\/([1-9][0-9]{0,18})\/(?:consumer\/(?:save-product|join-tenant|claim)|loyalty\/enroll)$/;

type JsonRecord = Record<string, unknown>;
type Forward = (req: Request, targetPath: string) => Promise<Response>;

function privateHeaders() {
  return { "cache-control": "private, no-store", vary: "Cookie", "referrer-policy": "no-referrer" };
}

function failure(error: string, status: number) {
  return Response.json({ ok: false, error }, { status, headers: privateHeaders() });
}

function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const fetchSite = req.headers.get("sec-fetch-site");
  return origin === new URL(req.url).origin
    && (!fetchSite || fetchSite === "same-origin");
}

async function boundedJson(req: Request): Promise<JsonRecord> {
  if (req.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    throw new Error("json_content_type_required");
  }
  const length = req.headers.get("content-length");
  if (length !== null && (!/^[0-9]+$/.test(length) || Number(length) > MAX_BODY_BYTES)) {
    throw new Error("request_body_too_large");
  }
  if (!req.body) throw new Error("invalid_json");
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new Error("request_body_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_json");
  return value as JsonRecord;
}

function bodyFailure(error: unknown) {
  const reason = error instanceof Error ? error.message : "invalid_json";
  return failure(reason === "request_body_too_large" ? reason : reason === "json_content_type_required" ? reason : "invalid_json",
    reason === "request_body_too_large" ? 413 : reason === "json_content_type_required" ? 415 : 400);
}

/** Shape/expiry checks only. The API must authenticate and consume this token. */
export function inspectConsumerTapCapability(token: unknown, eventId: string, nowMs = Date.now()) {
  if (typeof token !== "string" || token.length > MAX_TOKEN_CHARS || !EVENT_ID.test(eventId)) return null;
  const match = /^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match) return null;
  try {
    const bytes = Buffer.from(match[1], "base64url");
    if (bytes.toString("base64url") !== match[1]) return null;
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const payload = value as JsonRecord;
    const now = Math.floor(nowMs / 1000);
    if (!Number.isSafeInteger(now) || payload.purpose !== "sun_fresh_handoff" || payload.eventId !== eventId
      || typeof payload.iat !== "number" || !Number.isSafeInteger(payload.iat)
      || typeof payload.exp !== "number" || !Number.isSafeInteger(payload.exp)
      || payload.iat < 0 || payload.iat > now + 60 || payload.exp <= now
      || payload.exp <= payload.iat || payload.exp - payload.iat > 300) return null;
    return { issuedAt: payload.iat, expiresAt: payload.exp, maxAge: Math.min(300, payload.exp - now) };
  } catch { return null; }
}

function parsedCookies(value: string | null) {
  return (value || "").split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf("=");
    return { part, name: (index < 0 ? part : part.slice(0, index)).trim(), value: index < 0 ? "" : part.slice(index + 1) };
  });
}

/** Capabilities belong to the web bridge, never to unrelated API/SSR requests. */
export function stripConsumerTapCapabilityCookies(value: string | null) {
  return parsedCookies(value).filter(({ name }) => !name.startsWith(CONSUMER_TAP_CAPABILITY_COOKIE_PREFIX)
    && !name.startsWith(DEV_COOKIE_PREFIX)).map(({ part }) => part).join("; ");
}

function cookieConfiguration(req: Request) {
  const url = new URL(req.url);
  const localDevelopment = process.env.NODE_ENV !== "production" && !process.env.VERCEL
    && url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  return { prefix: localDevelopment ? DEV_COOKIE_PREFIX : CONSUMER_TAP_CAPABILITY_COOKIE_PREFIX, secure: !localDevelopment };
}

function serializeCookie(name: string, value: string, maxAge: number, secure: boolean) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

export async function prepareConsumerTapHandoff(req: Request, nowMs = Date.now()) {
  if (req.method !== "POST") return failure("method_not_allowed", 405);
  if (!sameOrigin(req)) return failure("same_origin_required", 403);
  let body: JsonRecord;
  try { body = await boundedJson(req); } catch (error) { return bodyFailure(error); }
  const eventId = typeof body.eventId === "string" ? body.eventId : "";
  const inspected = inspectConsumerTapCapability(body.freshToken, eventId, nowMs);
  if (!inspected) return failure("tap_handoff_invalid_or_expired", 400);
  const { prefix, secure } = cookieConfiguration(req);
  const cookieName = `${prefix}${eventId}`;
  const existing = parsedCookies(req.headers.get("cookie")).filter(({ name }) => name.startsWith(prefix)
    && EVENT_ID.test(name.slice(prefix.length)));
  if (new Set(existing.map(({ name }) => name)).size !== existing.length) return failure("tap_capability_ambiguous", 400);
  const candidates = existing.filter(({ name }) => name !== cookieName).map((cookie) => ({
    ...cookie, inspected: inspectConsumerTapCapability(cookie.value, cookie.name.slice(prefix.length), nowMs),
  }));
  const keep = new Set(candidates.filter((cookie) => cookie.inspected)
    .sort((a, b) => b.inspected!.issuedAt - a.inspected!.issuedAt)
    .slice(0, MAX_STORED_CAPABILITIES - 1).map(({ name }) => name));
  const response = Response.json({ ok: true, eventId, expiresAt: new Date(inspected.expiresAt * 1000).toISOString() },
    { headers: privateHeaders() });
  for (const cookie of candidates) {
    if (!keep.has(cookie.name)) response.headers.append("set-cookie", serializeCookie(cookie.name, "", 0, secure));
  }
  response.headers.append("set-cookie", serializeCookie(cookieName, body.freshToken as string, inspected.maxAge, secure));
  return response;
}

/** Relay one explicit action; cookie custody never grants identity or authority. */
export async function proxyConsumerTapAction(req: Request, targetPath: string, forward: Forward, nowMs = Date.now()) {
  const match = ACTION_PATH.exec(targetPath);
  if (req.method !== "POST" || !match || new URL(req.url).pathname !== `/api${targetPath}`) {
    return failure("tap_action_not_allowed", 404);
  }
  if (!sameOrigin(req)) return failure("same_origin_required", 403);
  const { prefix } = cookieConfiguration(req);
  const cookies = parsedCookies(req.headers.get("cookie")).filter(({ name }) => name === `${prefix}${match[1]}`);
  if (cookies.length > 1) return failure("tap_capability_ambiguous", 400);
  let body: JsonRecord;
  try { body = await boundedJson(req); } catch (error) { return bodyFailure(error); }
  // An explicit body capability wins even when malformed: never silently replace
  // a caller's failed credential with a different browser credential.
  if (!CAPABILITY_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(body, field)) && cookies.length === 1) {
    const token = cookies[0].value;
    if (inspectConsumerTapCapability(token, match[1], nowMs)) body.fresh_token = token;
  }
  const headers = new Headers(req.headers);
  headers.set("cookie", stripConsumerTapCapabilityCookies(req.headers.get("cookie")));
  headers.delete("content-length");
  const forwarded = new Request(req.url, { method: "POST", headers, body: JSON.stringify(body), signal: req.signal });
  const upstream = await forward(forwarded, targetPath);
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.set("cache-control", "private, no-store");
  const vary = (responseHeaders.get("vary") || "").split(",").map((part) => part.trim()).filter(Boolean);
  if (!vary.some((part) => part.toLowerCase() === "cookie")) vary.push("Cookie");
  responseHeaders.set("vary", vary.join(", "));
  responseHeaders.set("referrer-policy", "no-referrer");
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders });
}

import { createHmac, timingSafeEqual } from "node:crypto";

export type SunFreshHandoffPayload = {
  purpose: "sun_fresh_handoff";
  bid: string;
  eventId: string;
  diagnosticId: number;
  traceId: string;
  iat: number;
  exp: number;
};

type FreshExpected = {
  bid?: string | null;
  eventId?: string | number | null;
  diagnosticId?: string | number | null;
  traceId?: string | null;
};

function secret() {
  const value =
    process.env.SUN_HANDOFF_SECRET ||
    process.env.PUBLIC_DEMO_SHARE_SECRET ||
    process.env.ADMIN_API_KEY ||
    process.env.TOKENIZATION_UID_SALT;
  if (!value) throw new Error("SUN_HANDOFF_SECRET or PUBLIC_DEMO_SHARE_SECRET is required");
  return value;
}

function encode(input: unknown) {
  return Buffer.from(JSON.stringify(input), "utf8").toString("base64url");
}

function decode(input: string) {
  return JSON.parse(Buffer.from(input, "base64url").toString("utf8")) as SunFreshHandoffPayload;
}

function sign(body: string) {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

function safeEquals(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function clean(value: unknown) {
  return String(value || "").trim();
}

export function createSunFreshHandoffToken(input: Omit<SunFreshHandoffPayload, "purpose" | "iat"> & { iat?: number }) {
  const now = Math.floor(Date.now() / 1000);
  const payload: SunFreshHandoffPayload = {
    purpose: "sun_fresh_handoff",
    bid: clean(input.bid),
    eventId: clean(input.eventId),
    diagnosticId: Number(input.diagnosticId),
    traceId: clean(input.traceId),
    iat: Number(input.iat || now),
    exp: Number(input.exp),
  };
  if (!payload.bid || !payload.eventId || !payload.traceId || !Number.isFinite(payload.diagnosticId) || payload.diagnosticId <= 0) {
    throw new Error("invalid sun fresh handoff payload");
  }
  if (!Number.isFinite(payload.exp) || payload.exp <= now) {
    throw new Error("invalid sun fresh handoff expiry");
  }
  const body = encode(payload);
  return `${body}.${sign(body)}`;
}

export function verifySunFreshHandoffToken(token: string | null | undefined, expected: FreshExpected = {}) {
  if (!token) return { ok: false as const, reason: "fresh_token_missing" };
  const [body, signature] = String(token).split(".");
  if (!body || !signature) return { ok: false as const, reason: "fresh_token_malformed" };

  let expectedSignature = "";
  try {
    expectedSignature = sign(body);
  } catch {
    return { ok: false as const, reason: "fresh_token_secret_missing" };
  }
  if (!safeEquals(signature, expectedSignature)) return { ok: false as const, reason: "fresh_token_invalid_signature" };

  try {
    const payload = decode(body);
    const now = Math.floor(Date.now() / 1000);
    if (payload.purpose !== "sun_fresh_handoff") return { ok: false as const, reason: "fresh_token_wrong_purpose" };
    if (!payload.bid || !payload.eventId || !payload.traceId || !payload.exp) return { ok: false as const, reason: "fresh_token_incomplete" };
    if (payload.exp < now) return { ok: false as const, reason: "fresh_token_expired" };
    if (expected.bid && payload.bid !== clean(expected.bid)) return { ok: false as const, reason: "fresh_token_bid_mismatch" };
    if (expected.eventId && payload.eventId !== clean(expected.eventId)) return { ok: false as const, reason: "fresh_token_event_mismatch" };
    if (expected.traceId && payload.traceId !== clean(expected.traceId)) return { ok: false as const, reason: "fresh_token_trace_mismatch" };
    if (expected.diagnosticId && payload.diagnosticId !== Number(expected.diagnosticId)) {
      return { ok: false as const, reason: "fresh_token_snapshot_mismatch" };
    }
    return { ok: true as const, payload };
  } catch {
    return { ok: false as const, reason: "fresh_token_invalid_body" };
  }
}

export function extractSunFreshToken(req: Request, body?: Record<string, unknown>) {
  const fromBody = clean(body?.fresh_token || body?.freshToken || body?.sun_fresh || body?.sunFresh);
  if (fromBody) return fromBody;
  try {
    const url = new URL(req.url);
    return clean(url.searchParams.get("fresh") || url.searchParams.get("fresh_token") || url.searchParams.get("sun_fresh"));
  } catch {
    return "";
  }
}

export function requireSunFreshHandoff(req: Request, body: Record<string, unknown>, expected: FreshExpected) {
  const token = extractSunFreshToken(req, body);
  return verifySunFreshHandoffToken(token, expected);
}

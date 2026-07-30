import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { hitSunRateLimit } from "./sun-rate-limit-store";

export type SunFreshHandoffPayload = {
  purpose: "sun_fresh_handoff";
  bid: string;
  eventId: string;
  uid: string;
  uidBinding?: string | null;
  readCounter?: number | null;
  diagnosticId: number;
  traceId: string;
  iat: number;
  exp: number;
};

type FreshExpected = {
  bid?: string | null;
  eventId?: string | number | null;
  uid?: string | null;
  diagnosticId?: string | number | null;
  traceId?: string | null;
  uidHex?: string | null;
  readCounter?: string | number | null;
};

function legacyFallbackEnabled() {
  return String(process.env.SUN_HANDOFF_ALLOW_LEGACY_SECRET_FALLBACK || "").trim().toLowerCase() === "true";
}

function productionRuntime() {
  return [process.env.VERCEL_ENV, process.env.NODE_ENV]
    .some((value) => String(value || "").trim().toLowerCase() === "production");
}

function strongEnough(secret: string) {
  return Buffer.byteLength(secret, "utf8") >= 32;
}

function legacySecrets() {
  if (!legacyFallbackEnabled()) return [];
  return [process.env.PUBLIC_DEMO_SHARE_SECRET, process.env.ADMIN_API_KEY, process.env.TOKENIZATION_UID_SALT]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function signingSecret() {
  const value = String(process.env.SUN_HANDOFF_SECRET || "").trim() || legacySecrets()[0] || "";
  if (!value) throw new Error("SUN_HANDOFF_SECRET is required");
  if (productionRuntime() && !strongEnough(value)) {
    throw new Error("SUN_HANDOFF_SECRET must be at least 32 bytes in production");
  }
  return value;
}

function verificationSecrets() {
  return [...new Set([
    String(process.env.SUN_HANDOFF_SECRET || "").trim(),
    String(process.env.SUN_HANDOFF_SECRET_PREVIOUS || "").trim(),
    ...legacySecrets(),
  ].filter(Boolean))];
}

function encode(input: unknown) {
  return Buffer.from(JSON.stringify(input), "utf8").toString("base64url");
}

function decode(input: string) {
  return JSON.parse(Buffer.from(input, "base64url").toString("utf8")) as SunFreshHandoffPayload;
}

function sign(body: string, secret: string) {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

function uidBinding(uid: unknown, secret = signingSecret()) {
  const normalized = clean(uid).replace(/[^a-fA-F0-9]/g, "").toUpperCase();
  if (!normalized) return null;
  return createHmac("sha256", secret).update(`sun-fresh-uid-v1\0${normalized}`, "utf8").digest("base64url");
}

function safeEquals(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function clean(value: unknown) {
  return String(value || "").trim();
}

function eventBoundUid(eventId: unknown) {
  return `EVENT-${clean(eventId)}`.toUpperCase();
}

type SunFreshHandoffInput = Omit<SunFreshHandoffPayload, "purpose" | "iat" | "uid" | "uidBinding" | "readCounter"> & {
  iat?: number;
  uidHex?: string | null;
  readCounter?: number | null;
};

export function createSunFreshHandoffToken(input: SunFreshHandoffInput) {
  const now = Math.floor(Date.now() / 1000);
  const activeSecret = signingSecret();
  const payload: SunFreshHandoffPayload = {
    purpose: "sun_fresh_handoff",
    bid: clean(input.bid),
    eventId: clean(input.eventId),
    uid: eventBoundUid(input.eventId),
    uidBinding: input.uidHex ? uidBinding(input.uidHex, activeSecret) : null,
    readCounter: Number.isSafeInteger(input.readCounter) && Number(input.readCounter) >= 0 ? Number(input.readCounter) : null,
    diagnosticId: Number(input.diagnosticId),
    traceId: clean(input.traceId),
    iat: Number(input.iat || now),
    exp: Number(input.exp),
  };
  if (!payload.bid || !payload.eventId || !payload.uid || !payload.traceId || !Number.isFinite(payload.diagnosticId) || payload.diagnosticId <= 0) {
    throw new Error("invalid sun fresh handoff payload");
  }
  if (!Number.isFinite(payload.exp) || payload.exp <= now) {
    throw new Error("invalid sun fresh handoff expiry");
  }
  const body = encode(payload);
  return `${body}.${sign(body, activeSecret)}`;
}

export function verifySunFreshHandoffToken(token: string | null | undefined, expected: FreshExpected = {}) {
  if (!token) return { ok: false as const, reason: "fresh_token_missing" };
  const [body, signature] = String(token).split(".");
  if (!body || !signature) return { ok: false as const, reason: "fresh_token_malformed" };

  const secrets = verificationSecrets();
  if (!secrets.length) {
    return { ok: false as const, reason: "fresh_token_secret_missing" };
  }
  if (productionRuntime() && !secrets.some(strongEnough)) {
    return { ok: false as const, reason: "fresh_token_secret_too_short" };
  }
  const eligibleSecrets = productionRuntime() ? secrets.filter(strongEnough) : secrets;
  const matchedSecret = eligibleSecrets.find((candidate) => safeEquals(signature, sign(body, candidate)));
  if (!matchedSecret) return { ok: false as const, reason: "fresh_token_invalid_signature" };

  try {
    const payload = decode(body);
    const now = Math.floor(Date.now() / 1000);
    if (payload.purpose !== "sun_fresh_handoff") return { ok: false as const, reason: "fresh_token_wrong_purpose" };
    if (!payload.bid || !payload.eventId || !payload.uid || !payload.traceId || !payload.exp) {
      return { ok: false as const, reason: "fresh_token_incomplete" };
    }
    if (payload.uid !== eventBoundUid(payload.eventId)) {
      return { ok: false as const, reason: "fresh_token_uid_not_event_bound" };
    }
    if (payload.exp < now) return { ok: false as const, reason: "fresh_token_expired" };
    if (expected.bid && payload.bid !== clean(expected.bid)) return { ok: false as const, reason: "fresh_token_bid_mismatch" };
    if (expected.eventId && payload.eventId !== clean(expected.eventId)) return { ok: false as const, reason: "fresh_token_event_mismatch" };
    if (expected.uid && payload.uid !== clean(expected.uid).toUpperCase()) return { ok: false as const, reason: "fresh_token_uid_mismatch" };
    if (expected.uidHex) {
      const expectedBinding = uidBinding(expected.uidHex, matchedSecret);
      if (!payload.uidBinding || !expectedBinding || payload.uidBinding !== expectedBinding) {
        return { ok: false as const, reason: "fresh_token_tag_binding_mismatch" };
      }
    }
    if (expected.readCounter !== undefined && expected.readCounter !== null) {
      const expectedCounter = Number(expected.readCounter);
      if (!Number.isSafeInteger(expectedCounter) || expectedCounter < 0 || payload.readCounter !== expectedCounter) {
        return { ok: false as const, reason: "fresh_token_counter_mismatch" };
      }
    }
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

/**
 * Verifies and atomically consumes a fresh-tap capability for one named action.
 * A single tap may authorize distinct actions, but each action can consume that
 * capability only once. The raw signed token never reaches durable storage.
 */
export async function consumeSunFreshHandoff(
  req: Request,
  body: Record<string, unknown>,
  expected: FreshExpected,
  action: string,
) {
  const token = extractSunFreshToken(req, body);
  const verified = verifySunFreshHandoffToken(token, expected);
  if (!verified.ok) return verified;
  const normalizedAction = clean(action).toLowerCase();
  if (!/^[a-z0-9:_-]{1,120}$/.test(normalizedAction)) {
    return { ok: false as const, reason: "fresh_token_action_invalid" };
  }
  const now = Math.floor(Date.now() / 1000);
  const ttlSeconds = Math.max(1, Math.min(10 * 60, verified.payload.exp - now + 5));
  const digest = createHash("sha256").update(token, "utf8").digest("hex");
  try {
    const reservation = await hitSunRateLimit(
      "sun_fresh_capability_once",
      `${normalizedAction}:${digest}`,
      ttlSeconds,
      1,
    );
    if (reservation.unavailable) return { ok: false as const, reason: "fresh_token_consume_unavailable" };
    if (reservation.limited) return { ok: false as const, reason: "fresh_token_already_used" };
    return verified;
  } catch {
    return { ok: false as const, reason: "fresh_token_consume_unavailable" };
  }
}

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { hitSunRateLimit } from "./sun-rate-limit-store";

const SNAPSHOT_ACCESS_MAX_TTL_SECONDS = 15 * 60;
const FRESH_HANDOFF_MAX_TTL_SECONDS = 5 * 60;
const TOKEN_CLOCK_SKEW_SECONDS = 60;

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

export type SunSnapshotAccessPayload = {
  purpose: "sun_snapshot_access";
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

function decodeSnapshotAccess(input: string) {
  return JSON.parse(Buffer.from(input, "base64url").toString("utf8")) as SunSnapshotAccessPayload;
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
    iat: Number(input.iat ?? now),
    exp: Number(input.exp),
  };
  if (
    !payload.bid
    || !payload.eventId
    || !payload.uid
    || !payload.traceId
    || payload.traceId.length > 128
    || !Number.isSafeInteger(payload.diagnosticId)
    || payload.diagnosticId <= 0
  ) {
    throw new Error("invalid sun fresh handoff payload");
  }
  if (
    !Number.isSafeInteger(payload.iat)
    || payload.iat <= 0
    || payload.iat > now + TOKEN_CLOCK_SKEW_SECONDS
    || !Number.isSafeInteger(payload.exp)
    || payload.exp <= now
    || payload.exp <= payload.iat
    || payload.exp - payload.iat > FRESH_HANDOFF_MAX_TTL_SECONDS
  ) {
    throw new Error("invalid sun fresh handoff expiry");
  }
  const body = encode(payload);
  return `${body}.${sign(body, activeSecret)}`;
}

export function verifySunFreshHandoffToken(token: string | null | undefined, expected: FreshExpected = {}) {
  if (!token) return { ok: false as const, reason: "fresh_token_missing" };
  const tokenParts = String(token).split(".");
  if (tokenParts.length !== 2) return { ok: false as const, reason: "fresh_token_malformed" };
  const [body, signature] = tokenParts;
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
    if (
      typeof payload.bid !== "string"
      || !payload.bid
      || typeof payload.eventId !== "string"
      || !payload.eventId
      || typeof payload.uid !== "string"
      || !payload.uid
      || typeof payload.traceId !== "string"
      || !payload.traceId
      || payload.traceId.length > 128
      || !Number.isSafeInteger(payload.diagnosticId)
      || payload.diagnosticId <= 0
      || !Number.isSafeInteger(payload.iat)
      || payload.iat <= 0
      || !Number.isSafeInteger(payload.exp)
      || (payload.uidBinding !== undefined && payload.uidBinding !== null && typeof payload.uidBinding !== "string")
      || (payload.readCounter !== undefined && payload.readCounter !== null
        && (!Number.isSafeInteger(payload.readCounter) || payload.readCounter < 0))
    ) {
      return { ok: false as const, reason: "fresh_token_incomplete" };
    }
    if (payload.uid !== eventBoundUid(payload.eventId)) {
      return { ok: false as const, reason: "fresh_token_uid_not_event_bound" };
    }
    if (payload.iat > now + TOKEN_CLOCK_SKEW_SECONDS) return { ok: false as const, reason: "fresh_token_not_yet_valid" };
    if (payload.exp <= payload.iat || payload.exp - payload.iat > FRESH_HANDOFF_MAX_TTL_SECONDS) {
      return { ok: false as const, reason: "fresh_token_invalid_lifetime" };
    }
    if (payload.exp <= now) return { ok: false as const, reason: "fresh_token_expired" };
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

/**
 * Read-only capability for a single diagnostic snapshot. Diagnostic ids are
 * sequential and trace ids are operational correlation values, so neither is
 * an authorization secret. This token binds both values and expires without
 * granting any commercial action.
 */
export function createSunSnapshotAccessToken(input: {
  diagnosticId: string | number;
  traceId: string;
  exp?: number;
  iat?: number;
}) {
  const now = Math.floor(Date.now() / 1000);
  const payload: SunSnapshotAccessPayload = {
    purpose: "sun_snapshot_access",
    diagnosticId: Number(input.diagnosticId),
    traceId: clean(input.traceId),
    iat: Number(input.iat ?? now),
    exp: Number(input.exp ?? now + SNAPSHOT_ACCESS_MAX_TTL_SECONDS),
  };
  if (!Number.isSafeInteger(payload.diagnosticId) || payload.diagnosticId <= 0 || !payload.traceId || payload.traceId.length > 128) {
    throw new Error("invalid sun snapshot access payload");
  }
  if (
    !Number.isSafeInteger(payload.iat)
    || payload.iat <= 0
    || payload.iat > now + TOKEN_CLOCK_SKEW_SECONDS
    || !Number.isSafeInteger(payload.exp)
    || payload.exp <= now
    || payload.exp <= payload.iat
    || payload.exp - payload.iat > SNAPSHOT_ACCESS_MAX_TTL_SECONDS
  ) {
    throw new Error("invalid sun snapshot access expiry");
  }
  const body = encode(payload);
  return `snap1.${body}.${sign(`snapshot:${body}`, signingSecret())}`;
}

export function verifySunSnapshotAccessToken(
  token: string | null | undefined,
  expected: { diagnosticId: string | number; traceId: string },
) {
  const candidate = clean(token);
  if (candidate.length > 4096 || clean(expected.traceId).length > 128) {
    return { ok: false as const, reason: "snapshot_token_malformed" };
  }
  const tokenParts = candidate.split(".");
  if (tokenParts.length !== 3) return { ok: false as const, reason: "snapshot_token_malformed" };
  const [version, body, signature] = tokenParts;
  if (version !== "snap1" || !body || !signature) {
    return { ok: false as const, reason: candidate ? "snapshot_token_malformed" : "snapshot_token_missing" };
  }

  const secrets = verificationSecrets();
  if (!secrets.length) return { ok: false as const, reason: "snapshot_token_secret_missing" };
  if (productionRuntime() && !secrets.some(strongEnough)) {
    return { ok: false as const, reason: "snapshot_token_secret_too_short" };
  }
  const eligibleSecrets = productionRuntime() ? secrets.filter(strongEnough) : secrets;
  if (!eligibleSecrets.some((secret) => safeEquals(signature, sign(`snapshot:${body}`, secret)))) {
    return { ok: false as const, reason: "snapshot_token_invalid_signature" };
  }

  try {
    const payload = decodeSnapshotAccess(body);
    const now = Math.floor(Date.now() / 1000);
    if (payload.purpose !== "sun_snapshot_access") return { ok: false as const, reason: "snapshot_token_wrong_purpose" };
    if (
      !Number.isSafeInteger(payload.diagnosticId)
      || payload.diagnosticId <= 0
      || !payload.traceId
      || payload.traceId.length > 128
      || !Number.isSafeInteger(payload.iat)
      || payload.iat <= 0
      || !Number.isSafeInteger(payload.exp)
    ) {
      return { ok: false as const, reason: "snapshot_token_incomplete" };
    }
    if (payload.iat > now + TOKEN_CLOCK_SKEW_SECONDS) return { ok: false as const, reason: "snapshot_token_not_yet_valid" };
    if (payload.exp <= payload.iat || payload.exp - payload.iat > SNAPSHOT_ACCESS_MAX_TTL_SECONDS) {
      return { ok: false as const, reason: "snapshot_token_invalid_lifetime" };
    }
    if (payload.exp <= now) return { ok: false as const, reason: "snapshot_token_expired" };
    if (payload.diagnosticId !== Number(expected.diagnosticId)) {
      return { ok: false as const, reason: "snapshot_token_id_mismatch" };
    }
    if (payload.traceId !== clean(expected.traceId)) {
      return { ok: false as const, reason: "snapshot_token_trace_mismatch" };
    }
    return { ok: true as const, payload };
  } catch {
    return { ok: false as const, reason: "snapshot_token_invalid_body" };
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

import { createHash, randomBytes } from "node:crypto";
import { sql } from "./db";
import { resolveConsumerOtpProvider } from "./consumer-auth-provider";

const SESSION_COOKIE = "nexid_consumer_session";
const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES || 10);
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);
const OTP_LOCKOUT_MINUTES = 15;

const startRate = new Map<string, { count: number; resetAt: number }>();
const verifyRate = new Map<string, { count: number; resetAt: number }>();


function sha(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function pickIp(raw: string | null | undefined) {
  const first = String(raw || "").split(",")[0]?.trim();
  return first || "unknown";
}

function consumeRate(map: Map<string, { count: number; resetAt: number }>, key: string, max: number, windowMs: number) {
  const now = Date.now();
  const current = map.get(key);
  if (!current || current.resetAt <= now) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= max) return false;
  current.count += 1;
  map.set(key, current);
  return true;
}

function audit(event: string, payload: Record<string, unknown>) {
  console.log("[consumer_auth_audit]", JSON.stringify({ event, ...payload, at: new Date().toISOString() }));
}

export async function startConsumerAuth(contact: string, meta?: { ip?: string | null }) {
  const ip = pickIp(meta?.ip);
  const allowedContact = consumeRate(startRate, `contact:${contact}`, 5, 10 * 60 * 1000);
  const allowedIp = consumeRate(startRate, `ip:${ip}`, 20, 10 * 60 * 1000);
  if (!allowedContact || !allowedIp) {
    audit("consumer_auth_start_rate_limited", { contact, ip });
    return { ok: false as const, error: "rate_limited" };
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresMinutes = Number.isFinite(OTP_TTL_MINUTES) && OTP_TTL_MINUTES > 0 ? OTP_TTL_MINUTES : 10;
  await sql/*sql*/`
    INSERT INTO consumer_auth_challenges (contact, code_hash, expires_at, attempts, max_attempts, locked_until, ip_hash)
    VALUES (${contact}, ${sha(code)}, now() + (${expiresMinutes} || ' minutes')::interval, 0, ${OTP_MAX_ATTEMPTS}, null, ${sha(ip)})
  `;

  await resolveConsumerOtpProvider().sendOtp({ contact, code, ttlMinutes: expiresMinutes });
  audit("consumer_auth_start", { contact, ip, mode: process.env.CONSUMER_AUTH_MODE || "demo" });
  return { ok: true as const, code, challengeTtlMinutes: expiresMinutes };
}

export async function verifyConsumerAuth(contact: string, code: string, meta?: { userAgent?: string | null; ip?: string | null }) {
  const ip = pickIp(meta?.ip);
  const allowedContact = consumeRate(verifyRate, `contact:${contact}`, 15, 10 * 60 * 1000);
  const allowedIp = consumeRate(verifyRate, `ip:${ip}`, 40, 10 * 60 * 1000);
  if (!allowedContact || !allowedIp) {
    audit("consumer_auth_verify_fail", { contact, ip, reason: "rate_limited" });
    return { ok: false as const, error: "rate_limited" };
  }

  const challengeRows = await sql/*sql*/`
    SELECT id, code_hash, expires_at, attempts, max_attempts, locked_until
    FROM consumer_auth_challenges
    WHERE contact = ${contact}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const challenge = challengeRows[0];
  if (!challenge) return { ok: false as const, error: "invalid_code" };
  if (challenge.locked_until && new Date(challenge.locked_until).getTime() > Date.now()) {
    return { ok: false as const, error: "locked" };
  }
  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    return { ok: false as const, error: "expired" };
  }

  if (String(challenge.code_hash) !== sha(code)) {
    const attempts = Number(challenge.attempts || 0) + 1;
    const maxAttempts = Number(challenge.max_attempts || OTP_MAX_ATTEMPTS);
    const lockedUntil = attempts >= maxAttempts ? new Date(Date.now() + OTP_LOCKOUT_MINUTES * 60 * 1000).toISOString() : null;
    await sql/*sql*/`UPDATE consumer_auth_challenges SET attempts = ${attempts}, locked_until = ${lockedUntil} WHERE id = ${challenge.id}`;
    audit("consumer_auth_verify_fail", { contact, ip, reason: attempts >= maxAttempts ? "locked" : "invalid_code" });
    return { ok: false as const, error: attempts >= maxAttempts ? "locked" : "invalid_code" };
  }

  const normalizedEmail = contact.includes("@") ? contact.toLowerCase() : null;
  const normalizedPhone = contact.includes("@") ? null : contact;

  const consumerRows = await sql/*sql*/`
    INSERT INTO consumers (email, phone, display_name, status, preferred_locale, last_login_at)
    VALUES (${normalizedEmail}, ${normalizedPhone}, ${null}, 'registered', 'es-AR', now())
    ON CONFLICT (email)
    DO UPDATE SET last_login_at = now(), status = 'registered'
    RETURNING *
  `;
  const consumer = consumerRows[0];

  await sql/*sql*/`
    INSERT INTO consumer_identities (consumer_id, provider, provider_subject, verified_at)
    VALUES (${consumer.id}, ${normalizedEmail ? "email_magic_link" : "phone_otp"}, ${contact}, now())
    ON CONFLICT (provider, provider_subject)
    DO UPDATE SET verified_at = now(), updated_at = now()
  `;

  const rawSession = randomBytes(24).toString("hex");
  await sql/*sql*/`
    INSERT INTO consumer_sessions (consumer_id, session_token_hash, expires_at, user_agent_hash, ip_hash)
    VALUES (
      ${consumer.id},
      ${sha(rawSession)},
      now() + interval '30 days',
      ${meta?.userAgent ? sha(meta.userAgent) : null},
      ${meta?.ip ? sha(meta.ip) : null}
    )
  `;

  await sql/*sql*/`DELETE FROM consumer_auth_challenges WHERE id = ${challenge.id}`;
  audit("consumer_auth_verify_ok", { contact, ip, consumerId: consumer.id });
  return { ok: true as const, consumer, sessionToken: rawSession };
}

export async function getConsumerFromRequest(req: Request) {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  if (!match) return null;
  const token = decodeURIComponent(match[1]);
  const rows = await sql/*sql*/`
    SELECT c.*
    FROM consumer_sessions s
    JOIN consumers c ON c.id = s.consumer_id
    WHERE s.session_token_hash = ${sha(token)}
      AND s.expires_at >= now()
    LIMIT 1
  `;
  return rows[0] || null;
}

export function sessionCookieHeader(token: string | null) {
  if (!token) return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${60 * 60 * 24 * 30}; HttpOnly; SameSite=Lax`;
}

import { createHash, randomBytes, randomInt } from "node:crypto";
import { isIP } from "node:net";
import { sql } from "./db";
import { resolveConsumerOtpProvider } from "./consumer-auth-provider";
import { ensureConsumerAuthSchema } from "./commercial-runtime-schema";
import { hitSunRateLimit, shouldFailClosedSunRateLimit } from "./sun-rate-limit-store";

const SESSION_COOKIE = "nexid_consumer_session";
const ACTIVE_CONSUMER_SESSION_STATUSES = new Set(["anonymous", "registered", "verified"]);
const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES || 10);
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);
const OTP_LOCKOUT_MINUTES = 15;

const DEMO_CONSUMER_EMAIL = "demo.consumer@nexid.local";

function sha(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
function pickIp(raw: string | null | undefined) {
  const candidate = String(raw || "").split(",")[0]?.trim();
  return candidate && isIP(candidate) ? candidate : "unknown";
}

async function consumeAuthRate(scope: string, key: string, maxHits: number) {
  try {
    const result = await hitSunRateLimit(scope, key, 10 * 60, maxHits);
    if (result.unavailable) return shouldFailClosedSunRateLimit() ? "unavailable" as const : "allowed" as const;
    return result.limited ? "limited" as const : "allowed" as const;
  } catch (error) {
    audit("consumer_auth_rate_limit_unavailable", {
      scope,
      reason: error instanceof Error ? error.message : "rate_limit_unavailable",
    });
    return shouldFailClosedSunRateLimit() ? "unavailable" as const : "allowed" as const;
  }
}

function normalizePhone(contact: string) {
  const trimmed = contact.trim();
  const digits = trimmed.replace(/[^\d]/g, "");
  if (trimmed.startsWith("+")) return `+${digits}`;
  return digits.length >= 10 ? `+${digits}` : digits;
}

function normalizeContact(contact: string) {
  const trimmed = contact.trim();
  return trimmed.includes("@") ? trimmed.toLowerCase() : normalizePhone(trimmed);
}

function isEmailContact(contact: string) {
  return contact.includes("@");
}

function createMagicToken() {
  return `nxa_${randomBytes(24).toString("base64url")}`;
}

function cleanMagicToken(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, "")
    .slice(0, 96);
}

function audit(event: string, payload: Record<string, unknown>) {
  console.log("[consumer_auth_audit]", JSON.stringify({ event, ...payload, at: new Date().toISOString() }));
}

function normalizeOtpDeliveryError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (message.includes("email_contact_required")) return "email_contact_required";
  if (message.includes("resend_api_key_missing")) return "resend_api_key_missing";
  if (message.includes("consumer_auth_from_email_missing")) return "consumer_auth_from_email_missing";
  if (message.includes("twilio_credentials_missing")) return "twilio_credentials_missing";
  if (message.includes("twilio_sender_missing")) return "twilio_sender_missing";
  if (message.includes("phone_contact_required")) return "phone_contact_required";
  if (message.includes("twilio_delivery_failed")) return "twilio_delivery_failed";
  if (message.includes("resend_delivery_failed")) return "resend_delivery_failed";
  if (message.includes("otp_provider_api_key_missing")) return "otp_provider_api_key_missing";
  if (message.includes("smtp_credentials_missing")) return "smtp_credentials_missing";
  if (message.includes("smtp_delivery_failed")) return "smtp_delivery_failed";
  return "otp_delivery_failed";
}

async function linkedAuthContacts(contact: string) {
  const primary = normalizeContact(contact);
  const contacts = new Set<string>([primary]);
  if (isEmailContact(primary)) {
    const rows = await sql/*sql*/`SELECT phone FROM consumers WHERE email = ${primary} LIMIT 1`;
    const phone = rows[0]?.phone ? normalizePhone(String(rows[0].phone)) : "";
    if (phone) contacts.add(phone);
  } else {
    const rows = await sql/*sql*/`SELECT email FROM consumers WHERE phone = ${primary} LIMIT 1`;
    const email = String(rows[0]?.email || "").trim().toLowerCase();
    if (email) contacts.add(email);
  }
  return [...contacts];
}

async function getOrCreateConsumerForVerifiedContacts(contacts: string[]) {
  const normalized = contacts.map(normalizeContact).filter(Boolean);
  const email = normalized.find(isEmailContact) || null;
  const phone = normalized.find((contact) => !isEmailContact(contact)) || null;

  let consumer = null as Record<string, any> | null;
  for (const contact of normalized) {
    const rows = isEmailContact(contact)
      ? await sql/*sql*/`SELECT * FROM consumers WHERE email = ${contact} LIMIT 1`
      : await sql/*sql*/`SELECT * FROM consumers WHERE phone = ${contact} LIMIT 1`;
    if (rows[0]) {
      consumer = rows[0];
      break;
    }
  }

  if (consumer?.id) {
    const rows = await sql/*sql*/`
      UPDATE consumers
      SET email = COALESCE(consumers.email, ${email}),
          phone = COALESCE(consumers.phone, ${phone}),
          status = 'registered',
          last_login_at = now()
      WHERE id = ${consumer.id}
      RETURNING *
    `;
    consumer = rows[0] || consumer;
  } else if (email) {
    const rows = await sql/*sql*/`
      INSERT INTO consumers (email, phone, display_name, status, preferred_locale, last_login_at)
      VALUES (${email}, ${phone}, ${null}, 'registered', 'es-AR', now())
      ON CONFLICT (email)
      DO UPDATE SET phone = COALESCE(consumers.phone, EXCLUDED.phone), last_login_at = now(), status = 'registered'
      RETURNING *
    `;
    consumer = rows[0];
  } else {
    const rows = await sql/*sql*/`
      INSERT INTO consumers (email, phone, display_name, status, preferred_locale, last_login_at)
      VALUES (${null}, ${phone}, ${null}, 'registered', 'es-AR', now())
      ON CONFLICT (phone) WHERE phone IS NOT NULL
      DO UPDATE SET last_login_at = now(), status = 'registered'
      RETURNING *
    `;
    consumer = rows[0];
  }

  for (const contact of normalized) {
    await sql/*sql*/`
      INSERT INTO consumer_identities (consumer_id, provider, provider_subject, verified_at)
      VALUES (${consumer.id}, ${isEmailContact(contact) ? "email_magic_link" : "phone_otp"}, ${contact}, now())
      ON CONFLICT (provider, provider_subject)
      DO UPDATE SET verified_at = now(), updated_at = now()
    `;
  }

  return consumer;
}

async function createConsumerSession(consumer: Record<string, any>, meta?: { userAgent?: string | null; ip?: string | null }) {
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
  return rawSession;
}

export type ConsumerAuthDemoPayload = {
  demoConsumer?: unknown;
  consumerMode?: unknown;
  demoConsumerEmail?: unknown;
  email?: unknown;
  contact?: unknown;
};

export type ConsumerAuthDemoEvent = {
  bid?: unknown;
  tenant_slug?: unknown;
};

export function wantsDemoConsumer(payload?: ConsumerAuthDemoPayload | null) {
  if (!payload) return false;
  return payload.demoConsumer === true || String(payload.consumerMode || "").toLowerCase() === "demo";
}

export function canUseDemoConsumerForTap(payload?: ConsumerAuthDemoPayload | null, event?: ConsumerAuthDemoEvent | null) {
  if (!wantsDemoConsumer(payload)) return false;
  const demoMode = String(process.env.DEMO_MODE || "").toLowerCase();
  const consumerAuthMode = String(process.env.CONSUMER_AUTH_MODE || "").toLowerCase();
  const envDemo = ["1", "true", "yes", "demo"].includes(demoMode) || consumerAuthMode === "demo";
  const bid = String(event?.bid || "").toUpperCase();
  const tenantSlug = String(event?.tenant_slug || "").toLowerCase();
  return envDemo || bid.startsWith("DEMO-") || tenantSlug.startsWith("demo");
}

export async function getOrCreateDemoConsumer(contact = DEMO_CONSUMER_EMAIL) {
  await ensureConsumerAuthSchema();
  const normalizedContact = String(contact || DEMO_CONSUMER_EMAIL).trim().toLowerCase() || DEMO_CONSUMER_EMAIL;
  const normalizedEmail = normalizedContact.includes("@") ? normalizedContact : DEMO_CONSUMER_EMAIL;
  const rows = await sql/*sql*/`
    INSERT INTO consumers (email, phone, display_name, status, preferred_locale, last_login_at)
    VALUES (${normalizedEmail}, ${null}, 'nexID Demo Consumer', 'registered', 'es-AR', now())
    ON CONFLICT (email)
    DO UPDATE SET last_login_at = now(), status = 'registered', display_name = COALESCE(consumers.display_name, 'nexID Demo Consumer')
    RETURNING *
  `;
  const consumer = rows[0];
  await sql/*sql*/`
    INSERT INTO consumer_identities (consumer_id, provider, provider_subject, verified_at)
    VALUES (${consumer.id}, 'demo_consumer', ${normalizedEmail}, now())
    ON CONFLICT (provider, provider_subject)
    DO UPDATE SET verified_at = now(), updated_at = now()
  `;
  audit("consumer_auth_demo_ready", { contact: normalizedEmail, consumerId: consumer.id });
  return consumer;
}

export async function startConsumerAuth(contact: string, meta?: { ip?: string | null }) {
  await ensureConsumerAuthSchema();
  const ip = pickIp(meta?.ip);
  const normalizedContact = normalizeContact(contact);
  const [contactRate, ipRate] = await Promise.all([
    consumeAuthRate("consumer_auth_start_contact", normalizedContact, 5),
    consumeAuthRate("consumer_auth_start_ip", ip, 20),
  ]);
  if (contactRate === "unavailable" || ipRate === "unavailable") {
    audit("consumer_auth_start_unavailable", { contact: normalizedContact, ip });
    return { ok: false as const, error: "unavailable" };
  }
  if (contactRate === "limited" || ipRate === "limited") {
    audit("consumer_auth_start_rate_limited", { contact: normalizedContact, ip });
    return { ok: false as const, error: "rate_limited" };
  }

  const code = String(randomInt(100000, 1_000_000));
  const magicToken = createMagicToken();
  const magicTokenHash = sha(magicToken);
  const expiresMinutes = Number.isFinite(OTP_TTL_MINUTES) && OTP_TTL_MINUTES > 0 ? OTP_TTL_MINUTES : 10;
  const contacts = await linkedAuthContacts(normalizedContact);
  for (const authContact of contacts) {
    await sql/*sql*/`
      INSERT INTO consumer_auth_challenges (contact, code_hash, expires_at, attempts, max_attempts, locked_until, ip_hash, magic_token_hash)
      VALUES (${authContact}, ${sha(code)}, now() + (${expiresMinutes} || ' minutes')::interval, 0, ${OTP_MAX_ATTEMPTS}, null, ${sha(ip)}, ${magicTokenHash})
    `;
  }

  const normalized = normalizedContact.toLowerCase();
  const demoMode = String(process.env.DEMO_MODE || "").toLowerCase();
  const consumerAuthMode = String(process.env.CONSUMER_AUTH_MODE || "").toLowerCase();
  const demoBypassAllowed = ["1", "true", "yes", "demo"].includes(demoMode) || consumerAuthMode === "demo";
  const isMockSocial = demoBypassAllowed && normalized === "demo.consumer@nexid.local";

  try {
    if (!isMockSocial) {
      await resolveConsumerOtpProvider().sendOtp({ contact: normalizedContact, code, ttlMinutes: expiresMinutes, magicToken });

      for (const secondaryContact of contacts.filter((item) => item !== normalizedContact)) {
        try {
          await resolveConsumerOtpProvider().sendOtp({ contact: secondaryContact, code, ttlMinutes: expiresMinutes, magicToken });
          audit("consumer_auth_2fa_sent", { contact: normalizedContact, secondaryContact });
        } catch (err) {
          audit("consumer_auth_2fa_send_fail", { contact: normalizedContact, secondaryContact, error: String(err) });
        }
      }
    } else {
      audit("consumer_auth_mock_social_start", { contact: normalizedContact, ip });
    }
  } catch (error) {
    const reason = normalizeOtpDeliveryError(error);
    audit("consumer_auth_delivery_fail", { contact: normalizedContact, ip, mode: process.env.CONSUMER_AUTH_MODE || "demo", reason });
    return { ok: false as const, error: reason };
  }
  audit("consumer_auth_start", { contact: normalizedContact, linkedContacts: contacts.length, ip, mode: process.env.CONSUMER_AUTH_MODE || "demo" });
  return { ok: true as const, code, challengeTtlMinutes: expiresMinutes };
}

export async function verifyConsumerAuth(contact: string, code: string, meta?: { userAgent?: string | null; ip?: string | null }) {
  await ensureConsumerAuthSchema();
  const ip = pickIp(meta?.ip);
  const normalizedContact = normalizeContact(contact);
  const [contactRate, ipRate] = await Promise.all([
    consumeAuthRate("consumer_auth_verify_contact", normalizedContact, 15),
    consumeAuthRate("consumer_auth_verify_ip", ip, 40),
  ]);
  if (contactRate === "unavailable" || ipRate === "unavailable") {
    audit("consumer_auth_verify_fail", { contact: normalizedContact, ip, reason: "unavailable" });
    return { ok: false as const, error: "unavailable" };
  }
  if (contactRate === "limited" || ipRate === "limited") {
    audit("consumer_auth_verify_fail", { contact: normalizedContact, ip, reason: "rate_limited" });
    return { ok: false as const, error: "rate_limited" };
  }

  const challengeRows = await sql/*sql*/`
    SELECT id, contact, code_hash, expires_at, attempts, max_attempts, locked_until, magic_token_hash
    FROM consumer_auth_challenges
    WHERE contact = ${normalizedContact}
      AND used_at IS NULL
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
    const maxAttempts = Number(challenge.max_attempts || OTP_MAX_ATTEMPTS);
    const attemptRows = await sql/*sql*/`
      UPDATE consumer_auth_challenges
      SET attempts = attempts + 1,
          locked_until = CASE
            WHEN attempts + 1 >= ${maxAttempts}
              THEN now() + (${OTP_LOCKOUT_MINUTES} || ' minutes')::interval
            ELSE locked_until
          END
      WHERE id = ${challenge.id}
        AND used_at IS NULL
      RETURNING attempts, locked_until
    `;
    const attempts = Number(attemptRows[0]?.attempts || maxAttempts);
    audit("consumer_auth_verify_fail", { contact: normalizedContact, ip, reason: attempts >= maxAttempts ? "locked" : "invalid_code" });
    return { ok: false as const, error: attempts >= maxAttempts ? "locked" : "invalid_code" };
  }

  const tokenHash = String(challenge.magic_token_hash || "");
  const linkedRows = tokenHash
    ? await sql/*sql*/`
      SELECT contact
      FROM consumer_auth_challenges
      WHERE magic_token_hash = ${tokenHash}
        AND used_at IS NULL
    `
    : [];
  const contacts = linkedRows.length ? linkedRows.map((row) => String(row.contact)) : [normalizedContact];
  const consumer = await getOrCreateConsumerForVerifiedContacts(contacts);
  const rawSession = await createConsumerSession(consumer, meta);

  if (tokenHash) {
    await sql/*sql*/`UPDATE consumer_auth_challenges SET used_at = now() WHERE magic_token_hash = ${tokenHash} AND used_at IS NULL`;
  } else {
    await sql/*sql*/`UPDATE consumer_auth_challenges SET used_at = now() WHERE id = ${challenge.id}`;
  }
  audit("consumer_auth_verify_ok", { contact: normalizedContact, linkedContacts: contacts.length, ip, consumerId: consumer.id });
  return { ok: true as const, consumer, sessionToken: rawSession };
}

export async function verifyConsumerAuthToken(token: string, meta?: { userAgent?: string | null; ip?: string | null }) {
  await ensureConsumerAuthSchema();
  const safeToken = cleanMagicToken(token);
  const ip = pickIp(meta?.ip);
  if (!safeToken) return { ok: false as const, error: "invalid_code" };

  const ipRate = await consumeAuthRate("consumer_auth_magic_ip", ip, 50);
  if (ipRate === "unavailable") {
    audit("consumer_auth_token_verify_fail", { ip, reason: "unavailable" });
    return { ok: false as const, error: "unavailable" };
  }
  if (ipRate === "limited") {
    audit("consumer_auth_token_verify_fail", { ip, reason: "rate_limited" });
    return { ok: false as const, error: "rate_limited" };
  }

  const tokenHash = sha(safeToken);
  const rows = await sql/*sql*/`
    SELECT id, contact, expires_at, locked_until
    FROM consumer_auth_challenges
    WHERE magic_token_hash = ${tokenHash}
      AND used_at IS NULL
    ORDER BY created_at DESC
  `;
  if (!rows.length) return { ok: false as const, error: "invalid_code" };
  const expired = rows.every((row) => new Date(row.expires_at).getTime() < Date.now());
  if (expired) return { ok: false as const, error: "expired" };
  const locked = rows.some((row) => row.locked_until && new Date(row.locked_until).getTime() > Date.now());
  if (locked) return { ok: false as const, error: "locked" };

  const contacts = [...new Set(rows.map((row) => normalizeContact(String(row.contact))))];
  const consumer = await getOrCreateConsumerForVerifiedContacts(contacts);
  const rawSession = await createConsumerSession(consumer, meta);
  await sql/*sql*/`UPDATE consumer_auth_challenges SET used_at = now() WHERE magic_token_hash = ${tokenHash} AND used_at IS NULL`;
  audit("consumer_auth_token_verify_ok", { linkedContacts: contacts.length, ip, consumerId: consumer.id });
  return { ok: true as const, consumer, sessionToken: rawSession };
}

export function isConsumerSessionAccountActive(status: unknown) {
  return ACTIVE_CONSUMER_SESSION_STATUSES.has(String(status || "").trim().toLowerCase());
}

export function consumerSessionTokenFromRequest(req: Request) {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (!match) return null;
  try {
    const token = decodeURIComponent(match[1]);
    return /^[a-f0-9]{48}$/.test(token) ? token : null;
  } catch {
    return null;
  }
}

export async function revokeConsumerSessionFromRequest(req: Request) {
  const token = consumerSessionTokenFromRequest(req);
  if (!token) return { revoked: false } as const;
  await ensureConsumerAuthSchema();
  const rows = await sql/*sql*/`
    UPDATE consumer_sessions
    SET revoked_at = now(),
        last_seen_at = now()
    WHERE session_token_hash = ${sha(token)}
      AND revoked_at IS NULL
    RETURNING id, consumer_id
  `;
  const revoked = Boolean(rows[0]?.id);
  audit("consumer_session_logout", {
    consumerId: rows[0]?.consumer_id || null,
    revoked,
  });
  return { revoked } as const;
}

export async function deleteConsumerAccountAndRevokeSessions(consumerId: string) {
  await ensureConsumerAuthSchema();
  const rows = await sql/*sql*/`
    WITH deleted_consumer AS MATERIALIZED (
      UPDATE consumers
      SET status = 'deleted',
          email = NULL,
          phone = NULL,
          display_name = NULL,
          updated_at = now()
      WHERE id = ${consumerId}
        AND status <> 'deleted'
      RETURNING id
    ),
    revoked_sessions AS MATERIALIZED (
      UPDATE consumer_sessions session
      SET revoked_at = now(),
          last_seen_at = now()
      WHERE session.consumer_id = ${consumerId}
        AND session.revoked_at IS NULL
        AND EXISTS (SELECT 1 FROM deleted_consumer)
      RETURNING session.id
    )
    SELECT
      (SELECT id FROM deleted_consumer) AS consumer_id,
      (SELECT count(*)::int FROM revoked_sessions) AS revoked_session_count
  `;
  if (!rows[0]?.consumer_id) return null;
  const result = {
    consumerId: String(rows[0].consumer_id),
    revokedSessionCount: Number(rows[0].revoked_session_count || 0),
  };
  audit("consumer_account_deleted", result);
  return result;
}

export async function getConsumerFromRequest(req: Request) {
  const token = consumerSessionTokenFromRequest(req);
  if (!token) return null;
  await ensureConsumerAuthSchema();
  let rows;
  try {
    rows = await sql/*sql*/`
      SELECT c.*,
             s.revoked_at AS session_revoked_at,
             EXISTS (
               SELECT 1
               FROM consumer_identities wi
               WHERE wi.consumer_id = c.id
                 AND wi.provider = 'web3_wallet'
                 AND wi.verified_at IS NOT NULL
                 AND c.wallet_address IS NOT NULL
                 AND lower(wi.provider_subject) = lower(c.wallet_address)
             ) AS wallet_control_verified
      FROM consumer_sessions s
      JOIN consumers c ON c.id = s.consumer_id
      WHERE s.session_token_hash = ${sha(token)}
        AND s.expires_at >= now()
        AND s.revoked_at IS NULL
        AND c.status IN ('anonymous', 'registered', 'verified')
      LIMIT 1
    `;
  } catch (error) {
    if (String((error as { code?: string } | null)?.code || "") === "42P01") return null;
    throw error;
  }
  const consumer = rows[0] || null;
  if (!consumer || consumer.session_revoked_at || !isConsumerSessionAccountActive(consumer.status)) return null;
  return consumer;
}

function sessionCookieAttributes() {
  const isSecure = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  const domain = String(process.env.CONSUMER_SESSION_COOKIE_DOMAIN || "").trim();
  return `${domain ? `; Domain=${domain}` : ""}; Path=/; HttpOnly; SameSite=Lax${isSecure ? "; Secure" : ""}`;
}

export function sessionCookieHeader(token: string | null) {
  if (!token) return `${SESSION_COOKIE}=; Max-Age=0${sessionCookieAttributes()}`;
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${60 * 60 * 24 * 30}${sessionCookieAttributes()}`;
}

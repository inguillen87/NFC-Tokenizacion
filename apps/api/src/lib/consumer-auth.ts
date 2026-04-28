import { createHash, randomBytes } from "node:crypto";
import { sql } from "./db";

const SESSION_COOKIE = "nexid_consumer_session";


function sha(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function startConsumerAuth(contact: string) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await sql/*sql*/`
    INSERT INTO consumer_auth_challenges (contact, code_hash, expires_at)
    VALUES (${contact}, ${sha(code)}, now() + interval '10 minutes')
  `;
  return { code, challengeTtlMinutes: 10 };
}

export async function verifyConsumerAuth(contact: string, code: string, meta?: { userAgent?: string | null; ip?: string | null }) {
  const challenge = await sql/*sql*/`
    SELECT id
    FROM consumer_auth_challenges
    WHERE contact = ${contact}
      AND code_hash = ${sha(code)}
      AND expires_at >= now()
    ORDER BY created_at DESC
    LIMIT 1
  `;
  if (!challenge[0]) return null;

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
  return { consumer, sessionToken: rawSession };
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

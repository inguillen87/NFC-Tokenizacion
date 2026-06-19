export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getConsumerFromRequest } from "../../../../lib/consumer-auth";
import { resolveConsumerOtpProvider } from "../../../../lib/consumer-auth-provider";
import { parseConsumerContact } from "../../../../lib/consumer-contact";
import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
import { ensureConsumerAuthSchema } from "../../../../lib/commercial-runtime-schema";
import { createHash } from "node:crypto";

function sha(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizePhone(contact: string) {
  const trimmed = contact.trim();
  const digits = trimmed.replace(/[^\d]/g, "");
  if (trimmed.startsWith("+")) return `+${digits}`;
  return digits.length >= 10 ? `+${digits}` : digits;
}

export async function POST(req: Request) {
  await ensureConsumerAuthSchema();
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const body = await req.json().catch(() => ({}));
  const parsedContact = parseConsumerContact(body);
  if (!parsedContact.ok) {
    return json({ ok: false, error: parsedContact.error }, 422);
  }

  const contact = parsedContact.contact;
  const isMail = contact.includes("@");
  const normalized = isMail ? contact.trim().toLowerCase() : normalizePhone(contact);

  // Check if contact is already associated with ANOTHER consumer
  let duplicateQuery;
  if (isMail) {
    duplicateQuery = await sql`SELECT id FROM consumers WHERE email = ${normalized} AND id != ${consumer.id} LIMIT 1`;
  } else {
    duplicateQuery = await sql`SELECT id FROM consumers WHERE phone = ${normalized} AND id != ${consumer.id} LIMIT 1`;
  }

  if (duplicateQuery.length > 0) {
    return json({ ok: false, error: "contact_already_linked" }, 409);
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresMinutes = 10;

  // Insert the challenge
  await sql`
    INSERT INTO consumer_auth_challenges (contact, code_hash, expires_at, attempts, max_attempts, locked_until, ip_hash)
    VALUES (${normalized}, ${sha(code)}, now() + (${expiresMinutes} || ' minutes')::interval, 0, 5, null, ${sha(req.headers.get("x-forwarded-for") || "unknown")})
  `;

  try {
    await resolveConsumerOtpProvider().sendOtp({ contact: normalized, code, ttlMinutes: expiresMinutes });
  } catch (error) {
    return json({ ok: false, error: "otp_delivery_failed", detail: String(error) }, 500);
  }

  const payload = {
    ok: true,
    contact: normalized,
    ttlMinutes: expiresMinutes,
    deliveryChannel: isMail ? "email" : "whatsapp"
  } as Record<string, unknown>;

  const debugCodeEnabled = ["1", "true", "yes", "debug"].includes(String(process.env.CONSUMER_AUTH_DEBUG_CODE_RESPONSE || "").toLowerCase());
  const vercelEnv = String(process.env.VERCEL_ENV || "").toLowerCase();
  if (debugCodeEnabled && process.env.NODE_ENV !== "production" && vercelEnv !== "production") {
    payload.code = code;
  }

  return json(payload);
}

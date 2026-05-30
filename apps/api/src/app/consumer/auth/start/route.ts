export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../lib/http";
import { startConsumerAuth } from "../../../../lib/consumer-auth";
import { parseConsumerContact } from "../../../../lib/consumer-contact";

function startStatus(error: string) {
  if (error === "rate_limited") return 429;
  if (error === "email_contact_required" || error === "phone_contact_required") return 422;
  if (
    error === "resend_api_key_missing" ||
    error === "consumer_auth_from_email_missing" ||
    error === "twilio_credentials_missing" ||
    error === "twilio_sender_missing" ||
    error === "otp_provider_api_key_missing"
  ) return 503;
  if (error === "twilio_delivery_failed" || error === "resend_delivery_failed") return 502;
  return 500;
}

function deliveryChannelFor(contact: string, mode: string) {
  if (mode === "demo") return "demo";
  if (contact.includes("@")) return "email";
  const phoneChannel = String(process.env.CONSUMER_PHONE_OTP_CHANNEL || "").toLowerCase();
  if (mode.includes("whatsapp") || phoneChannel === "whatsapp") return "whatsapp";
  return "sms";
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsedContact = parseConsumerContact(body);
  if (!parsedContact.ok) {
    return json({ ok: false, error: parsedContact.error }, parsedContact.error === "contact_required" ? 400 : 422);
  }
  const contact = parsedContact.contact;
  const challenge = await startConsumerAuth(contact, { ip: req.headers.get("x-forwarded-for") });
  if (!challenge.ok) return json({ ok: false, error: challenge.error }, startStatus(challenge.error));

  const demoMode = String(process.env.DEMO_MODE || "").toLowerCase() === "true";
  const mode = String(process.env.CONSUMER_AUTH_MODE || "demo").toLowerCase();
  const payload = { ok: true, contact, ttlMinutes: challenge.challengeTtlMinutes, mode, deliveryChannel: deliveryChannelFor(contact, mode) } as Record<string, unknown>;
  if (demoMode || mode === "demo") payload.code = challenge.code;
  return json(payload);
}

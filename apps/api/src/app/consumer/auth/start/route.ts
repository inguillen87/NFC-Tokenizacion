export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AUTH_RATE_LIMIT_RETRY_AFTER_SECONDS = 10 * 60;

import { json } from "../../../../lib/http";
import { startConsumerAuth } from "../../../../lib/consumer-auth";
import { consumerOtpDeliveryMode, isConsumerOtpProduction } from "../../../../lib/consumer-auth-provider";
import { parseConsumerContact } from "../../../../lib/consumer-contact";
import { getRequestMeta } from "../../../../lib/request-meta";
import { enforceCriticalRateLimit } from "../../../../lib/critical-rate-limit";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../lib/bounded-request-body";

function startStatus(error: string) {
  if (error === "rate_limited") return 429;
  if (error === "unavailable") return 503;
  if (error === "email_contact_required" || error === "phone_contact_required") return 422;
  if (
    error === "resend_api_key_missing" ||
    error === "consumer_auth_from_email_missing" ||
    error === "twilio_credentials_missing" ||
    error === "twilio_sender_missing" ||
    error === "otp_provider_api_key_missing" ||
    error === "smtp_credentials_missing" ||
    error === "consumer_auth_mode_invalid" ||
    error === "consumer_auth_demo_forbidden" ||
    error === "consumer_phone_otp_channel_invalid"
  ) return 503;
  if (["smtp_delivery_timeout", "resend_delivery_timeout", "twilio_delivery_timeout"].includes(error)) return 504;
  if (["smtp_receipt_invalid", "resend_receipt_invalid", "twilio_receipt_invalid"].includes(error)) return 502;
  if (error === "twilio_delivery_failed" || error === "resend_delivery_failed" || error === "smtp_delivery_failed") return 502;
  return 500;
}

function canExposeDebugCode() {
  const flag = String(process.env.CONSUMER_AUTH_DEBUG_CODE_RESPONSE || "").toLowerCase();
  const debugEnabled = ["1", "true", "yes", "debug"].includes(flag);
  return debugEnabled && !isConsumerOtpProduction();
}

export async function POST(req: Request) {
  const sourceLimited = await enforceCriticalRateLimit(req, { rateClass: "auth", tenantId: "platform", subjectId: "consumer-auth-start:unauthenticated" });
  if (sourceLimited) return sourceLimited;
  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonBody<Record<string, unknown>>(req, 4 * 1024);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, error: tooLarge ? "request_body_too_large" : "invalid_json" }, tooLarge ? 413 : 400);
  }
  const parsedContact = parseConsumerContact(body);
  if (!parsedContact.ok) {
    return json({ ok: false, error: parsedContact.error }, parsedContact.error === "contact_required" ? 400 : 422);
  }
  const contact = parsedContact.contact;

  const requestMeta = getRequestMeta(req);
  const challenge = await startConsumerAuth(contact, { ip: requestMeta.ip });
  if (!challenge.ok) {
    const status = startStatus(challenge.error);
    const headers: Record<string, string> = status === 429
      ? { "cache-control": "no-store", "retry-after": String(AUTH_RATE_LIMIT_RETRY_AFTER_SECONDS) }
      : { "cache-control": "no-store" };
    return json({ ok: false, error: challenge.error }, status, headers);
  }

  const mode = consumerOtpDeliveryMode();
  const secondaryAccepted = challenge.secondaryDelivery?.status === "accepted";
  const payload = {
    ok: true,
    contact,
    ttlMinutes: challenge.challengeTtlMinutes,
    mode,
    // Provider acceptance is not confirmation of arrival in the recipient's inbox.
    delivery: challenge.delivery,
    ...(challenge.secondaryDelivery ? { secondaryDelivery: challenge.secondaryDelivery } : {}),
    deliveryChannel: challenge.delivery.status === "simulated" ? "demo" : secondaryAccepted ? "email_and_phone_same_challenge" : challenge.delivery.channel,
    multiChannelDelivery: secondaryAccepted,
    authenticationFactorsRequired: 1,
    twoFactor: false,
    securityModel: "single_factor_otp_with_optional_redundant_delivery",
  } as Record<string, unknown>;

  if (canExposeDebugCode()) payload.code = challenge.code;
  return json(payload);
}

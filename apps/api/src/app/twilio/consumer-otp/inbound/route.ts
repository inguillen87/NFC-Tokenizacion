export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { enforceCriticalRateLimit, enforceWebhookAuthenticationRateLimit } from "../../../../lib/critical-rate-limit";
import { getConsumerOtpTwilioInboundUrl, getConsumerOtpWhatsappFrom } from "../../../../lib/consumer-otp-twilio-config";
import { twilioOtpEnvironmentValue } from "../../../../lib/consumer-otp-twilio-status";
import { readAndVerifyTwilioInbound } from "../../../../lib/twilio-inbound-security";

function empty(status: number) {
  return new Response(null, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  const sourceLimited = await enforceWebhookAuthenticationRateLimit(req);
  if (sourceLimited) return sourceLimited;
  if (String(req.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase() !== "application/x-www-form-urlencoded") return empty(415);

  let webhookUrl: string | null;
  let sender: string | null;
  try {
    webhookUrl = getConsumerOtpTwilioInboundUrl();
    sender = getConsumerOtpWhatsappFrom();
  } catch {
    return empty(503);
  }
  const accountSid = twilioOtpEnvironmentValue(process.env, "TWILIO_ACCOUNT_SID");
  if (!webhookUrl || !sender || !/^AC[a-fA-F\d]{32}$/.test(accountSid)) return empty(503);

  const verified = await readAndVerifyTwilioInbound(req, {
    maxBodyBytes: 8 * 1024,
    webhookUrl,
    requireSignature: true,
    rejectDuplicateParameters: true,
  });
  if (!verified.ok) return empty(verified.status);
  if (verified.form.get("AccountSid") !== accountSid || verified.form.get("To") !== sender) return empty(403);
  if (!/^(SM|MM)[a-fA-F\d]{32}$/.test(verified.form.get("MessageSid") || "")) return empty(400);

  const limited = await enforceCriticalRateLimit(req, {
    rateClass: "webhook", tenantId: "platform", subjectId: "twilio-consumer-otp-inbound", globalPrincipal: true,
  });
  if (limited) return limited;

  // Incoming text is authenticated but never logged, stored or interpreted.
  // An empty TwiML response sends no reply; repeated deliveries have no action
  // to repeat and cannot create a session, consent, lead or voucher.
  return new Response('<?xml version="1.0" encoding="UTF-8"?><Response/>', {
    status: 200,
    headers: { "content-type": "text/xml; charset=utf-8", "cache-control": "no-store" },
  });
}

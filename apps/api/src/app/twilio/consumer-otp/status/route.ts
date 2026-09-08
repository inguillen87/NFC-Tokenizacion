export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { enforceCriticalRateLimit, enforceWebhookAuthenticationRateLimit } from "../../../../lib/critical-rate-limit";
import { getConsumerOtpTwilioStatusCallbackUrl, parseTwilioOtpDeliveryStatus, twilioOtpEnvironmentValue } from "../../../../lib/consumer-otp-twilio-status";
import { readAndVerifyTwilioInbound } from "../../../../lib/twilio-inbound-security";

function empty(status: number) {
  return new Response(null, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  const sourceLimited = await enforceWebhookAuthenticationRateLimit(req);
  if (sourceLimited) return sourceLimited;
  if (String(req.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase() !== "application/x-www-form-urlencoded") return empty(415);

  let webhookUrl: string | null;
  try {
    webhookUrl = getConsumerOtpTwilioStatusCallbackUrl();
  } catch {
    return empty(503);
  }
  const accountSid = twilioOtpEnvironmentValue(process.env, "TWILIO_ACCOUNT_SID");
  if (!webhookUrl || !/^AC[a-fA-F\d]{32}$/.test(accountSid)) return empty(503);

  const verified = await readAndVerifyTwilioInbound(req, {
    maxBodyBytes: 8 * 1024,
    webhookUrl,
    requireSignature: true,
    rejectDuplicateParameters: true,
  });
  if (!verified.ok) return empty(verified.status);
  const parsed = parseTwilioOtpDeliveryStatus(verified.form, accountSid);
  if (!parsed.ok) return empty(parsed.status);
  const limited = await enforceCriticalRateLimit(req, {
    rateClass: "webhook", tenantId: "platform", subjectId: "twilio-consumer-otp-status", globalPrincipal: true,
  });
  if (limited) return limited;

  // Diagnostic events only: no challenge/session/CRM writes, delivery retries,
  // or last-status projection. Repeated or out-of-order callbacks stay harmless.
  console.log("[consumer_otp_twilio_status]", JSON.stringify(parsed.value));
  return empty(200);
}

import { isIP } from "node:net";
import { twilioOtpEnvironmentValue } from "./consumer-otp-twilio-status";

type RuntimeEnvironment = Record<string, string | undefined>;

const INBOUND_PATH = "/twilio/consumer-otp/inbound";
const PRODUCTION_INBOUND_URL = `https://api.nexid.lat${INBOUND_PATH}`;

export function getConsumerOtpWhatsappFrom(environment: RuntimeEnvironment = process.env): string | null {
  const value = twilioOtpEnvironmentValue(environment, "TWILIO_CONSUMER_OTP_WHATSAPP_FROM");
  if (!value) return null;
  if (!/^whatsapp:\+[1-9]\d{7,14}$/.test(value)) throw new Error("twilio_consumer_otp_whatsapp_from_invalid");
  return value;
}

export function getConsumerOtpTwilioInboundUrl(environment: RuntimeEnvironment = process.env): string | null {
  const configured = twilioOtpEnvironmentValue(environment, "TWILIO_CONSUMER_OTP_INBOUND_WEBHOOK_URL");
  // Next.js uses NODE_ENV=production in Preview, which must not inherit the
  // Production inbound. Non-production runtimes need their own explicit URL.
  const value = configured || (twilioOtpEnvironmentValue(environment, "VERCEL_ENV").toLowerCase() === "production" ? PRODUCTION_INBOUND_URL : "");
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash
      || parsed.pathname !== INBOUND_PATH || parsed.port
      || !/^[a-z\d](?:[a-z\d.-]*[a-z\d])?$/i.test(parsed.hostname)
      || !parsed.hostname.includes(".") || isIP(parsed.hostname)
      || parsed.hostname.endsWith(".localhost") || parsed.hostname.endsWith(".local")
      || parsed.toString() !== value
    ) throw new Error("invalid_inbound_url");
    return value;
  } catch {
    throw new Error("twilio_consumer_otp_inbound_url_invalid");
  }
}

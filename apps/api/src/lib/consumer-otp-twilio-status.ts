import { createHash } from "node:crypto";
import { isIP } from "node:net";

type RuntimeEnvironment = Record<string, string | undefined>;

const STATUS_PATH = "/twilio/consumer-otp/status";
const PRODUCTION_STATUS_URL = `https://api.nexid.lat${STATUS_PATH}`;
const STATUSES = new Set(["accepted", "queued", "sending", "sent", "delivered", "read", "failed", "undelivered", "canceled", "scheduled"]);

export function twilioOtpEnvironmentValue(environment: RuntimeEnvironment, name: string) {
  const value = String(environment[name] || "").trim();
  const quote = value[0];
  return value.length >= 2 && (quote === "'" || quote === '"') && value.at(-1) === quote
    ? value.slice(1, -1).trim()
    : value;
}

export function getConsumerOtpTwilioStatusCallbackUrl(environment: RuntimeEnvironment = process.env): string | null {
  const configured = twilioOtpEnvironmentValue(environment, "TWILIO_CONSUMER_OTP_STATUS_CALLBACK_URL");
  // Never route local/Preview callbacks into Production merely because Next.js
  // sets NODE_ENV=production. Those runtimes need an explicit server setting.
  const value = configured || (twilioOtpEnvironmentValue(environment, "VERCEL_ENV").toLowerCase() === "production" ? PRODUCTION_STATUS_URL : "");
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash
      || parsed.pathname !== STATUS_PATH || parsed.port
      || !/^[a-z\d](?:[a-z\d.-]*[a-z\d])?$/i.test(parsed.hostname)
      || !parsed.hostname.includes(".") || isIP(parsed.hostname)
      || parsed.hostname.endsWith(".localhost") || parsed.hostname.endsWith(".local")
      || parsed.toString() !== value
    ) throw new Error("invalid_callback_url");
    return value;
  } catch {
    throw new Error("twilio_status_callback_url_invalid");
  }
}

export type TwilioOtpDeliveryStatus = { receiptHash: string; status: string; errorCode?: number };

export function parseTwilioOtpDeliveryStatus(form: URLSearchParams, expectedAccountSid: string):
  | { ok: true; value: TwilioOtpDeliveryStatus }
  | { ok: false; status: 400 | 403 } {
  if (form.get("AccountSid") !== expectedAccountSid) return { ok: false, status: 403 };
  const sid = form.get("MessageSid") || "";
  const status = form.get("MessageStatus") || "";
  const error = form.get("ErrorCode") || "";
  if (!/^(SM|MM)[a-fA-F\d]{32}$/.test(sid) || !STATUSES.has(status) || (error && (!/^\d{1,6}$/.test(error) || Number(error) <= 0))) {
    return { ok: false, status: 400 };
  }
  return {
    ok: true,
    value: { receiptHash: createHash("sha256").update(sid).digest("hex").slice(0, 16), status, ...(error ? { errorCode: Number(error) } : {}) },
  };
}

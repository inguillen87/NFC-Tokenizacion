import nodemailer from "nodemailer";
import { createHash } from "node:crypto";
import { domainToASCII } from "node:url";
import { getConsumerOtpTwilioStatusCallbackUrl } from "./consumer-otp-twilio-status";
import { getConsumerOtpWhatsappFrom } from "./consumer-otp-twilio-config";

export type OtpDeliveryPayload = {
  contact: string;
  code: string;
  ttlMinutes: number;
  magicToken?: string;
};

export type OtpDeliveryChannel = "email" | "sms" | "whatsapp";
export type OtpDelivery = { channel: OtpDeliveryChannel; provider: "smtp" | "resend" | "twilio" | "demo"; status: "accepted" | "simulated" };
export type OtpDeliveryResult = { ok: true; delivery: OtpDelivery };
export interface ConsumerOtpProvider { sendOtp(payload: OtpDeliveryPayload): Promise<OtpDeliveryResult>; }

type TwilioChannel = "sms" | "whatsapp";
const DELIVERY_TIMEOUT_MS = 10_000;
const DELIVERY_MODES = new Set(["demo", "smtp", "email", "resend", "sms", "twilio", "whatsapp", "twilio_whatsapp", "smart", "production", "provider"]);

function env(name: string) {
  const value = String(process.env[name] || "").trim();
  const quote = value[0];
  return value.length >= 2 && (quote === "'" || quote === '"') && value.at(-1) === quote
    ? value.slice(1, -1).trim()
    : value;
}

export function isConsumerOtpProduction() {
  return env("NODE_ENV").toLowerCase() === "production" || env("VERCEL") === "1" || ["production", "preview"].includes(env("VERCEL_ENV").toLowerCase());
}

export function consumerOtpDeliveryMode() {
  const mode = env("CONSUMER_AUTH_MODE").toLowerCase() || (isConsumerOtpProduction() ? "smart" : "demo");
  return DELIVERY_MODES.has(mode) ? mode : "invalid";
}

export function consumerOtpDeliveryChannel(contact: string): OtpDeliveryChannel {
  if (isEmail(contact)) return "email";
  const mode = consumerOtpDeliveryMode();
  if (mode === "whatsapp" || mode === "twilio_whatsapp") return "whatsapp";
  if (mode === "sms" || mode === "twilio") return "sms";
  return env("CONSUMER_PHONE_OTP_CHANNEL").toLowerCase() === "whatsapp" ? "whatsapp" : "sms";
}

type DeliveryDiagnostics = { providerStatus?: string; receiptHash?: string; httpStatus?: number; errorCode?: number; acceptedCount?: number; rejectedCount?: number };
function auditDelivery(provider: OtpDelivery["provider"], channel: OtpDeliveryChannel, status: "accepted" | "failed" | "simulated", details: DeliveryDiagnostics = {}) {
  // Never include message content, recipients, credentials or raw provider errors.
  console.log("[consumer_auth_delivery_audit]", JSON.stringify({ event: "consumer_otp_provider_result", mode: consumerOtpDeliveryMode(), provider, channel, status, ...details, at: new Date().toISOString() }));
}

function receiptHash(value: string) { return createHash("sha256").update(value).digest("hex").slice(0, 16); }
function accepted(provider: OtpDelivery["provider"], channel: OtpDeliveryChannel, details: DeliveryDiagnostics): OtpDeliveryResult {
  auditDelivery(provider, channel, "accepted", details);
  return { ok: true, delivery: { provider, channel, status: "accepted" } };
}

async function providerRequest(url: string, init: RequestInit, provider: "resend" | "twilio", channel: OtpDeliveryChannel) {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS) });
    const data = await response.json().catch((error: unknown) => {
      if (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name)) throw error;
      return null;
    }) as Record<string, unknown> | null;
    if (!response.ok) {
      const errorCode = typeof data?.code === "number" && Number.isSafeInteger(data.code) ? data.code : undefined;
      auditDelivery(provider, channel, "failed", { httpStatus: response.status, ...(errorCode !== undefined ? { errorCode } : {}) });
      throw new Error(`${provider}_delivery_failed`);
    }
    return { response, data };
  } catch (error) {
    if (error instanceof Error && error.message === `${provider}_delivery_failed`) throw error;
    const timedOut = error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name);
    auditDelivery(provider, channel, "failed", { providerStatus: timedOut ? "timeout" : "request_failed" });
    throw new Error(`${provider}_${timedOut ? "delivery_timeout" : "delivery_failed"}`);
  }
}

function isEmail(contact: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.trim());
}

function normalizePhone(contact: string) {
  const trimmed = contact.trim();
  const digits = trimmed.replace(/[^\d]/g, "");
  if (trimmed.startsWith("+")) return `+${digits}`;
  return digits.length >= 10 ? `+${digits}` : digits;
}

function isPublicHttpsOrigin(value: string) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return "";
    if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/i.test(parsed.hostname)) return "";
    return parsed.origin;
  } catch {
    return "";
  }
}

function getWebUrl() {
  const candidates = [
    env("CONSUMER_PORTAL_URL"),
    env("NEXID_PUBLIC_WEB_URL"),
    env("NEXT_PUBLIC_WEB_URL"),
    env("NEXT_PUBLIC_WEB_BASE_URL"),
    env("WEB_BASE_URL"),
    env("VERCEL_URL"),
  ];
  for (const candidate of candidates) {
    const trimmed = String(candidate || "").trim();
    if (!trimmed) continue;
    const origin = isPublicHttpsOrigin(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    if (origin) return origin;
  }
  return "https://nexid.lat";
}

function verificationLink(contact: string, code: string, magicToken?: string) {
  const base = getWebUrl();
  if (magicToken) {
    return `${base}/login?t=${encodeURIComponent(magicToken)}`;
  }
  return `${base}/login?autoverify=1&contact=${encodeURIComponent(contact)}&code=${code}`;
}

function otpText(contact: string, code: string, ttlMinutes: number, magicToken?: string) {
  const link = verificationLink(contact, code, magicToken);
  return `Tu código nexID es ${code}. Vence en ${ttlMinutes} minutos. Ingresá el código en el portal o abrí este enlace seguro: ${link}`;
}

function otpHtml(contact: string, code: string, ttlMinutes: number, magicToken?: string) {
  const link = verificationLink(contact, code, magicToken);
  return `
    <div style="font-family:'Inter', Arial, sans-serif; background-color:#020617; color:#f8fafc; padding:40px 20px; text-align:center;">
      <div style="max-width:500px; margin:0 auto; background-color:#0b1329; border:1px solid rgba(6,182,212,0.15); border-radius:24px; overflow:hidden; box-shadow:0 20px 40px rgba(0,0,0,0.4); text-align:left;">
        <!-- Top branding banner -->
        <div style="background:linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); padding:32px 20px; text-align:center; border-bottom:1px solid rgba(255,255,255,0.05);">
          <div style="font-size:28px; font-weight:900; letter-spacing:-0.03em; color:#ffffff; margin:0 0 8px;">
            nex<span style="color:#06b6d4; font-weight:800;">ID</span>
          </div>
          <p style="margin:0; font-size:11px; text-transform:uppercase; letter-spacing:0.25em; color:#67e8f9; font-weight:700;">Global Digital Identity Passport</p>
        </div>
        
        <!-- Content body -->
        <div style="padding:40px 32px;">
          <h2 style="margin:0 0 12px; font-size:22px; font-weight:800; color:#ffffff; text-align:center;">¡Te damos la bienvenida!</h2>
          <p style="margin:0 0 24px; font-size:14px; line-height:1.6; color:#94a3b8; text-align:center;">
            Estás a un paso de acceder a tu pasaporte de identidad digital, gestionar credenciales vinculadas y solicitar beneficios según las políticas de la marca. Este acceso no autentica por sí solo ningún producto físico.
          </p>
          
          <div style="background-color:#020617; border:1px solid rgba(6,182,212,0.25); border-radius:16px; padding:24px; text-align:center; margin-bottom:28px; box-shadow:inset 0 2px 8px rgba(0,0,0,0.5);">
            <p style="margin:0 0 8px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.15em; color:#94a3b8;">Código de acceso temporal</p>
            <div style="font-size:36px; font-weight:900; letter-spacing:0.18em; color:#67e8f9; margin:0;">${code}</div>
            <p style="margin:8px 0 0; font-size:11px; color:#64748b;">Válido por ${ttlMinutes} minutos</p>
          </div>
          
          <div style="text-align:center; margin-bottom:28px;">
            <a href="${link}" style="display:inline-block; width:100%; box-sizing:border-box; background:linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); color:#020617; font-size:14px; font-weight:800; text-decoration:none; text-transform:uppercase; letter-spacing:0.08em; padding:16px 24px; border-radius:14px; transition:all 0.2s; box-shadow:0 8px 20px rgba(6,182,212,0.25);">
              Abrir Passport seguro
            </a>
            <p style="margin:8px 0 0; font-size:11px; color:#64748b;">También podés ingresar manualmente el código para una presentación limpia.</p>
          </div>
          
          <div style="border-top:1px solid rgba(255,255,255,0.05); padding-top:20px; font-size:12px; line-height:1.6; color:#64748b; text-align:center;">
            Este correo fue enviado de forma segura para validar tu identidad. Si no solicitaste este acceso, podés ignorar este mensaje de forma segura.
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color:#080e1e; padding:20px; text-align:center; border-top:1px solid rgba(255,255,255,0.05);">
          <p style="margin:0; font-size:11px; color:#475569;">© ${new Date().getFullYear()} nexID. Todos los derechos reservados.</p>
        </div>
      </div>
    </div>
  `;
}

class DemoOtpProvider implements ConsumerOtpProvider {
  async sendOtp(payload: OtpDeliveryPayload): Promise<OtpDeliveryResult> {
    if (isConsumerOtpProduction()) throw new Error("consumer_auth_demo_forbidden");
    const channel = consumerOtpDeliveryChannel(payload.contact);
    auditDelivery("demo", channel, "simulated");
    return { ok: true, delivery: { provider: "demo", channel, status: "simulated" } };
  }
}

class ResendEmailOtpProvider implements ConsumerOtpProvider {
  async sendOtp(payload: OtpDeliveryPayload): Promise<OtpDeliveryResult> {
    if (!isEmail(payload.contact)) throw new Error("email_contact_required");
    const apiKey = env("RESEND_API_KEY") || env("OTP_PROVIDER_API_KEY");
    const from = env("CONSUMER_AUTH_FROM_EMAIL") || env("OTP_FROM_EMAIL");
    if (!apiKey) throw new Error("resend_api_key_missing");
    if (!from) throw new Error("consumer_auth_from_email_missing");

    const replyTo = env("CONSUMER_AUTH_REPLY_TO_EMAIL") || env("OTP_REPLY_TO_EMAIL");
    const { response, data } = await providerRequest("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [payload.contact],
        subject: "Tu codigo nexID",
        text: otpText(payload.contact, payload.code, payload.ttlMinutes, payload.magicToken),
        html: otpHtml(payload.contact, payload.code, payload.ttlMinutes, payload.magicToken),
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    }, "resend", "email");
    if (typeof data?.id !== "string" || !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(data.id)) {
      auditDelivery("resend", "email", "failed", { httpStatus: response.status, providerStatus: "invalid_receipt" });
      throw new Error("resend_receipt_invalid");
    }
    return accepted("resend", "email", { httpStatus: response.status, providerStatus: "accepted", receiptHash: receiptHash(data.id) });
  }
}

class SmtpOtpProvider implements ConsumerOtpProvider {
  async sendOtp(payload: OtpDeliveryPayload): Promise<OtpDeliveryResult> {
    if (!isEmail(payload.contact)) throw new Error("email_contact_required");
    const host = env("SMTP_HOST") || "mail.privateemail.com";
    const port = Number(env("SMTP_PORT") || "465");
    const user = env("SMTP_USER");
    const pass = env("SMTP_PASSWORD");
    const from = env("SMTP_FROM_EMAIL") || env("CONSUMER_AUTH_FROM_EMAIL") || user;

    if (!user || !pass) {
      throw new Error("smtp_credentials_missing");
    }

    const secure = env("SMTP_SECURE") === "false" ? false : port === 465 || env("SMTP_SECURE") === "true";

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      dnsTimeout: DELIVERY_TIMEOUT_MS,
      connectionTimeout: DELIVERY_TIMEOUT_MS,
      greetingTimeout: DELIVERY_TIMEOUT_MS,
      socketTimeout: DELIVERY_TIMEOUT_MS,
      auth: {
        user,
        pass,
      },
    });

    try {
      // Driver timeouts close the SMTP connection before rejecting; an external
      // Promise.race would return a failure while the send could still continue.
      const info = await transporter.sendMail({
        from,
        to: payload.contact,
        subject: "Tu código nexID",
        text: otpText(payload.contact, payload.code, payload.ttlMinutes, payload.magicToken),
        html: otpHtml(payload.contact, payload.code, payload.ttlMinutes, payload.magicToken),
      });
      const acceptedAddresses = Array.isArray(info.accepted) ? info.accepted : [];
      const rejectedAddresses = Array.isArray(info.rejected) ? info.rejected : [];
      const address = (entry: string | { address: string }) => {
        const value = (typeof entry === "string" ? entry : entry.address || "").trim().toLowerCase();
        const separator = value.lastIndexOf("@");
        return separator < 0 ? value : `${value.slice(0, separator)}@${domainToASCII(value.slice(separator + 1))}`;
      };
      const recipient = address(payload.contact);
      const details = { acceptedCount: acceptedAddresses.length, rejectedCount: rejectedAddresses.length };
      if (!acceptedAddresses.some((entry) => address(entry) === recipient) || rejectedAddresses.some((entry) => address(entry) === recipient)) {
        auditDelivery("smtp", "email", "failed", { ...details, providerStatus: "recipient_not_accepted" });
        throw new Error("smtp_receipt_invalid");
      }
      return accepted("smtp", "email", { ...details, providerStatus: "accepted", ...(typeof info.messageId === "string" && info.messageId ? { receiptHash: receiptHash(info.messageId) } : {}) });
    } catch (error) {
      if (error instanceof Error && error.message === "smtp_receipt_invalid") throw error;
      const failure = error && typeof error === "object" ? error as { code?: unknown; responseCode?: unknown } : {};
      const statusByCode: Record<string, string> = { EAUTH: "authentication_failed", ECONNECTION: "connection_failed", ETIMEDOUT: "timeout", ESOCKET: "socket_failed", EDNS: "dns_failed", EENVELOPE: "envelope_failed", EMESSAGE: "message_failed", ESTREAM: "stream_failed" };
      const providerStatus = typeof failure.code === "string" && Object.hasOwn(statusByCode, failure.code) ? statusByCode[failure.code] : "request_failed";
      const timedOut = providerStatus === "timeout";
      const errorCode = typeof failure.responseCode === "number" && Number.isSafeInteger(failure.responseCode) ? failure.responseCode : undefined;
      auditDelivery("smtp", "email", "failed", { providerStatus: timedOut ? "timeout" : providerStatus, ...(errorCode !== undefined ? { errorCode } : {}) });
      throw new Error(timedOut ? "smtp_delivery_timeout" : "smtp_delivery_failed");
    } finally {
      transporter.close();
    }
  }
}


class TwilioOtpProvider implements ConsumerOtpProvider {
  constructor(private readonly channel: TwilioChannel) {}

  async sendOtp(payload: OtpDeliveryPayload): Promise<OtpDeliveryResult> {
    if (isEmail(payload.contact)) throw new Error(`${this.channel}_phone_contact_required`);
    const accountSid = env("TWILIO_ACCOUNT_SID");
    const authToken = env("TWILIO_AUTH_TOKEN");
    // The dedicated OTP sender never changes shared campaign/SMS configuration
    // and must take precedence over a shared Messaging Service sender pool.
    const consumerWhatsappFrom = this.channel === "whatsapp" ? getConsumerOtpWhatsappFrom() : null;
    const messagingServiceSid = consumerWhatsappFrom ? "" : env("TWILIO_MESSAGING_SERVICE_SID");
    const from = this.channel === "whatsapp"
      ? consumerWhatsappFrom || env("TWILIO_WHATSAPP_FROM") || env("TWILIO_FROM_WHATSAPP")
      : env("TWILIO_FROM_NUMBER") || env("TWILIO_FROM");
    if (!accountSid || !authToken) throw new Error("twilio_credentials_missing");
    if (!messagingServiceSid && !from) throw new Error("twilio_sender_missing");
    if (this.channel === "whatsapp" && !messagingServiceSid && isConsumerOtpProduction() && normalizePhone(from) === "+14155238886") {
      throw new Error("twilio_whatsapp_sandbox_forbidden");
    }

    const toPhone = normalizePhone(payload.contact);
    const to = this.channel === "whatsapp" ? `whatsapp:${toPhone}` : toPhone;
    const body = new URLSearchParams();
    body.set("To", to);
    const contentSid = this.channel === "whatsapp" ? env("TWILIO_WHATSAPP_AUTH_CONTENT_SID") : "";
    if (contentSid) {
      if (!/^HX[a-fA-F\d]{32}$/.test(contentSid)) throw new Error("twilio_content_sid_invalid");
      body.set("ContentSid", contentSid);
      body.set("ContentVariables", JSON.stringify({ "1": payload.code }));
    } else {
      // Compatibility fallback until an approved authentication template is
      // configured. WhatsApp free-form delivery requires an open service window.
      body.set("Body", otpText(payload.contact, payload.code, payload.ttlMinutes, payload.magicToken));
    }
    const statusCallback = getConsumerOtpTwilioStatusCallbackUrl();
    if (statusCallback) body.set("StatusCallback", statusCallback);
    if (messagingServiceSid) {
      body.set("MessagingServiceSid", messagingServiceSid);
    } else {
      body.set("From", this.channel === "whatsapp" ? `whatsapp:${from.replace(/^whatsapp:/, "")}` : from);
    }

    const basic = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const { response, data } = await providerRequest(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    }, "twilio", this.channel);
    const status = typeof data?.status === "string" ? data.status : "";
    const allowedStatuses = ["accepted", "queued", "sending", "sent", "delivered", "read"];
    const knownStatuses = [...allowedStatuses, "scheduled", "canceled", "failed", "undelivered", "receiving", "received"];
    const validSid = typeof data?.sid === "string" && /^(SM|MM)[a-f\d]{32}$/i.test(data.sid);
    const errorCode = typeof data?.error_code === "number" && Number.isSafeInteger(data.error_code) ? data.error_code : undefined;
    const details = { httpStatus: response.status, providerStatus: knownStatuses.includes(status) ? status : "invalid_receipt", ...(validSid ? { receiptHash: receiptHash(data!.sid as string) } : {}), ...(errorCode !== undefined ? { errorCode } : {}) };
    if (!validSid || !allowedStatuses.includes(status) || (data?.error_code !== null && data?.error_code !== undefined)) {
      auditDelivery("twilio", this.channel, "failed", details);
      throw new Error("twilio_receipt_invalid");
    }
    return accepted("twilio", this.channel, details);
  }
}

class EmailOtpProvider implements ConsumerOtpProvider {
  private readonly resend = new ResendEmailOtpProvider();
  private readonly smtp = new SmtpOtpProvider();

  constructor(private readonly legacySmtpOnly = false) {}

  async sendOtp(payload: OtpDeliveryPayload): Promise<OtpDeliveryResult> {
    if (!isEmail(payload.contact)) throw new Error("email_contact_required");
    const selected = env("CONSUMER_AUTH_EMAIL_PROVIDER").toLowerCase();
    if (selected && selected !== "smtp" && selected !== "resend") throw new Error("consumer_auth_email_provider_invalid");
    // An explicit choice never falls back to the other provider, even if it has
    // usable credentials. Empty configuration preserves each legacy mode.
    if (selected === "smtp" || (!selected && (this.legacySmtpOnly || (env("SMTP_USER") && env("SMTP_PASSWORD"))))) {
      return this.smtp.sendOtp(payload);
    }
    return this.resend.sendOtp(payload);
  }
}

class SmartOtpProvider implements ConsumerOtpProvider {
  private readonly email = new EmailOtpProvider();
  private readonly sms = new TwilioOtpProvider("sms");
  private readonly whatsapp = new TwilioOtpProvider("whatsapp");

  async sendOtp(payload: OtpDeliveryPayload): Promise<OtpDeliveryResult> {
    if (isEmail(payload.contact)) {
      return this.email.sendOtp(payload);
    }
    const channel = env("CONSUMER_PHONE_OTP_CHANNEL").toLowerCase();
    if (channel === "whatsapp") return this.whatsapp.sendOtp(payload);
    if (channel && channel !== "sms") throw new Error("consumer_phone_otp_channel_invalid");
    return this.sms.sendOtp(payload);
  }
}

export function resolveConsumerOtpProvider() {
  const mode = consumerOtpDeliveryMode();
  if (mode === "invalid") throw new Error("consumer_auth_mode_invalid");
  if (mode === "demo") {
    if (isConsumerOtpProduction()) throw new Error("consumer_auth_demo_forbidden");
    return new DemoOtpProvider();
  }
  if (mode === "smtp") return new EmailOtpProvider(true);
  if (mode === "email" || mode === "resend") return new EmailOtpProvider();
  if (mode === "sms" || mode === "twilio") return new TwilioOtpProvider("sms");
  if (mode === "whatsapp" || mode === "twilio_whatsapp") return new TwilioOtpProvider("whatsapp");
  return new SmartOtpProvider();
}

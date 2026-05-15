export type OtpDeliveryPayload = {
  contact: string;
  code: string;
  ttlMinutes: number;
};

export interface ConsumerOtpProvider {
  sendOtp(payload: OtpDeliveryPayload): Promise<{ ok: true }>;
}

type TwilioChannel = "sms" | "whatsapp";

function env(name: string) {
  return String(process.env[name] || "").trim();
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

function maskContact(contact: string) {
  if (isEmail(contact)) {
    const [name, domain] = contact.split("@");
    return `${name.slice(0, 2)}***@${domain}`;
  }
  const phone = normalizePhone(contact);
  return `${phone.slice(0, 4)}***${phone.slice(-3)}`;
}

function otpText(code: string, ttlMinutes: number) {
  return `Tu codigo nexID es ${code}. Vence en ${ttlMinutes} minutos. No lo compartas. Se usa para reclamar ownership, Passport, wallet y NFT del producto.`;
}

function otpHtml(code: string, ttlMinutes: number) {
  return `
    <div style="font-family:Inter,Arial,sans-serif;background:#06111f;color:#f8fafc;padding:24px;border-radius:16px">
      <p style="margin:0 0 8px;color:#67e8f9;text-transform:uppercase;letter-spacing:.18em;font-size:12px">nexID owner claim</p>
      <h1 style="margin:0 0 16px;font-size:24px">Codigo de verificacion</h1>
      <p style="font-size:16px;line-height:1.5;color:#cbd5e1">Usa este codigo para asociar el producto fisico a tu Passport, wallet y NFT.</p>
      <div style="margin:20px 0;padding:16px;border:1px solid rgba(103,232,249,.35);border-radius:12px;background:#020617;font-size:32px;font-weight:800;letter-spacing:.18em;text-align:center">${code}</div>
      <p style="font-size:14px;color:#94a3b8">Vence en ${ttlMinutes} minutos. No lo compartas con nadie.</p>
    </div>
  `;
}

async function requireOk(res: Response, provider: string) {
  if (res.ok) return;
  const detail = await res.text().catch(() => "");
  throw new Error(`${provider}_delivery_failed:${res.status}${detail ? `:${detail.slice(0, 160)}` : ""}`);
}

class DemoOtpProvider implements ConsumerOtpProvider {
  async sendOtp(): Promise<{ ok: true }> {
    return { ok: true };
  }
}

class ResendEmailOtpProvider implements ConsumerOtpProvider {
  async sendOtp(payload: OtpDeliveryPayload): Promise<{ ok: true }> {
    if (!isEmail(payload.contact)) throw new Error("email_contact_required");
    const apiKey = env("RESEND_API_KEY") || env("OTP_PROVIDER_API_KEY");
    const from = env("CONSUMER_AUTH_FROM_EMAIL") || env("OTP_FROM_EMAIL");
    if (!apiKey) throw new Error("resend_api_key_missing");
    if (!from) throw new Error("consumer_auth_from_email_missing");

    const replyTo = env("CONSUMER_AUTH_REPLY_TO_EMAIL") || env("OTP_REPLY_TO_EMAIL");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [payload.contact],
        subject: "Tu codigo nexID",
        text: otpText(payload.code, payload.ttlMinutes),
        html: otpHtml(payload.code, payload.ttlMinutes),
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    await requireOk(response, "resend");
    return { ok: true };
  }
}

class TwilioOtpProvider implements ConsumerOtpProvider {
  constructor(private readonly channel: TwilioChannel) {}

  async sendOtp(payload: OtpDeliveryPayload): Promise<{ ok: true }> {
    if (isEmail(payload.contact)) throw new Error(`${this.channel}_phone_contact_required`);
    const accountSid = env("TWILIO_ACCOUNT_SID");
    const authToken = env("TWILIO_AUTH_TOKEN");
    const messagingServiceSid = env("TWILIO_MESSAGING_SERVICE_SID");
    const from = this.channel === "whatsapp"
      ? env("TWILIO_WHATSAPP_FROM") || env("TWILIO_FROM_WHATSAPP")
      : env("TWILIO_FROM_NUMBER") || env("TWILIO_FROM");
    if (!accountSid || !authToken) throw new Error("twilio_credentials_missing");
    if (!messagingServiceSid && !from) throw new Error("twilio_sender_missing");

    const toPhone = normalizePhone(payload.contact);
    const to = this.channel === "whatsapp" ? `whatsapp:${toPhone}` : toPhone;
    const body = new URLSearchParams();
    body.set("To", to);
    body.set("Body", otpText(payload.code, payload.ttlMinutes));
    if (messagingServiceSid) {
      body.set("MessagingServiceSid", messagingServiceSid);
    } else {
      body.set("From", this.channel === "whatsapp" ? `whatsapp:${from.replace(/^whatsapp:/, "")}` : from);
    }

    const basic = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    await requireOk(response, "twilio");
    return { ok: true };
  }
}

class SmartOtpProvider implements ConsumerOtpProvider {
  private readonly email = new ResendEmailOtpProvider();
  private readonly sms = new TwilioOtpProvider("sms");
  private readonly whatsapp = new TwilioOtpProvider("whatsapp");

  async sendOtp(payload: OtpDeliveryPayload): Promise<{ ok: true }> {
    if (isEmail(payload.contact)) return this.email.sendOtp(payload);
    const channel = env("CONSUMER_PHONE_OTP_CHANNEL").toLowerCase();
    if (channel === "whatsapp") return this.whatsapp.sendOtp(payload);
    return this.sms.sendOtp(payload);
  }
}

class NoopExternalOtpProvider implements ConsumerOtpProvider {
  async sendOtp(payload: OtpDeliveryPayload): Promise<{ ok: true }> {
    const apiKey = env("OTP_PROVIDER_API_KEY");
    if (!apiKey) throw new Error("otp_provider_api_key_missing");
    console.log("[consumer_auth_delivery_audit]", JSON.stringify({
      event: "consumer_auth_provider_noop",
      contact: maskContact(payload.contact),
      at: new Date().toISOString(),
    }));
    return { ok: true };
  }
}

export function resolveConsumerOtpProvider() {
  const mode = env("CONSUMER_AUTH_MODE").toLowerCase() || "demo";
  if (mode === "email" || mode === "resend") return new ResendEmailOtpProvider();
  if (mode === "sms" || mode === "twilio") return new TwilioOtpProvider("sms");
  if (mode === "whatsapp" || mode === "twilio_whatsapp") return new TwilioOtpProvider("whatsapp");
  if (mode === "smart" || mode === "production") return new SmartOtpProvider();
  if (mode === "provider") {
    if (env("RESEND_API_KEY") || env("TWILIO_ACCOUNT_SID")) return new SmartOtpProvider();
    return new NoopExternalOtpProvider();
  }
  return new DemoOtpProvider();
}

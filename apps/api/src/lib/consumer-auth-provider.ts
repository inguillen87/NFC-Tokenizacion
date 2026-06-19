import nodemailer from "nodemailer";

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

function getWebUrl() {
  const envUrl = process.env.NEXT_PUBLIC_WEB_URL || process.env.NEXT_PUBLIC_WEB_BASE_URL || process.env.VERCEL_URL;
  if (!envUrl) return "https://nexid.lat";
  const trimmed = envUrl.trim();
  if (trimmed.startsWith("http")) return trimmed.replace(/\/$/, "");
  return `https://${trimmed}`;
}

function verificationLink(contact: string, code: string) {
  const base = getWebUrl();
  return `${base}/login?autoverify=1&contact=${encodeURIComponent(contact)}&code=${code}`;
}

function otpText(contact: string, code: string, ttlMinutes: number) {
  const link = verificationLink(contact, code);
  return `Tu codigo nexID es ${code}. Vence en ${ttlMinutes} minutos. Ingresa automaticamente haciendo clic aca: ${link}`;
}

function otpHtml(contact: string, code: string, ttlMinutes: number) {
  const link = verificationLink(contact, code);
  return `
    <div style="font-family:'Inter', Arial, sans-serif; background-color:#020617; color:#f8fafc; padding:40px 20px; text-align:center;">
      <div style="max-width:500px; margin:0 auto; background-color:#0b1329; border:1px solid rgba(6,182,212,0.15); border-radius:24px; overflow:hidden; box-shadow:0 20px 40px rgba(0,0,0,0.4); text-align:left;">
        <!-- Top branding banner -->
        <div style="background:linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); padding:32px 20px; text-align:center; border-bottom:1px solid rgba(255,255,255,0.05);">
          <div style="font-size:28px; font-weight:900; letter-spacing:-0.03em; color:#ffffff; margin:0 0 8px;">
            nex<span style="color:#06b6d4; font-weight:800;">ID</span>
          </div>
          <p style="margin:0; font-size:11px; text-transform:uppercase; letter-spacing:0.25em; color:#67e8f9; font-weight:700;">Global Authenticity Passport</p>
        </div>
        
        <!-- Content body -->
        <div style="padding:40px 32px;">
          <h2 style="margin:0 0 12px; font-size:22px; font-weight:800; color:#ffffff; text-align:center;">¡Te damos la bienvenida!</h2>
          <p style="margin:0 0 24px; font-size:14px; line-height:1.6; color:#94a3b8; text-align:center;">
            Estás a un paso de acceder a tu pasaporte digital de autenticidad, registrar la propiedad de tus productos premium y sumar puntos de fidelización exclusiva.
          </p>
          
          <div style="background-color:#020617; border:1px solid rgba(6,182,212,0.25); border-radius:16px; padding:24px; text-align:center; margin-bottom:28px; box-shadow:inset 0 2px 8px rgba(0,0,0,0.5);">
            <p style="margin:0 0 8px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.15em; color:#94a3b8;">Código de acceso temporal</p>
            <div style="font-size:36px; font-weight:900; letter-spacing:0.18em; color:#67e8f9; margin:0;">${code}</div>
            <p style="margin:8px 0 0; font-size:11px; color:#64748b;">Válido por ${ttlMinutes} minutos</p>
          </div>
          
          <div style="text-align:center; margin-bottom:28px;">
            <a href="${link}" style="display:inline-block; width:100%; box-sizing:border-box; background:linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); color:#020617; font-size:14px; font-weight:800; text-decoration:none; text-transform:uppercase; letter-spacing:0.08em; padding:16px 24px; border-radius:14px; transition:all 0.2s; box-shadow:0 8px 20px rgba(6,182,212,0.25);">
              Ingresar automáticamente
            </a>
            <p style="margin:8px 0 0; font-size:11px; color:#64748b;">(Acceso seguro de un solo clic sin contraseñas)</p>
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
        text: otpText(payload.contact, payload.code, payload.ttlMinutes),
        html: otpHtml(payload.contact, payload.code, payload.ttlMinutes),
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    await requireOk(response, "resend");
    return { ok: true };
  }
}

class SmtpOtpProvider implements ConsumerOtpProvider {
  async sendOtp(payload: OtpDeliveryPayload): Promise<{ ok: true }> {
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
      auth: {
        user,
        pass,
      },
    });

    try {
      await transporter.sendMail({
        from,
        to: payload.contact,
        subject: "Tu código nexID",
        text: otpText(payload.contact, payload.code, payload.ttlMinutes),
        html: otpHtml(payload.contact, payload.code, payload.ttlMinutes),
      });
    } catch (error) {
      throw new Error(`smtp_delivery_failed:${error instanceof Error ? error.message : String(error)}`);
    }

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
    body.set("Body", otpText(payload.contact, payload.code, payload.ttlMinutes));
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
  private readonly resend = new ResendEmailOtpProvider();
  private readonly smtp = new SmtpOtpProvider();
  private readonly sms = new TwilioOtpProvider("sms");
  private readonly whatsapp = new TwilioOtpProvider("whatsapp");

  async sendOtp(payload: OtpDeliveryPayload): Promise<{ ok: true }> {
    if (isEmail(payload.contact)) {
      if (env("SMTP_USER") && env("SMTP_PASSWORD")) {
        return this.smtp.sendOtp(payload);
      }
      return this.resend.sendOtp(payload);
    }
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
  const defaultMode = process.env.NODE_ENV === "production" || process.env.VERCEL === "1" ? "smart" : "demo";
  const mode = env("CONSUMER_AUTH_MODE").toLowerCase() || defaultMode;
  if (mode === "smtp") return new SmtpOtpProvider();
  if (mode === "email" || mode === "resend") {
    if (env("SMTP_USER") && env("SMTP_PASSWORD")) return new SmtpOtpProvider();
    return new ResendEmailOtpProvider();
  }
  if (mode === "sms" || mode === "twilio") return new TwilioOtpProvider("sms");
  if (mode === "whatsapp" || mode === "twilio_whatsapp") return new TwilioOtpProvider("whatsapp");
  if (mode === "smart" || mode === "production") return new SmartOtpProvider();
  if (mode === "provider") {
    if (env("RESEND_API_KEY") || env("TWILIO_ACCOUNT_SID") || (env("SMTP_USER") && env("SMTP_PASSWORD"))) return new SmartOtpProvider();
    return new NoopExternalOtpProvider();
  }
  return new DemoOtpProvider();
}

export type OtpDeliveryPayload = {
  contact: string;
  code: string;
  ttlMinutes: number;
};

export interface ConsumerOtpProvider {
  sendOtp(payload: OtpDeliveryPayload): Promise<{ ok: true }>;
}

class DemoOtpProvider implements ConsumerOtpProvider {
  async sendOtp(): Promise<{ ok: true }> {
    return { ok: true };
  }
}

class NoopExternalOtpProvider implements ConsumerOtpProvider {
  async sendOtp(_payload: OtpDeliveryPayload): Promise<{ ok: true }> {
    const apiKey = String(process.env.OTP_PROVIDER_API_KEY || "").trim();
    if (!apiKey) throw new Error("otp_provider_api_key_missing");
    return { ok: true };
  }
}

export function resolveConsumerOtpProvider() {
  const mode = String(process.env.CONSUMER_AUTH_MODE || "demo").toLowerCase();
  return mode === "provider" ? new NoopExternalOtpProvider() : new DemoOtpProvider();
}

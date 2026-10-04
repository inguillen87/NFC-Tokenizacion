type DeliveryPayload = {
  deliveryChannel?: unknown;
  delivery?: { channel?: unknown; status?: unknown };
  secondaryDelivery?: { channel?: unknown; status?: unknown };
};

export const CONSUMER_ACCESS_UNKNOWN_ERROR = "No pudimos iniciar el acceso. Tu contacto se conserva; volvé a intentar o elegí el otro medio.";

export function authStartErrorMessage(error: unknown) {
  const reason = String(error || "");
  if (reason === "twilio_whatsapp_sandbox_forbidden") {
    return "WhatsApp todavía no está disponible. Elegí email para recibir tu código.";
  }
  if (["consumer_auth_email_provider_invalid", "twilio_content_sid_invalid", "twilio_status_callback_url_invalid"].includes(reason)) {
    return "Este canal no está disponible ahora. Elegí el otro medio de acceso para continuar.";
  }
  if (reason === "rate_limited") return "Demasiados intentos. Esperá unos minutos y probá de nuevo.";
  if (reason === "resend_api_key_missing" || reason === "consumer_auth_from_email_missing" || reason === "smtp_credentials_missing") {
    return "No pudimos solicitar el código por email. Podés continuar con WhatsApp o intentar más tarde.";
  }
  if (["twilio_credentials_missing", "twilio_sender_missing", "twilio_authentication_failed",
    "consumer_whatsapp_provider_invalid", "meta_configuration_missing", "meta_configuration_invalid", "meta_authentication_failed", "meta_payload_invalid"].includes(reason)) {
    return "WhatsApp no está disponible ahora. Continuá con email para recibir tu código.";
  }
  if (reason === "twilio_delivery_failed" || reason === "resend_delivery_failed" || reason === "smtp_delivery_failed" || reason === "meta_delivery_failed") {
    return "No se pudo confirmar el envío. Podés continuar con el otro medio de acceso. Si el código llega más tarde, usá el más reciente.";
  }
  if (["otp_provider_unavailable", "consumer_auth_mode_invalid", "consumer_auth_demo_forbidden", "consumer_phone_otp_channel_invalid", "smtp_receipt_invalid", "resend_receipt_invalid", "twilio_receipt_invalid", "meta_receipt_invalid", "smtp_delivery_timeout", "resend_delivery_timeout", "twilio_delivery_timeout", "meta_delivery_timeout"].includes(reason)) return "Este canal no pudo confirmar el envío del código. Probá el otro medio de acceso. Si el mensaje llega más tarde, usá siempre el código más reciente.";
  return CONSUMER_ACCESS_UNKNOWN_ERROR;
}

export function consumerDeliveryMessage(payload: DeliveryPayload) {
  const channel = payload.delivery?.channel || payload.deliveryChannel;
  const label = channel === "whatsapp" ? "WhatsApp" : channel === "sms" ? "SMS" : channel === "email" ? "email" : "el canal de acceso";
  if (payload.delivery?.status === "accepted") {
    const secondary = payload.secondaryDelivery?.status === "failed"
      ? " El canal adicional no pudo recibir la solicitud. Ingresá el código que llegue al principal."
      : "";
    return `Solicitud de código aceptada por ${label}. Ingresalo cuando llegue. La entrega todavía no está confirmada.${secondary}`;
  }
  if (payload.deliveryChannel === "both" || payload.deliveryChannel === "email_and_phone_same_challenge") {
    return "Solicitaste el mismo código por email y teléfono. Ingresalo cuando llegue a cualquiera de los dos. La entrega todavía no está confirmada.";
  }
  return `Solicitud aceptada por ${label}. La entrega todavía no está confirmada. Ingresá el código cuando llegue.`;
}

export function consumerDeliveryIsSimulation(payload: { mode?: unknown; deliveryChannel?: unknown }) {
  const mode = String(payload.mode || "").trim().replace(/^["']|["']$/g, "").toLowerCase();
  return mode === "demo" || payload.deliveryChannel === "demo";
}

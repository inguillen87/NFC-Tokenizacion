type DeliveryPayload = {
  deliveryChannel?: unknown;
  delivery?: { channel?: unknown; status?: unknown };
  secondaryDelivery?: { channel?: unknown; status?: unknown };
};

export function authStartErrorMessage(error: unknown) {
  const reason = String(error || "");
  if (reason === "twilio_whatsapp_sandbox_forbidden") {
    return "WhatsApp todavía no está disponible. Elegí email para recibir tu código.";
  }
  if (["consumer_auth_email_provider_invalid", "twilio_content_sid_invalid", "twilio_status_callback_url_invalid"].includes(reason)) {
    return "Este canal todavía no está configurado. Probá el otro medio de acceso.";
  }
  if (reason === "rate_limited") return "Demasiados intentos. Esperá unos minutos y probá de nuevo.";
  if (reason === "resend_api_key_missing" || reason === "consumer_auth_from_email_missing" || reason === "smtp_credentials_missing") {
    return "No se pudo enviar el email porque falta configurar el proveedor de correo en producción.";
  }
  if (reason === "twilio_credentials_missing" || reason === "twilio_sender_missing") {
    return "No se pudo enviar el código por teléfono porque falta configurar Twilio.";
  }
  if (reason === "twilio_delivery_failed" || reason === "resend_delivery_failed" || reason === "smtp_delivery_failed") {
    return "No se pudo confirmar el envío. Revisá el contacto o probá el otro canal. Si se repite, contactá a soporte.";
  }
  if (["otp_provider_unavailable", "consumer_auth_mode_invalid", "consumer_auth_demo_forbidden", "consumer_phone_otp_channel_invalid", "smtp_receipt_invalid", "resend_receipt_invalid", "twilio_receipt_invalid", "smtp_delivery_timeout", "resend_delivery_timeout", "twilio_delivery_timeout"].includes(reason)) return "Este canal no pudo confirmar el envío del código. Probá el otro medio de acceso. Si el mensaje llega más tarde, usá siempre el código más reciente.";
  return "No se pudo iniciar sesión.";
}

export function consumerDeliveryMessage(payload: DeliveryPayload) {
  const channel = payload.delivery?.channel || payload.deliveryChannel;
  const label = channel === "whatsapp" ? "WhatsApp" : channel === "sms" ? "SMS" : channel === "email" ? "email" : "el canal de acceso";
  if (payload.delivery?.status === "accepted") {
    const secondary = payload.secondaryDelivery?.status === "failed"
      ? " El canal adicional no pudo recibir la solicitud; usá el principal."
      : "";
    return `El proveedor aceptó el envío por ${label}. Ingresá el código cuando llegue. Esto no confirma todavía su entrega.${secondary}`;
  }
  if (payload.deliveryChannel === "both" || payload.deliveryChannel === "email_and_phone_same_challenge") {
    return "Solicitud aceptada para el mismo código a los canales configurados. La entrega todavía no está confirmada; este acceso no constituye MFA secuencial.";
  }
  return `Solicitud aceptada por ${label}. La entrega todavía no está confirmada. Ingresá el código cuando llegue.`;
}

export function consumerDeliveryIsSimulation(payload: { mode?: unknown; deliveryChannel?: unknown }) {
  const mode = String(payload.mode || "").trim().replace(/^["']|["']$/g, "").toLowerCase();
  return mode === "demo" || payload.deliveryChannel === "demo";
}

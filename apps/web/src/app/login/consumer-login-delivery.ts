type DeliveryPayload = {
  deliveryChannel?: unknown;
  delivery?: { channel?: unknown; status?: unknown };
  secondaryDelivery?: { channel?: unknown; status?: unknown };
};

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

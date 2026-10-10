export type ConsumerSecurityContacts = {
  id: string;
  email?: string | null;
  phone?: string | null;
  status?: string;
};

// Matches the deployed associate/start and associate/verify contract. Reopening
// requires consumer-bound verification on the API before adding UI controls.
export const CONSUMER_CONTACT_LINKING = {
  available: false,
  state: "feature_disabled",
  httpStatus: 503,
  error: "contact_linking_temporarily_unavailable",
  message: "La vinculación de un nuevo email o WhatsApp está temporalmente deshabilitada. Tus contactos actuales se conservan.",
} as const;

export function buildConsumerContactSecurityModel(consumer: ConsumerSecurityContacts) {
  const contacts: Array<{ channel: "email" | "whatsapp"; label: string; value: string }> = [];
  if (typeof consumer.email === "string" && consumer.email.trim()) {
    contacts.push({ channel: "email", label: "Correo electrónico", value: consumer.email });
  }
  if (typeof consumer.phone === "string" && consumer.phone.trim()) {
    contacts.push({ channel: "whatsapp", label: "WhatsApp", value: consumer.phone });
  }
  return { contacts, hasBothLinkedChannels: contacts.length === 2, linking: CONSUMER_CONTACT_LINKING };
}

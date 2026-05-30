export type ConsumerContact =
  | { ok: true; contact: string; type: "email" | "phone" }
  | { ok: false; error: "contact_required" | "invalid_email" | "invalid_phone" };

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function normalizePhone(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  return digits.length >= 10 ? `+${digits}` : digits;
}

function isValidPhone(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

export function parseConsumerContact(input: unknown): ConsumerContact {
  const body = (input || {}) as { email?: unknown; phone?: unknown; contact?: unknown };
  const email = String(body.email || "").trim();
  const phone = String(body.phone || "").trim();
  const contact = String(body.contact || "").trim();

  if (email) {
    if (!isValidEmail(email)) return { ok: false, error: "invalid_email" };
    return { ok: true, contact: email.toLowerCase(), type: "email" };
  }

  if (phone) {
    if (!isValidPhone(phone)) return { ok: false, error: "invalid_phone" };
    return { ok: true, contact: normalizePhone(phone), type: "phone" };
  }

  if (!contact) return { ok: false, error: "contact_required" };
  if (contact.includes("@")) {
    if (!isValidEmail(contact)) return { ok: false, error: "invalid_email" };
    return { ok: true, contact: contact.toLowerCase(), type: "email" };
  }
  if (!isValidPhone(contact)) return { ok: false, error: "invalid_phone" };
  return { ok: true, contact: normalizePhone(contact), type: "phone" };
}

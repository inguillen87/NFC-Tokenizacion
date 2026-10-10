type Contact = { channel: "email" | "whatsapp"; label: string; value: string };
export type PassportAccountModel =
  | { state: "unavailable" }
  | { state: "ready"; name: string | null; contacts: Contact[]; status: { label: string; state: "registered" | "verified" | "anonymous" | "unknown" }; counts: { products: number | null; taps: number | null; memberships: number | null } };

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function count(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function passportAccountModel(payload: unknown): PassportAccountModel {
  const envelope = record(payload), consumer = record(envelope?.consumer);
  if (envelope?.ok !== true || !consumer || !text(consumer.id)) return { state: "unavailable" };
  const stats = record(envelope.stats);
  const email = text(consumer.email), phone = text(consumer.phone), displayName = text(consumer.display_name);
  const contacts: Contact[] = [];
  if (email) contacts.push({ channel: "email", label: "Correo electrónico", value: email });
  if (phone) contacts.push({ channel: "whatsapp", label: "WhatsApp", value: phone });
  const status = consumer.status === "registered" ? { state: "registered" as const, label: "Registrada" }
    : consumer.status === "verified" ? { state: "verified" as const, label: "Verificada" }
      : consumer.status === "anonymous" ? { state: "anonymous" as const, label: "De consulta" }
        : { state: "unknown" as const, label: "No informado" };
  return {
    state: "ready",
    name: displayName?.toLowerCase() === email?.toLowerCase() ? null : displayName,
    contacts, status,
    counts: { products: count(stats?.products), taps: count(stats?.taps), memberships: count(stats?.memberships) },
  };
}

/** A reported canonical tenant query can scope existing consultation pages.
 * It grants no membership or access and never substitutes a display name. */
export function passportTenant(value: unknown): string | null {
  return typeof value === "string" && /^[a-z0-9][a-z0-9._-]{0,119}$/.test(value) ? value : null;
}

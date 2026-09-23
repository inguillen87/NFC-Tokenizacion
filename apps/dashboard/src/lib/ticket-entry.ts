import { canonicalTicketReference } from "./ticket-reference-lookup";
import type { CustomerInbox } from "./customer-inbox-state";

/** A loaded row is only a locator. The existing scoped reader authorizes every opening. */
export function ticketEntryReference(value: unknown, inbox: CustomerInbox, tenantScope: string, isDemo: boolean, canLookup: boolean): string | null {
  const reference = canonicalTicketReference(value);
  if (!reference || isDemo || !canLookup || inbox.availability !== "ready" || inbox.source !== "production") return null;
  const matches = inbox.rows.filter(row => canonicalTicketReference(row.id) === reference);
  if (matches.length !== 1) return null;
  const tenant = typeof matches[0].tenant_slug === "string" ? matches[0].tenant_slug.trim().toLowerCase() : "";
  return tenantScope && tenant !== tenantScope ? null : reference;
}

export const ticketEntryCopy = {
  "es-AR": { open: "Abrir ticket", actions: "Acciones", locked: "Terminá de confirmar el cambio de este ticket antes de abrir otro o cambiar de bandeja. Si el resultado no está confirmado, reintentá el mismo cambio." },
  en: { open: "Open ticket", actions: "Actions", locked: "Finish confirming this ticket change before opening another ticket or switching inboxes. If the outcome is unconfirmed, retry the same change." },
  "pt-BR": { open: "Abrir ticket", actions: "Ações", locked: "Conclua a confirmação da alteração deste ticket antes de abrir outro ou mudar de caixa. Se o resultado não estiver confirmado, tente novamente a mesma alteração." },
};

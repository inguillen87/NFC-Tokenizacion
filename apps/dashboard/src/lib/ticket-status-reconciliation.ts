import type { CustomerInbox, CustomerInboxContext } from "./customer-inbox-state";
import type { CustomerSignalRecord } from "./customer-signal-timeline";
import { canonicalTicketReference } from "./ticket-reference-lookup";
import type { WorkflowCurrent } from "./ticket-workflow";

/** Authenticated current state may update presentation, never ticket scope or an operation's outcome. */
export function reconcileAuthoritativeTicketStatus<T extends CustomerSignalRecord>(
  inbox: CustomerInbox<T>, current: WorkflowCurrent, context: CustomerInboxContext & { canLookupTickets: boolean },
): CustomerInbox<T> {
  if (context.demoMode || !context.canLookupTickets || inbox.availability !== "ready" || inbox.source !== "production"
    || !canonicalTicketReference(current.ticketId) || !canonicalTicketReference(current.tenantId)
    || !current.tenantSlug || context.tenantScope && current.tenantSlug !== context.tenantScope
    || typeof current.status !== "string" || !current.status.trim() || current.status.length > 64 || /[\u0000-\u001f\u007f-\u009f]/.test(current.status)
    || !/^[a-f0-9]{64}$/.test(current.revision)) return inbox;
  const matches = inbox.rows.filter(row => canonicalTicketReference(row.id) === current.ticketId);
  if (matches.length !== 1) return inbox;
  const previous = matches[0];
  if (previous.tenant_id !== current.tenantId || previous.tenant_slug !== current.tenantSlug || previous.status === current.status) return inbox;
  return { ...inbox, rows: inbox.rows.map(row => row === previous ? { ...row, status: current.status } : row) };
}

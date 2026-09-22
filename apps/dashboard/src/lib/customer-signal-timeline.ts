import { projectSupportTicket, type SupportTicketProjection } from "./support-ticket-projection";

export type CustomerSignalAvailability =
  | "ready"
  | "upstream_error"
  | "invalid_payload"
  | "unreachable"
  | "access_denied";

export type CustomerSignalSource = "production" | "demo" | "unavailable";
export type CustomerSignalKind = "lead" | "ticket" | "order";

export type CustomerSignalCollectionState = {
  availability: CustomerSignalAvailability;
  source: CustomerSignalSource;
};

export type CustomerSignalCollections = {
  leads: CustomerSignalCollectionState;
  tickets: CustomerSignalCollectionState;
  orders: CustomerSignalCollectionState;
};

export type CustomerSignalRecord = Record<string, unknown>;

export type CustomerLeadRecord = CustomerSignalRecord & {
  id: string;
  created_at: string;
  tenant_slug?: string;
  name?: string;
  contact?: string;
  company?: string;
  vertical?: string;
  status?: string;
  source?: string;
  estimated_volume?: string;
  volume?: number;
  message?: string;
  notes?: string;
  email?: string;
  phone?: string;
  role_interest?: string;
};

/**
 * Tenant assignment is an authoritative server projection. Free-form lead
 * content may repeat locator text, but it must never move a row across tenants.
 */
export function authoritativeLeadTenant(lead: CustomerSignalRecord) {
  return String(lead.tenant_slug || "").trim().toLowerCase();
}

export function leadBelongsToTenant(lead: CustomerSignalRecord, tenantSlug: unknown) {
  const scope = String(tenantSlug || "").trim().toLowerCase();
  return Boolean(scope) && authoritativeLeadTenant(lead) === scope;
}

export type CustomerTicketRecord = CustomerSignalRecord & {
  id: string;
  title: string;
  detail?: string;
  status: string;
  contact: string;
  source?: string;
  created_at: string;
  bid?: string;
  tap_event_id?: string | number;
  category?: string;
};

export type CustomerOrderRecord = CustomerSignalRecord & {
  id: string;
  contact: string;
  company?: string;
  tag_type?: string;
  volume?: number;
  notes?: string;
  status: string;
  created_at: string;
};

export type CustomerSignal = {
  id: string;
  kind: CustomerSignalKind;
  occurredAt: string | null;
  timestamp: number;
  subject: string;
  title: string;
  summary: string | null;
  contact: string | null;
  company: string | null;
  status: string | null;
  channel: string | null;
  product: string | null;
  owner: string | null;
  objective: string | null;
  objectiveLabel: string;
  nextAction: string | null;
  source: Exclude<CustomerSignalSource, "unavailable">;
  ticket?: SupportTicketProjection;
};

type CustomerSignalTimelineInput = {
  leads: CustomerSignalRecord[];
  tickets: CustomerSignalRecord[];
  orders: CustomerSignalRecord[];
  collections: CustomerSignalCollections;
};

function asObject(value: unknown): CustomerSignalRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as CustomerSignalRecord;
  }
  if (typeof value !== "string" || value.length > 20_000 || !value.trim().startsWith("{")) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as CustomerSignalRecord
      : {};
  } catch {
    return {};
  }
}

function text(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function explicitValue(row: CustomerSignalRecord, meta: CustomerSignalRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = text(row[key], meta[key]);
    if (value) return value;
  }
  return null;
}

function buildSignal(
  kind: CustomerSignalKind,
  row: CustomerSignalRecord,
  index: number,
  source: Exclude<CustomerSignalSource, "unavailable">,
): CustomerSignal {
  const meta = asObject(row.meta);
  const occurredAt = text(row.created_at, row.occurred_at, row.updated_at);
  const parsedTime = occurredAt ? Date.parse(occurredAt) : Number.NaN;
  const contact = text(row.contact, row.email, row.phone);
  const company = text(row.company, row.tenant_name);
  const product = text(row.product_title, row.product_name, row.requested_product, row.tag_type);
  const owner = explicitValue(row, meta, "assigned_to", "owner", "owner_name");
  const nextAction = explicitValue(row, meta, "next_action", "nextAction");
  const explicitObjective = explicitValue(row, meta, "objective", "goal");

  if (kind === "lead") {
    const roleInterest = text(row.role_interest);
    return {
      id: text(row.id) || `lead-${index}`,
      kind,
      occurredAt,
      timestamp: Number.isFinite(parsedTime) ? parsedTime : 0,
      subject: text(row.name, company, contact) || "Identidad no informada",
      title: roleInterest ? `Interés registrado: ${roleInterest}` : "Nuevo interés registrado",
      summary: text(row.message),
      contact,
      company,
      status: text(row.status),
      channel: text(row.source),
      product,
      owner,
      objective: explicitObjective || roleInterest,
      objectiveLabel: explicitObjective ? "Objetivo informado" : "Interés informado",
      nextAction,
      source,
    };
  }

  if (kind === "ticket") {
    const ticket = projectSupportTicket(row);
    const ticketTitle = text(row.title, row.category);
    return {
      id: text(row.id) || `ticket-${index}`,
      kind,
      occurredAt,
      timestamp: Number.isFinite(parsedTime) ? parsedTime : 0,
      subject: text(ticket.contact, row.company) || "Contacto no informado",
      title: ticketTitle || "Ticket registrado",
      summary: ticket.description,
      contact: ticket.contact,
      company,
      status: text(row.status),
      channel: text(row.source),
      product,
      owner,
      objective: explicitObjective || ticket.category || ticketTitle,
      objectiveLabel: explicitObjective ? "Objetivo informado" : "Motivo del ticket",
      nextAction,
      source,
      ticket,
    };
  }

  return {
    id: text(row.id) || `order-${index}`,
    kind,
    occurredAt,
    timestamp: Number.isFinite(parsedTime) ? parsedTime : 0,
    subject: text(company, contact) || "Identidad no informada",
    title: product ? `Solicitud: ${product}` : "Pedido registrado",
    summary: text(row.notes),
    contact,
    company,
    status: text(row.status),
    channel: text(row.source),
    product,
    owner,
    objective: explicitObjective || product,
    objectiveLabel: explicitObjective ? "Objetivo informado" : "Producto solicitado",
    nextAction,
    source,
  };
}

export function customerSignalMatchesQuery(signal: CustomerSignal, query: string): boolean {
  const normalizedQuery = query.trim().toLocaleLowerCase("es");
  return !normalizedQuery || [
    signal.id, signal.subject, signal.title, signal.summary, signal.contact,
    signal.company, signal.status, signal.channel, signal.product, signal.owner,
    signal.objective, signal.nextAction, signal.ticket?.reference,
    signal.ticket?.batch, signal.ticket?.event,
  ].filter(Boolean).join(" ").toLocaleLowerCase("es").includes(normalizedQuery);
}

function buildCollectionSignals(
  kind: CustomerSignalKind,
  rows: CustomerSignalRecord[],
  state: CustomerSignalCollectionState,
) {
  if (state.availability !== "ready" || state.source === "unavailable") return [];
  const source = state.source;
  return rows.map((row, index) => buildSignal(kind, row, index, source));
}

export function buildCustomerSignalTimeline(input: CustomerSignalTimelineInput): CustomerSignal[] {
  return [
    ...buildCollectionSignals("lead", input.leads, input.collections.leads),
    ...buildCollectionSignals("ticket", input.tickets, input.collections.tickets),
    ...buildCollectionSignals("order", input.orders, input.collections.orders),
  ]
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, 80);
}

export function collectionHasConfirmedEmptyState(
  state: CustomerSignalCollectionState,
  rowCount: number,
) {
  return state.availability === "ready" && rowCount === 0;
}

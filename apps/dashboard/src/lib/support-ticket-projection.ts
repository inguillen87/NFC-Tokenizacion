/** Presentation only. Tenant access remains enforced by the existing server reader. */
export type SupportTicketProjection = {
  reference: string | null;
  batch: string | null;
  event: string | null;
  category: string | null;
  description: string | null;
  detailFormat: "support_report" | "legacy";
  contact: string | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  tap_review: "Revisar la lectura",
  seal_opened: "Precinto abierto",
  product_problem: "Problema con el producto",
  other: "Otro motivo",
};

function boundedText(value: unknown, maximum: number): string | null {
  return typeof value === "string" && value.trim() && value.length <= maximum
    ? value.trim()
    : null;
}

function categoryLabel(value: unknown): string | null {
  return typeof value === "string" && Object.hasOwn(CATEGORY_LABELS, value)
    ? CATEGORY_LABELS[value]
    : null;
}

function eventReference(value: unknown): string | null {
  const text = typeof value === "number" && Number.isSafeInteger(value) ? String(value) : value;
  return typeof text === "string" && /^[1-9]\d{0,18}$/.test(text) && BigInt(text) <= 9223372036854775807n
    ? text
    : null;
}

function supportDescription(detail: string | null): { description: string; category: string } | null {
  // Bound JSON work, but retain legacy text unchanged for display/export.
  if (!detail || detail.length > 20_000 || !detail.trimStart().startsWith("{")) return null;
  try {
    const payload: unknown = JSON.parse(detail);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    const record = payload as Record<string, unknown>;
    const category = categoryLabel(record.category);
    const description = boundedText(record.description, 1500);
    return record.protocol === "nexid.support-report.v1" && category && description
      ? { description, category }
      : null;
  } catch {
    return null;
  }
}

export function projectSupportTicket(row: Record<string, unknown>): SupportTicketProjection {
  const detail = typeof row.detail === "string" && row.detail.trim() ? row.detail : null;
  const report = supportDescription(detail);
  const contact = boundedText(row.contact, 320);
  return {
    // Never take scope, reference, identity or assignment from free-form detail.
    reference: boundedText(row.id, 128),
    batch: boundedText(row.bid, 256),
    event: eventReference(row.tap_event_id),
    category: categoryLabel(row.category) || report?.category || null,
    description: report?.description ?? detail,
    detailFormat: report ? "support_report" : "legacy",
    contact: contact === "anonymous-sun-report" ? null : contact,
  };
}

export const SUPPORT_TICKET_COLUMNS = [
  { key: "reference", label: "Referencia" },
  { key: "created_at", label: "Creado" },
  { key: "title", label: "Título" },
  { key: "category", label: "Motivo informado" },
  { key: "detail", label: "Detalle" },
  { key: "bid", label: "Lote" },
  { key: "tap_event_id", label: "Evento" },
  { key: "contact", label: "Contacto" },
  { key: "status", label: "Estado" },
];

/** The same string row feeds table cells, search, CSV and Excel exports. */
export function supportTicketTableRow(row: Record<string, unknown>): Record<string, string> {
  const ticket = projectSupportTicket(row);
  return {
    reference: ticket.reference || "Referencia no informada",
    created_at: typeof row.created_at === "string" ? row.created_at.slice(0, 10) : "Fecha no informada",
    title: boundedText(row.title, 500) || "Ticket registrado",
    category: ticket.category || "No informado",
    detail: ticket.description || "Sin detalle informado",
    bid: ticket.batch || "No informado",
    tap_event_id: ticket.event || "No informado",
    contact: ticket.contact || "No informado",
    status: (boundedText(row.status, 64) || "open").toUpperCase(),
  };
}

export function supportTicketRowMatchesQuery(row: Record<string, string>, query: string): boolean {
  return Object.values(row).join(" ").toLocaleLowerCase("es").includes(query.trim().toLocaleLowerCase("es"));
}

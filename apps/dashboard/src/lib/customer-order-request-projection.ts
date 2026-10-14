import { customerRecordDate } from "./customer-inbox-state";

/** Presentation only; the existing inbox reader confirms source, tenant and access. */
export type CustomerOrderRequestProjection = {
  reference: string | null;
  createdAt: string | null;
  product: string | null;
  quantity: number | null;
  contact: string | null;
  company: string | null;
  message: string | null;
  status: string | null;
};

function text(value: unknown, maximum: number): string | null {
  return typeof value === "string" && value.trim() && value.length <= maximum
    ? value.trim()
    : null;
}

function quantity(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function projectCustomerOrderRequest(row: Record<string, unknown>): CustomerOrderRequestProjection {
  const contact = [text(row.email, 320), text(row.phone, 100)].filter(Boolean).join(" · ");
  return {
    reference: text(row.id, 128),
    createdAt: text(row.created_at, 64),
    product: text(row.product_title, 500) || text(row.product_name, 500)
      || text(row.requested_product, 500) || text(row.tag_type, 256),
    // A present but invalid modern value must not be replaced by a legacy quantity.
    quantity: quantity(row.quantity === undefined ? row.volume : row.quantity),
    contact: contact || text(row.contact, 1000),
    company: text(row.company, 500) || text(row.tenant_name, 500),
    message: text(row.consumer_message, 200_000) || text(row.notes, 200_000),
    status: text(row.status, 64),
  };
}

/** The same explicit string row feeds cells, local search and existing CSV/Excel exports. */
export function customerOrderRequestTableRow(row: Record<string, unknown>, missing: string): Record<string, string> {
  const order = projectCustomerOrderRequest(row);
  return {
    reference: order.reference ?? missing,
    created_at: customerRecordDate(order.createdAt, missing),
    product: order.product ?? missing,
    quantity: order.quantity === null ? missing : String(order.quantity),
    contact: order.contact ?? missing,
    company: order.company ?? missing,
    status: order.status ?? missing,
    message: order.message ?? missing,
  };
}

export function customerOrderRequestMatchesQuery(row: Record<string, string>, query: string): boolean {
  return Object.values(row).join(" ").toLocaleLowerCase("es").includes(query.trim().toLocaleLowerCase("es"));
}

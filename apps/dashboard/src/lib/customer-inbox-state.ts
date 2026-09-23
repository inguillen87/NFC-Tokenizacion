import { buildCustomerActivitySummary, type CustomerActivityKind } from "./customer-activity-summary";
import type { CustomerSignalCollectionState, CustomerSignalRecord } from "./customer-signal-timeline";

export type CustomerInbox<T extends CustomerSignalRecord = CustomerSignalRecord> = CustomerSignalCollectionState & { rows: T[] };
export type CustomerInboxContext = { tenantScope: string; demoMode: boolean };
const invalid = <T extends CustomerSignalRecord>(): CustomerInbox<T> => ({ rows: [], availability: "invalid_payload", source: "unavailable" });
const limits: Record<string, number> = { created_at: 64, name: 500, title: 500, contact: 1000, company: 500,
  vertical: 128, source: 128, estimated_volume: 256, message: 200_000, notes: 200_000,
  email: 320, phone: 100, role_interest: 256, tag_type: 256 };

/** Withhold a contradictory collection instead of dropping bad rows and inventing a zero. */
export function confirmCustomerInbox<T extends CustomerSignalRecord>(kind: CustomerActivityKind, rows: unknown,
  state: CustomerSignalCollectionState, context: CustomerInboxContext): CustomerInbox<T> {
  const empty = { availability: "ready", source: context.demoMode ? "demo" : "production" } as const;
  const summary = buildCustomerActivitySummary({ leads: [], tickets: [], orders: [], [kind]: rows,
    collections: { leads: empty, tickets: empty, orders: empty, [kind]: state }, ...context });
  const card = summary.cards.find(card => card.kind === kind)!;
  if (card.count === null) return { rows: [], availability: card.availability, source: "unavailable" };
  const records = rows as CustomerSignalRecord[];
  for (const row of records) {
    for (const [key, maximum] of Object.entries(limits)) {
      const value = row[key];
      if (value != null && (typeof value !== "string" || value.length > maximum)) return invalid<T>();
    }
    if (row.volume != null && (typeof row.volume !== "number" || !Number.isSafeInteger(row.volume) || row.volume < 0)) return invalid<T>();
  }
  return { rows: records as T[], availability: "ready", source: card.source };
}

/** Authority is the authenticated BFF header and server scope, not payload free text. */
export function parseCustomerInboxPayload<T extends CustomerSignalRecord>(kind: CustomerActivityKind, payload: unknown,
  dataMode: string | null, context: CustomerInboxContext): CustomerInbox<T> {
  if (dataMode !== "production" && dataMode !== "demo") return invalid<T>();
  const body = payload !== null && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, unknown> : null;
  if (body?.ok === false || (dataMode === "production" && (body?.demoMode === true || body?.dataSource === "demo"))
    || (dataMode === "demo" && (body?.demoMode === false || body?.dataSource === "production"))) return invalid<T>();
  const rows = Array.isArray(payload) ? payload : body?.items;
  return confirmCustomerInbox<T>(kind, rows, { availability: "ready", source: dataMode }, context);
}

export function customerRecordText(value: unknown, missing: string): string {
  return typeof value === "string" && value.trim() ? value : missing;
}
export function customerRecordDate(value: unknown, missing: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) return missing;
  return value.slice(0, 10);
}
export function customerRecordQuantity(value: unknown, missing: string): string {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? String(value) : missing;
}

import { confirmCustomerInbox, type CustomerInboxContext } from "./customer-inbox-state";
import type { CustomerSignalCollectionState, CustomerSignalRecord } from "./customer-signal-timeline";

export type AssistantRecord = {
  key: string; reference: string; tenant: string | null; company: string | null; contact: string | null;
  question: string | null; notes: string | null; interest: string | null; status: string | null;
  channel: string; createdAt: string | null; source: "production" | "demo";
};
export type AssistantLedger = CustomerSignalCollectionState & { rows: AssistantRecord[]; loadedCount: number | null };
// These are the exact channels persisted by the existing assistant entry points.
// A channel is declared metadata, not proof of generated or delivered answers.
const channels = new Set(["assistant", "sales_chat_widget", "lead_capture", "realtime_ai"]);
const text = (...values: unknown[]) => values.find(value => typeof value === "string" && value.trim()) as string | undefined;

export function buildAssistantLedger(rows: unknown, state: CustomerSignalCollectionState, context: CustomerInboxContext): AssistantLedger {
  const confirmed = confirmCustomerInbox<CustomerSignalRecord>("leads", rows, state, context);
  if (confirmed.availability !== "ready" || confirmed.source === "unavailable") return { ...confirmed, rows: [], loadedCount: null };
  const source = confirmed.source;
  const records = confirmed.rows.filter(row => typeof row.source === "string" && channels.has(row.source)).map(row => ({
    key: JSON.stringify([row.tenant_slug ?? null, row.id]), reference: row.id as string,
    tenant: text(row.tenant_slug) ?? null, company: text(row.company) ?? null,
    contact: text(row.contact, row.email, row.phone) ?? null,
    question: text(row.message) ?? null, notes: text(row.notes) ?? null,
    interest: text(row.role_interest) ?? null, status: text(row.status) ?? null,
    channel: row.source as string, createdAt: text(row.created_at) ?? null, source,
  }));
  return { availability: "ready", source, rows: records, loadedCount: records.length };
}
export function assistantRecordMatches(record: AssistantRecord, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase("es");
  return !needle || [record.reference, record.tenant, record.company, record.contact, record.question,
    record.notes, record.interest, record.status, record.channel].filter(Boolean).join(" ").toLocaleLowerCase("es").includes(needle);
}

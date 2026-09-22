import { createHash } from "node:crypto";
import { sql, type SqlExecutor } from "./db";
import type { SupportReportScope } from "./support-report-capability";

export class SupportReportError extends Error { constructor(public code: string, public status = 400) { super(code); } }
export type SupportReportInput = { requestId: string; category: string; description: string; contact: string; locale: string };
export type SupportReportActor = { source: "sun_public_report" | "consumer_portal_report"; consumerId: string | null };
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
function text(value: unknown, maximum: number, required = false): string {
  if (value === undefined && !required) return "";
  if (typeof value !== "string" || value.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw new SupportReportError("report_fields_invalid");
  const result = value.trim();
  if (required && !result) throw new SupportReportError("report_fields_required");
  return result;
}
export function parseSupportReportInput(raw: unknown): SupportReportInput {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new SupportReportError("report_fields_invalid");
  const body = raw as Record<string, unknown>;
  const requestId = text(body.request_id, 36, true).toLowerCase();
  if (!UUID.test(requestId)) throw new SupportReportError("report_request_id_invalid");
  const category = text(body.category, 80, true);
  if (!["tap_review", "seal_opened", "product_problem", "other"].includes(category)) throw new SupportReportError("report_category_invalid");
  const locale = body.locale === undefined ? "es-AR" : text(body.locale, 12, true);
  if (!["es-AR", "en", "pt-BR"].includes(locale)) throw new SupportReportError("report_locale_invalid");
  return { requestId, category, description: text(body.description, 1500, true), contact: text(body.contact, 320), locale };
}
export function supportReportIdentity(scope: SupportReportScope, actor: SupportReportActor, input: SupportReportInput) {
  if (actor.source !== "sun_public_report" && actor.source !== "consumer_portal_report" || actor.consumerId !== null && !UUID.test(actor.consumerId)) throw new SupportReportError("report_actor_invalid", 403);
  if (actor.source === "consumer_portal_report" && !actor.consumerId || actor.source === "sun_public_report" && actor.consumerId !== null) throw new SupportReportError("report_actor_invalid", 403);
  const scopeFields = [scope.tenantId, scope.batchId, scope.eventId, scope.bid, actor.source, actor.consumerId];
  const bytes = hash(["nexid-support-ticket-id-v1", ...scopeFields, input.requestId]);
  const id = `${bytes.slice(0,8)}-${bytes.slice(8,12)}-8${bytes.slice(13,16)}-${((parseInt(bytes[16],16) & 3) | 8).toString(16)}${bytes.slice(17,20)}-${bytes.slice(20,32)}`;
  const fingerprint = hash(["nexid-support-payload-v1", ...scopeFields, input.requestId, input.category, input.description, input.contact, input.locale]);
  return { id, fingerprint };
}
/** Only a persisted ticket is success. No token consumption, analytics receipt
 * or companion publication can substitute for this guarded write. */
export async function writeSupportReport(scope: SupportReportScope, actor: SupportReportActor, input: SupportReportInput, execute: SqlExecutor = sql) {
  const identity = supportReportIdentity(scope, actor, input);
  const detail = JSON.stringify({ protocol: "nexid.support-report.v1", request_id: input.requestId, fingerprint: identity.fingerprint,
    tenant_id: scope.tenantId, batch_id: scope.batchId, event_id: scope.eventId, consumer_id: actor.consumerId,
    category: input.category, description: input.description });
  const rows = await execute`
    WITH target AS MATERIALIZED (
      SELECT e.id,e.tenant_id,e.batch_id,e.bid,e.uid_hex
      FROM events e JOIN batches b ON b.id=e.batch_id AND b.tenant_id=e.tenant_id JOIN tenants t ON t.id=e.tenant_id
      WHERE e.id=${scope.eventId}::bigint AND e.tenant_id=${scope.tenantId}::uuid AND e.batch_id=${scope.batchId}::uuid
        AND e.bid=${scope.bid} AND b.bid=e.bid AND e.uid_hex IS NOT DISTINCT FROM ${scope.uid}::text
        AND e.sdm_read_ctr IS NOT DISTINCT FROM ${scope.counter}::integer
      FOR SHARE OF e,b,t
    )
    INSERT INTO tickets(id,tenant_id,bid,uid_hex,tap_event_id,category,locale,contact,title,detail,status,source)
    SELECT ${identity.id}::uuid,t.tenant_id,t.bid,t.uid_hex,t.id,${input.category},${input.locale},
      ${input.contact || "anonymous-sun-report"},'Reporte sobre el producto',${detail},'open',${actor.source}
    FROM target t ON CONFLICT(id) DO NOTHING
    RETURNING id::text,tenant_id::text,bid,tap_event_id::text,status::text,created_at,detail,source
  `;
  // ON CONFLICT may wait for a competing transaction. A new statement gets a
  // fresh READ COMMITTED snapshot and can then see the winning durable row.
  const existing = rows.length ? rows : await execute`
    SELECT id::text,tenant_id::text,bid,tap_event_id::text,status::text,created_at,detail,source
    FROM tickets WHERE id=${identity.id}::uuid AND tenant_id=${scope.tenantId}::uuid
      AND tap_event_id=${scope.eventId}::bigint AND bid=${scope.bid} AND source=${actor.source} LIMIT 2
  `;
  if (existing.length !== 1) throw new SupportReportError("ticket_persistence_unavailable", 503);
  const ticket = existing[0];
  let stored: Record<string, unknown>;
  try { stored = JSON.parse(String(ticket.detail)); } catch { throw new SupportReportError("report_request_conflict", 409); }
  if (stored.fingerprint !== identity.fingerprint || stored.batch_id !== scope.batchId || stored.consumer_id !== actor.consumerId
    || ticket.tenant_id !== scope.tenantId || ticket.tap_event_id !== scope.eventId || ticket.bid !== scope.bid || ticket.source !== actor.source) throw new SupportReportError("report_request_conflict", 409);
  const at = new Date(ticket.created_at as string | Date);
  if (ticket.id !== identity.id || !["open", "pending", "closed"].includes(String(ticket.status)) || !Number.isFinite(at.getTime())) throw new SupportReportError("ticket_persistence_unavailable", 503);
  return { ok: true as const, protocol: "nexid.support-report.v1", reported: true, ticket_created: true, action: "report_problem", request_status: ticket.status,
    outcome: rows.length ? "ticket_created" as const : "ticket_existing" as const, eventId: scope.eventId, bid: scope.bid,
    ticket: { id: identity.id, status: String(ticket.status), created_at: at.toISOString(), tenant_assigned: true },
    provenance: { mode: "ticket", system: "tickets", real_ticket_service: true } };
}

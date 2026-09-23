import { SupplierRequestError, parseSupplierRequestId, parseSupplierRequestRevision } from "./supplier-request-contract";

export const SUPPLIER_REQUEST_ASSIGNMENT_PROTOCOL = "nexid.supplier-request-assignment.v1";
export const SUPPLIER_REQUEST_ASSIGNMENT_MAX_BODY_BYTES = 8192;
export type SupplierRequestAssignment = { operator_id: string | null; revision: number; updated_at: string | null };
function invalid(field: string): never { throw new SupplierRequestError(`supplier_request_assignment_${field}_invalid`); }
export function parseSupplierRequestAssignmentCommand(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return invalid("body");
  const value = input as Record<string, unknown>, keys = ["operator_id", "expected_revision", "expected_request_revision"];
  if (Object.keys(value).some(key => !keys.includes(key)) || keys.some(key => !Object.hasOwn(value, key))) return invalid("fields");
  if (!Number.isSafeInteger(value.expected_revision) || Number(value.expected_revision) < 0 || Number(value.expected_revision) >= 2147483647) return invalid("expected_revision");
  return { operator_id: value.operator_id === null ? null : parseSupplierRequestId(value.operator_id), expected_revision: Number(value.expected_revision), expected_request_revision: parseSupplierRequestRevision(value.expected_request_revision) };
}
export function supplierRequestAssignmentSummary(input: unknown): SupplierRequestAssignment {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw Error("supplier_request_assignment_record_invalid");
  const value = input as Record<string, unknown>;
  if (!Number.isSafeInteger(value.revision) || Number(value.revision) < 0 || Number(value.revision) >= 2147483647) throw Error("supplier_request_assignment_record_invalid");
  if (value.revision === 0) {
    if (value.operator_id !== null || value.updated_at !== null) throw Error("supplier_request_assignment_record_invalid");
    return { operator_id: null, revision: 0, updated_at: null };
  }
  if (typeof value.updated_at !== "string" || !Number.isFinite(new Date(value.updated_at).getTime())) throw Error("supplier_request_assignment_record_invalid");
  try { return { operator_id: value.operator_id === null ? null : parseSupplierRequestId(value.operator_id), revision: Number(value.revision), updated_at: new Date(value.updated_at).toISOString() }; }
  catch { throw Error("supplier_request_assignment_record_invalid"); }
}
export function supplierRequestAssignmentFromRow(input: unknown, before: number | null = null) {
  try {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw Error();
    const row = input as Record<string, unknown>, assignment = supplierRequestAssignmentSummary(row.assignment);
    const request_id = parseSupplierRequestId(row.request_id), request_revision = parseSupplierRequestRevision(row.request_revision);
    const upper = before === null ? assignment.revision : Math.min(before - 1, assignment.revision);
    if (!Array.isArray(row.history) || row.history.length !== Math.min(100, upper) || row.count !== row.history.length) throw Error();
    const history = row.history.map((event: Record<string, unknown>, index: number) => {
      const revision = parseSupplierRequestRevision(event.revision), eventRequestRevision = parseSupplierRequestRevision(event.request_revision);
      if (revision !== upper - (row.history as unknown[]).length + index + 1 || eventRequestRevision > request_revision || !["assign", "unassign"].includes(String(event.action))) throw Error();
      const operator_id = event.operator_id === null ? null : parseSupplierRequestId(event.operator_id);
      if ((event.action === "unassign") !== (operator_id === null) || typeof event.created_at !== "string" || !Number.isFinite(new Date(event.created_at).getTime())) throw Error();
      return { id: parseSupplierRequestId(event.id), revision, request_revision: eventRequestRevision, action: event.action as "assign" | "unassign", operator_id, actor_id: parseSupplierRequestId(event.actor_id), created_at: new Date(event.created_at).toISOString() };
    });
    const truncated = Boolean(history.length && history[0].revision > 1), next = truncated ? history[0].revision : null;
    if (row.truncated !== truncated || row.next_before_revision !== next) throw Error();
    const last = history.at(-1);
    if (last && last.revision === assignment.revision && (last.operator_id !== assignment.operator_id || last.created_at !== assignment.updated_at)) throw Error();
    return { request_id, request_revision, assignment, history, count: history.length, truncated, next_before_revision: next };
  } catch { throw Error("supplier_request_assignment_record_invalid"); }
}

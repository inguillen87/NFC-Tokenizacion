import { auditFreeformContainsSecret } from "./audit-freeform-secret-policy";
import { SupplierRequestError, parseSupplierRequestId, parseSupplierRequestRevision } from "./supplier-request-contract";

export const SUPPLIER_REQUEST_REVIEW_PROTOCOL = "nexid.supplier-request-review.v1";
export const SUPPLIER_REQUEST_REVIEW_MAX_BODY_BYTES = 16 * 1024;
export type SupplierRequestReviewAction = "request_information" | "respond";
export type SupplierRequestReviewSummary = { state: "pending" | "needs_information" | "answered"; revision: number; updated_at: string | null };
function invalid(field: string): never { throw new SupplierRequestError(`supplier_request_review_${field}_invalid`); }
export function parseSupplierRequestReviewMessage(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) return invalid("message");
  if (auditFreeformContainsSecret(value)) throw new SupplierRequestError("supplier_request_review_secret_content_rejected");
  return value;
}
export function parseSupplierRequestReviewCommand(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return invalid("body");
  const value = input as Record<string, unknown>, keys = ["action", "message", "expected_revision", "expected_request_revision"];
  if (Object.keys(value).some(key => !keys.includes(key)) || keys.some(key => !Object.hasOwn(value, key))) return invalid("fields");
  if (value.action !== "request_information" && value.action !== "respond") return invalid("action");
  if (!Number.isSafeInteger(value.expected_revision) || Number(value.expected_revision) < 0 || Number(value.expected_revision) >= 2147483647) return invalid("expected_revision");
  return { action: value.action, message: parseSupplierRequestReviewMessage(value.message), expected_revision: Number(value.expected_revision), expected_request_revision: parseSupplierRequestRevision(value.expected_request_revision) };
}
export function parseSupplierRequestReviewQuery(params: URLSearchParams, read: boolean) {
  for (const key of params.keys()) if (!(read ? ["tenant", "before_revision"] : ["tenant"]).includes(key) || params.getAll(key).length !== 1) return invalid("query");
  const before = params.get("before_revision");
  if (before !== null && (!/^[1-9][0-9]{0,9}$/.test(before) || Number(before) >= 2147483647)) return invalid("before_revision");
  return { tenant: params.get("tenant"), before: before === null ? null : Number(before) };
}
function iso(value: unknown) {
  if (typeof value !== "string" || !value || !Number.isFinite(new Date(value).getTime())) throw Error("supplier_request_review_record_invalid");
  return new Date(value).toISOString();
}
export function supplierRequestReviewSummary(value: unknown): SupplierRequestReviewSummary {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("supplier_request_review_record_invalid");
  const row = value as Record<string, unknown>;
  if (!["pending", "needs_information", "answered"].includes(String(row.state)) || !Number.isSafeInteger(row.revision) || Number(row.revision) < 0 || Number(row.revision) >= 2147483647) throw Error("supplier_request_review_record_invalid");
  if (row.state === "pending") {
    if (row.revision !== 0 || row.updated_at !== null) throw Error("supplier_request_review_record_invalid");
    return { state: "pending", revision: 0, updated_at: null };
  }
  if (row.revision === 0) throw Error("supplier_request_review_record_invalid");
  return { state: row.state as "needs_information" | "answered", revision: Number(row.revision), updated_at: iso(row.updated_at) };
}
export function supplierRequestReviewFromRow(value: unknown, before: number | null = null) {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw Error();
    const row = value as Record<string, unknown>, review = supplierRequestReviewSummary(row.review);
    const requestId = parseSupplierRequestId(row.request_id), requestRevision = parseSupplierRequestRevision(row.request_revision);
    if (!Array.isArray(row.history) || row.history.length > 100 || row.count !== row.history.length || typeof row.truncated !== "boolean") throw Error();
    const upperRevision = before === null ? review.revision : Math.min(before - 1, review.revision);
    if (row.history.length !== Math.min(100, upperRevision)) throw Error();
    let prior = 0;
    const history = row.history.map((event: Record<string, unknown>) => {
      const revision = parseSupplierRequestRevision(event.revision), eventRequestRevision = parseSupplierRequestRevision(event.request_revision);
      if (revision <= prior || (prior && revision !== prior + 1) || revision > review.revision || (before !== null && revision >= before) || eventRequestRevision > requestRevision
        || !["request_information", "respond"].includes(String(event.action))) throw Error();
      prior = revision;
      return { id: parseSupplierRequestId(event.id), revision, request_revision: eventRequestRevision, action: event.action as SupplierRequestReviewAction,
        message: parseSupplierRequestReviewMessage(event.message), actor_id: parseSupplierRequestId(event.actor_id), created_at: iso(event.created_at) };
    });
    const truncated = Boolean(history.length && history[0].revision > 1);
    if (history.length && (prior !== upperRevision || history[0].revision !== upperRevision - history.length + 1)) throw Error();
    if (row.truncated !== truncated || row.next_before_revision !== (truncated ? history[0].revision : null)) throw Error();
    if (before === null && (review.revision ? prior !== review.revision : history.length !== 0)) throw Error();
    if (before === null && history.length && (history.at(-1)!.action === "request_information" ? "needs_information" : "answered") !== review.state) throw Error();
    if (history.length && prior === review.revision && history.at(-1)!.created_at !== review.updated_at) throw Error();
    return { request_id: requestId, request_revision: requestRevision, review, history, count: history.length, truncated, next_before_revision: truncated ? history[0].revision : null };
  } catch { throw Error("supplier_request_review_record_invalid"); }
}

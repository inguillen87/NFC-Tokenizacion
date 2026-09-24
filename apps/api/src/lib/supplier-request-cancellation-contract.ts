import { auditFreeformContainsSecret } from "./audit-freeform-secret-policy";
import { SupplierRequestError, parseSupplierRequestRevision } from "./supplier-request-contract";
export const SUPPLIER_REQUEST_CANCELLATION_PROTOCOL = "nexid.supplier-request-cancellation.v1";
export const SUPPLIER_REQUEST_CANCELLATION_MAX_BYTES = 16 * 1024;
export function parseSupplierRequestCancellation(input: unknown) {
  const fail = (): never => { throw new SupplierRequestError("supplier_request_cancellation_input_invalid"); };
  if (!input || typeof input !== "object" || Array.isArray(input)) return fail();
  const row = input as Record<string, unknown>, fields = ["expected_revision", "expected_review_revision", "reason"];
  if (Object.keys(row).length !== fields.length || fields.some(key => !Object.hasOwn(row, key))) return fail();
  const expected_revision = parseSupplierRequestRevision(row.expected_revision);
  if (!Number.isSafeInteger(row.expected_review_revision) || Number(row.expected_review_revision) < 0 || Number(row.expected_review_revision) >= 2147483647
    || typeof row.reason !== "string" || !row.reason.trim() || row.reason.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(row.reason)) return fail();
  if (auditFreeformContainsSecret(row.reason)) throw new SupplierRequestError("supplier_request_secret_content_rejected");
  return { expected_revision, expected_review_revision: Number(row.expected_review_revision), reason: row.reason.trim() };
}

import { auditFreeformContainsSecret } from "./audit-freeform-secret-policy";

export const SUPPLIER_REQUEST_PROTOCOL = "nexid.supplier-request.v1";
export const SUPPLIER_REQUEST_MAX_BODY_BYTES = 32 * 1024;
export const SUPPLIER_REQUEST_CONSTRUCTIONS = {
  pet_wet: { chip: "NTAG424_DNA", carrier: "ntag424_dna", material: "transparent_pet_wet_inlay" },
  white_wet: { chip: "NTAG424_DNA", carrier: "ntag424_dna", material: "white_wet_inlay" },
  dry_inlay: { chip: "NTAG424_DNA", carrier: "ntag424_dna", material: "dry_inlay" },
  tt_bridge: { chip: "NTAG424_DNA_TT", carrier: "ntag424_dna_tt", material: "tagtamper_tail" },
  tt_void: { chip: "NTAG424_DNA_TT", carrier: "ntag424_dna_tt", material: "tagtamper_void_destructible" },
  uhf_label: { chip: "", carrier: "uhf_rfid", material: "uhf_logistics_label" },
  uhf_metal: { chip: "", carrier: "uhf_rfid", material: "uhf_on_metal" },
} as const;
export type SupplierRequestContent = {
  title: string;
  construction_id: "" | keyof typeof SUPPLIER_REQUEST_CONSTRUCTIONS;
  quantity: number | null;
  pack_purpose: "trial_integration" | "production" | null;
  notes: string;
};
export type SupplierRequestStatus = "draft" | "submitted" | "provisioned";
export type SupplierRequestItem = SupplierRequestContent & {
  id: string; tenant_id: string; tenant_slug: string; status: SupplierRequestStatus; revision: number;
  created_by: string; updated_by: string; submitted_by: string | null;
  created_at: string; updated_at: string; submitted_at: string | null; order_id: string | null;
};
export class SupplierRequestError extends Error {
  constructor(reason: string, public status = 400, public details: { current_revision?: number; order_id?: string } = {}) { super(reason); }
}
export const SUPPLIER_REQUEST_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const SUPPLIER_REQUEST_TENANT_SLUG = /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/;
const FIELDS = ["title", "construction_id", "quantity", "pack_purpose", "notes"];
function invalid(field: string): never { throw new SupplierRequestError(`supplier_request_${field}_invalid`); }
function object(input: unknown, keys: string[]) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return invalid("body");
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some(key => !keys.includes(key)) || keys.some(key => !Object.hasOwn(value, key))) return invalid("fields");
  return value;
}
function plain(value: unknown, field: string, max: number, required = false) {
  if (typeof value !== "string" || value.length > max || (required && !value.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) return invalid(field);
  if (auditFreeformContainsSecret(value)) throw new SupplierRequestError("supplier_request_secret_content_rejected");
  return value;
}
export function parseSupplierRequestCreate(input: unknown): SupplierRequestContent {
  const value = object(input, FIELDS);
  const title = plain(value.title, "title", 200, true);
  const notes = plain(value.notes, "notes", 4000);
  if (typeof value.construction_id !== "string" || (value.construction_id !== "" && !Object.hasOwn(SUPPLIER_REQUEST_CONSTRUCTIONS, value.construction_id))) return invalid("construction_id");
  if (value.quantity !== null && (!Number.isSafeInteger(value.quantity) || Number(value.quantity) < 1 || Number(value.quantity) > 100_000_000)) return invalid("quantity");
  if (value.pack_purpose !== null && value.pack_purpose !== "trial_integration" && value.pack_purpose !== "production") return invalid("pack_purpose");
  return { title, construction_id: value.construction_id as SupplierRequestContent["construction_id"], quantity: value.quantity as number | null, pack_purpose: value.pack_purpose, notes };
}
export function parseSupplierRequestRevision(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) >= 2147483647) return invalid("expected_revision");
  return Number(value);
}
export function parseSupplierRequestPatch(input: unknown) {
  const value = object(input, [...FIELDS, "expected_revision"]);
  const { expected_revision, ...content } = value;
  return { ...parseSupplierRequestCreate(content), expected_revision: parseSupplierRequestRevision(expected_revision) };
}
export function parseSupplierRequestSubmit(input: unknown) {
  const value = object(input, ["expected_revision"]);
  return { expected_revision: parseSupplierRequestRevision(value.expected_revision) };
}
export function parseSupplierRequestId(value: unknown): string {
  if (typeof value !== "string" || !SUPPLIER_REQUEST_UUID.test(value)) return invalid("id");
  return value.toLowerCase();
}
export function parseSupplierRequestIdempotencyKey(value: unknown): string {
  if (typeof value !== "string" || !SUPPLIER_REQUEST_UUID.test(value)) return invalid("idempotency_key");
  return value.toLowerCase();
}
export function parseSupplierRequestList(params: URLSearchParams) {
  const raw = params.get("limit");
  if (raw !== null && !/^[1-9][0-9]{0,2}$/.test(raw)) return invalid("limit");
  const limit = raw === null ? 50 : Number(raw);
  if (limit > 100) return invalid("limit");
  const status = params.get("status") ?? "all";
  if (!["all", "draft", "submitted", "provisioned"].includes(status)) return invalid("status");
  return { limit, status };
}
export function parseSupplierRequestQuery(params: URLSearchParams, list: boolean) {
  const allowed = list ? ["tenant", "limit", "status"] : ["tenant"];
  for (const key of params.keys()) if (!allowed.includes(key) || params.getAll(key).length !== 1) return invalid("query");
  return { tenant: params.get("tenant"), options: list ? parseSupplierRequestList(params) : null };
}
function timestamp(value: unknown, nullable = false): string | null {
  if (value === null && nullable) return null;
  const result = value instanceof Date ? value : typeof value === "string" && value ? new Date(value) : null;
  if (!result || !Number.isFinite(result.getTime())) throw new Error("supplier_request_record_invalid");
  return result.toISOString();
}
function parseSupplierRequestRow(row: Record<string, unknown>): SupplierRequestItem {
  const content = parseSupplierRequestCreate(Object.fromEntries(FIELDS.map(key => [key, row[key]])));
  const id = parseSupplierRequestId(row.id), tenantId = parseSupplierRequestId(row.tenant_id);
  if (typeof row.tenant_slug !== "string" || !SUPPLIER_REQUEST_TENANT_SLUG.test(row.tenant_slug)
    || !["draft", "submitted", "provisioned"].includes(String(row.status)) || !Number.isSafeInteger(row.revision) || Number(row.revision) < 1) throw new Error("supplier_request_record_invalid");
  const submitted = row.status !== "draft";
  if (submitted && (!content.construction_id || content.quantity === null || content.pack_purpose === null || !row.submitted_at || !row.submitted_by)) throw new Error("supplier_request_record_invalid");
  if ((row.status === "provisioned") !== (row.order_id !== null)) throw new Error("supplier_request_record_invalid");
  if (!submitted && (row.submitted_at !== null || row.submitted_by !== null)) throw new Error("supplier_request_record_invalid");
  return { ...content, id, tenant_id: tenantId, tenant_slug: row.tenant_slug, status: row.status as SupplierRequestStatus,
    revision: Number(row.revision), created_by: parseSupplierRequestId(row.created_by), updated_by: parseSupplierRequestId(row.updated_by),
    submitted_by: row.submitted_by === null ? null : parseSupplierRequestId(row.submitted_by),
    created_at: timestamp(row.created_at)!, updated_at: timestamp(row.updated_at)!, submitted_at: timestamp(row.submitted_at, true),
    order_id: row.order_id === null ? null : parseSupplierRequestId(row.order_id) };
}
export function supplierRequestFromRow(row: Record<string, unknown>): SupplierRequestItem {
  try { return parseSupplierRequestRow(row); }
  catch { throw new Error("supplier_request_record_invalid"); }
}

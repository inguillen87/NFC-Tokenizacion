import { createHash } from "node:crypto";

/** Pure policy only. No persistence, authentication, publication or network side effects. */
export const EDITORIAL_VERSION = "nexid.passport-editorial.v1" as const;
export const EDITORIAL_MAX_BYTES = 65_536;
export type EditorialTemplate = "general" | "agro";
export type EditorialLocale = "es-AR" | "en" | "pt-BR";
export type EditorialState = "draft" | "in_review" | "changes_requested" | "approved" | "published";
export type EditorialScope = Readonly<{ tenantId: string; batchId: string }>;
export type EditorialAuthority = Readonly<{ actorId: string; canEdit: boolean; canReview: boolean }>;
export type PublicIdentity = {
  product_name: string | null; public_lot_label: string | null; sku: string | null;
  winery: string | null; region: string | null; image_url: string | null;
};
export type AgroEditorialProfile = {
  schemaVersion: "agro-dpp-v1";
  productName: string | null; brand: string | null; sku: string | null; gtin: string | null;
  crop: string | null; seedVariety: string | null; productFamily: string | null;
  activeIngredient: string | null; formulation: string | null; registrationNumber: string | null;
  batchLot: string | null; productionDate: string | null; expirationDate: string | null;
  distributor: string | null; authorizedChannel: string | null;
  technicalSheetUrl: string | null; safetySheetUrl: string | null;
  ppe: { summary: string | null; items: string[] };
  stewardship: { summary: string | null; items: string[] };
  cropwiseUrl: string | null; trainingUrl: string | null; loyaltyUrl: string | null;
  recallStatusUrl: string | null;
  support: { label: string | null; url: string | null; email: string | null; phone: string | null };
};
export type EditorialDocument = {
  schemaVersion: typeof EDITORIAL_VERSION;
  template: EditorialTemplate;
  locale: EditorialLocale;
  identity: PublicIdentity;
  agro_product_profile: AgroEditorialProfile | null;
};
export type EditorialDraft = {
  id: string; scope: EditorialScope; revision: number; state: EditorialState;
  document: EditorialDocument; contentDigest: string; basePublishedDigest: string;
  createdBy: string; lastEditorId: string; submittedBy: string | null;
  createdAt: string; updatedAt: string;
  approval: { actorId: string; at: string; contentDigest: string } | null;
};
export class EditorialPolicyError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.name = "EditorialPolicyError"; this.code = code; }
}
const fail = (code: string): never => { throw new EditorialPolicyError(code); };
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const DIGEST = /^[a-f0-9]{64}$/;
function id(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) return fail("editorial_id_invalid");
  return value.toLowerCase();
}
/** Canonical persisted user identifier, never a browser-supplied label or email. */
function actorId(value: unknown): string {
  if (typeof value !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_:-]{0,179}$/.test(value)) return fail("editorial_actor_invalid");
  return UUID.test(value) ? value.toLowerCase() : value;
}
function digest(value: unknown): string {
  if (typeof value !== "string" || !DIGEST.test(value)) return fail("editorial_digest_invalid");
  return value;
}
function timestamp(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return fail("editorial_time_invalid");
  const time = new Date(value);
  if (!Number.isFinite(time.getTime()) || time.toISOString().replace(".000Z", "Z") !== value.replace(".000Z", "Z")) return fail("editorial_time_invalid");
  return time.toISOString();
}
function scope(value: EditorialScope): EditorialScope {
  const tenantId = id(value?.tenantId), batchId = id(value?.batchId);
  return { tenantId, batchId };
}
function record(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail("editorial_object_required");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return fail("editorial_object_required");
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !allowed.includes(key)) return fail("editorial_field_not_allowed");
    const property = Object.getOwnPropertyDescriptor(value, key);
    if (!property || !("value" in property) || !property.enumerable) return fail("editorial_object_required");
  }
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) return fail("editorial_text_invalid");
  return value.trim() || null;
}
/** URL syntax check only; no fetch and no claim of safety of an external document. */
function publicUrl(value: unknown): string | null {
  const raw = text(value, 2048); if (!raw) return null;
  let url: URL;
  try { url = new URL(raw); } catch { return fail("editorial_url_invalid"); }
  if (url.protocol !== "https:" || url.username || url.password) return fail("editorial_url_invalid");
  url.hash = "";
  if (url.href.length > 2048) return fail("editorial_url_invalid");
  return url.href;
}
function date(value: unknown): string | null {
  const raw = text(value, 10); if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return fail("editorial_date_invalid");
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw) return fail("editorial_date_invalid");
  return raw;
}
function guidance(value: unknown, max: number): { summary: string | null; items: string[] } {
  const item = value === undefined ? {} : record(value, ["summary", "items"]);
  const values = item.items ?? [];
  if (!Array.isArray(values) || values.length > 12) return fail("editorial_list_invalid");
  const items: string[] = [];
  for (let index = 0; index < values.length; index++) {
    if (!Object.hasOwn(values, index)) return fail("editorial_list_invalid");
    const normalized = text(values[index], 180);
    if (!normalized) return fail("editorial_list_invalid");
    if (!items.includes(normalized)) items.push(normalized);
  }
  return { summary: text(item.summary, max), items };
}
const AGRO_TEXT = {
  productName: 160, brand: 160, sku: 120, gtin: 14, crop: 120, seedVariety: 160,
  productFamily: 160, activeIngredient: 240, formulation: 160, registrationNumber: 160,
  batchLot: 160, distributor: 200, authorizedChannel: 200,
} as const;
const AGRO_URLS = ["technicalSheetUrl", "safetySheetUrl", "cropwiseUrl", "trainingUrl", "loyaltyUrl", "recallStatusUrl"] as const;
function agro(value: unknown): AgroEditorialProfile {
  const a = record(value, ["schemaVersion", ...Object.keys(AGRO_TEXT), ...AGRO_URLS, "productionDate", "expirationDate", "ppe", "stewardship", "support"]);
  if (a.schemaVersion !== undefined && a.schemaVersion !== "agro-dpp-v1") return fail("editorial_schema_invalid");
  const fields = Object.fromEntries(Object.entries(AGRO_TEXT).map(([key, max]) => [key, text(a[key], max)])) as Pick<AgroEditorialProfile, keyof typeof AGRO_TEXT>;
  if (fields.gtin && !/^\d{1,14}$/.test(fields.gtin)) return fail("editorial_gtin_invalid");
  const urls = Object.fromEntries(AGRO_URLS.map(key => [key, publicUrl(a[key])])) as Pick<AgroEditorialProfile, typeof AGRO_URLS[number]>;
  const support = a.support === undefined ? {} : record(a.support, ["label", "url", "email", "phone"]);
  const email = text(support.email, 254), phone = text(support.phone, 40);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("editorial_email_invalid");
  if (phone && !/^\+?[0-9(). -]{7,40}$/.test(phone)) return fail("editorial_phone_invalid");
  const productionDate = date(a.productionDate), expirationDate = date(a.expirationDate);
  if (productionDate && expirationDate && expirationDate < productionDate) return fail("editorial_date_order_invalid");
  return { schemaVersion: "agro-dpp-v1", ...fields, ...urls, productionDate, expirationDate,
    ppe: guidance(a.ppe, 600), stewardship: guidance(a.stewardship, 1000),
    support: { label: text(support.label, 160), url: publicUrl(support.url), email, phone } };
}
export function parseEditorialDocument(input: unknown): EditorialDocument {
  const d = record(input, ["schemaVersion", "template", "locale", "identity", "agro_product_profile"]);
  if (d.schemaVersion !== EDITORIAL_VERSION) return fail("editorial_schema_invalid");
  if (d.template !== "general" && d.template !== "agro") return fail("editorial_template_invalid");
  if (d.locale !== "es-AR" && d.locale !== "en" && d.locale !== "pt-BR") return fail("editorial_locale_invalid");
  const i = record(d.identity, ["product_name", "public_lot_label", "sku", "winery", "region", "image_url"]);
  const identity: PublicIdentity = { product_name: text(i.product_name, 160), public_lot_label: text(i.public_lot_label, 160),
    sku: text(i.sku, 120), winery: text(i.winery, 160), region: text(i.region, 180), image_url: publicUrl(i.image_url) };
  if (d.template === "general" && d.agro_product_profile !== undefined && d.agro_product_profile !== null) return fail("editorial_template_mismatch");
  const profile = d.template === "agro" ? agro(d.agro_product_profile) : null;
  const result: EditorialDocument = { schemaVersion: EDITORIAL_VERSION, template: d.template, locale: d.locale, identity, agro_product_profile: profile };
  if (Buffer.byteLength(JSON.stringify(result), "utf8") > EDITORIAL_MAX_BYTES) return fail("editorial_content_too_large");
  return result;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
/** Hashes normalized editorial fields, never SUN proofs, keys, UID or TT state. */
export function editorialContentDigest(value: unknown): string {
  return createHash("sha256").update(canonical(parseEditorialDocument(value)), "utf8").digest("hex");
}
export type EditorialIssue = { field: string; severity: "error" | "warning"; code: string };
export function editorialReviewIssues(value: unknown): EditorialIssue[] {
  const d = parseEditorialDocument(value), issues: EditorialIssue[] = [];
  if (!d.identity.product_name) issues.push({ field: "identity.product_name", severity: "error", code: "product_name_required" });
  if (d.agro_product_profile) {
    const a = d.agro_product_profile;
    for (const [publicKey, agroKey] of [["product_name", "productName"], ["winery", "brand"], ["sku", "sku"], ["public_lot_label", "batchLot"]] as const) {
      if (a[agroKey] && a[agroKey] !== d.identity[publicKey]) issues.push({ field: `agro_product_profile.${agroKey}`, severity: "error", code: "identity_values_disagree" });
    }
    if (![a.crop, a.seedVariety, a.productFamily, a.activeIngredient, a.formulation].some(Boolean)) issues.push({ field: "agro_product_profile", severity: "error", code: "agro_identity_missing" });
    if (!a.technicalSheetUrl) issues.push({ field: "agro_product_profile.technicalSheetUrl", severity: "warning", code: "technical_document_not_linked" });
    if (!a.safetySheetUrl) issues.push({ field: "agro_product_profile.safetySheetUrl", severity: "warning", code: "safety_document_not_linked" });
  }
  return issues;
}
function requireReviewable(document: EditorialDocument): void {
  if (editorialReviewIssues(document).some(issue => issue.severity === "error")) fail("editorial_review_requirements_failed");
}
export function createEditorialDraft(input: {
  id: string; scope: EditorialScope; authority: EditorialAuthority;
  document: unknown; basePublishedDigest: string; at: string;
}): EditorialDraft {
  if (input.authority.canEdit !== true) return fail("editorial_edit_forbidden");
  const actor = actorId(input.authority.actorId), at = timestamp(input.at), document = parseEditorialDocument(input.document);
  return { id: id(input.id), scope: scope(input.scope), revision: 1, state: "draft", document,
    contentDigest: editorialContentDigest(document), basePublishedDigest: digest(input.basePublishedDigest),
    createdBy: actor, lastEditorId: actor, submittedBy: null, createdAt: at, updatedAt: at, approval: null };
}
/** Current draft and authority must come from authenticated, tenant-scoped server reads, not client JSON. */
export function transitionEditorialDraft(current: EditorialDraft, command: {
  action: "edit" | "submit" | "request_changes" | "approve";
  scope: EditorialScope; authority: EditorialAuthority; expectedRevision: number;
  expectedContentDigest: string; at: string; document?: unknown;
}): EditorialDraft {
  const checked = checkCurrentDraft(current), expectedScope = scope(command.scope), actor = actorId(command.authority.actorId);
  if (checked.scope.tenantId !== expectedScope.tenantId || checked.scope.batchId !== expectedScope.batchId) return fail("editorial_scope_forbidden");
  const editing = command.action === "edit" || command.action === "submit";
  if (editing ? command.authority.canEdit !== true : command.authority.canReview !== true) return fail("editorial_action_forbidden");
  if (!Number.isSafeInteger(command.expectedRevision) || command.expectedRevision !== checked.revision || command.expectedContentDigest !== checked.contentDigest) return fail("editorial_revision_conflict");
  const at = timestamp(command.at); if (at < checked.updatedAt) return fail("editorial_time_invalid");
  if (checked.revision >= Number.MAX_SAFE_INTEGER) return fail("editorial_revision_invalid");
  const next: EditorialDraft = { ...checked, revision: checked.revision + 1, updatedAt: at };
  if (command.action === "edit") {
    if (checked.state !== "draft" && checked.state !== "changes_requested") return fail("editorial_transition_invalid");
    next.document = parseEditorialDocument(command.document); next.contentDigest = editorialContentDigest(next.document);
    next.state = "draft"; next.lastEditorId = actor; next.submittedBy = null; next.approval = null;
  } else if (command.action === "submit") {
    if (checked.state !== "draft" && checked.state !== "changes_requested") return fail("editorial_transition_invalid");
    requireReviewable(checked.document); next.state = "in_review"; next.submittedBy = actor; next.approval = null;
  } else if (command.action === "request_changes") {
    if (checked.state !== "in_review") return fail("editorial_transition_invalid");
    next.state = "changes_requested"; next.approval = null;
  } else if (command.action === "approve") {
    if (checked.state !== "in_review") return fail("editorial_transition_invalid");
    if ([checked.createdBy, checked.lastEditorId, checked.submittedBy].includes(actor)) return fail("editorial_independent_review_required");
    requireReviewable(checked.document); next.state = "approved";
    next.approval = { actorId: actor, at, contentDigest: checked.contentDigest };
  } else return fail("editorial_action_invalid");
  return next;
}
function checkCurrentDraft(current: EditorialDraft): EditorialDraft {
  record(current, ["id", "scope", "revision", "state", "document", "contentDigest", "basePublishedDigest", "createdBy", "lastEditorId", "submittedBy", "createdAt", "updatedAt", "approval"]);
  if (!current || !Number.isSafeInteger(current.revision) || current.revision < 1) return fail("editorial_revision_invalid");
  if (!["draft", "in_review", "changes_requested", "approved", "published"].includes(current.state)) return fail("editorial_state_invalid");
  const document = parseEditorialDocument(current.document), contentDigest = editorialContentDigest(document);
  if (current.contentDigest !== contentDigest) return fail("editorial_integrity_mismatch");
  const result = { ...current, id: id(current.id), scope: scope(current.scope), document, contentDigest,
    basePublishedDigest: digest(current.basePublishedDigest), createdBy: actorId(current.createdBy), lastEditorId: actorId(current.lastEditorId),
    submittedBy: current.submittedBy === null ? null : actorId(current.submittedBy),
    createdAt: timestamp(current.createdAt), updatedAt: timestamp(current.updatedAt) };
  if (result.updatedAt < result.createdAt) return fail("editorial_time_invalid");
  if ((result.state === "in_review" || result.state === "approved" || result.state === "published") && !result.submittedBy) return fail("editorial_state_invalid");
  if (result.state === "approved" || result.state === "published") {
    const a = current.approval;
    if (a) record(a, ["actorId", "at", "contentDigest"]);
    if (!a || a.contentDigest !== contentDigest || [result.createdBy, result.lastEditorId, result.submittedBy].includes(actorId(a.actorId)) || (result.state === "approved" ? timestamp(a.at) !== result.updatedAt : timestamp(a.at) > result.updatedAt)) return fail("editorial_approval_invalid");
    result.approval = { actorId: actorId(a.actorId), at: timestamp(a.at), contentDigest };
  } else if (current.approval !== null) return fail("editorial_approval_invalid");
  return result;
}
/** A proposed allowlisted patch; the adapter must atomically enforce all guards and store history. */
export function planEditorialPublication(current: EditorialDraft, input: {
  scope: EditorialScope; canPublish: boolean; expectedRevision: number;
  expectedContentDigest: string; currentPublishedDigest: string;
}) {
  if (input.canPublish !== true) return fail("editorial_publish_forbidden");
  const checked = checkCurrentDraft(current), expected = scope(input.scope);
  if (checked.scope.tenantId !== expected.tenantId || checked.scope.batchId !== expected.batchId) return fail("editorial_scope_forbidden");
  if (checked.state !== "approved") return fail("editorial_approval_required");
  if (input.expectedRevision !== checked.revision || input.expectedContentDigest !== checked.contentDigest) return fail("editorial_revision_conflict");
  if (digest(input.currentPublishedDigest) !== checked.basePublishedDigest) return fail("editorial_published_content_changed");
  requireReviewable(checked.document);
  const patch: PublicIdentity & { agro_product_profile?: AgroEditorialProfile } = { ...checked.document.identity };
  if (checked.document.agro_product_profile) patch.agro_product_profile = structuredClone(checked.document.agro_product_profile);
  return { applied: false as const, requiresAtomicCommit: true as const, scope: { ...checked.scope },
    draftId: checked.id, expectedRevision: checked.revision, contentDigest: checked.contentDigest,
    expectedPublishedDigest: checked.basePublishedDigest, patch };
}

export function completeEditorialPublication(current:EditorialDraft,input:{scope:EditorialScope;canPublish:boolean;expectedRevision:number;expectedContentDigest:string;currentPublishedDigest:string;at:string}):EditorialDraft {
  planEditorialPublication(current,input);
  const checked=checkCurrentDraft(current),at=timestamp(input.at);
  if(at<checked.updatedAt||checked.revision>=Number.MAX_SAFE_INTEGER)fail("editorial_time_invalid");
  return {...checked,state:"published",revision:checked.revision+1,updatedAt:at};
}
export function reopenEditorialDraft(current:EditorialDraft,input:{scope:EditorialScope;authority:EditorialAuthority;expectedRevision:number;expectedContentDigest:string;currentPublishedDigest:string;at:string}):EditorialDraft {
  const checked=checkCurrentDraft(current),requested=scope(input.scope);
  if(requested.tenantId!==checked.scope.tenantId||requested.batchId!==checked.scope.batchId)fail("editorial_scope_forbidden");
  if(input.authority.canEdit!==true)fail("editorial_edit_forbidden");
  if(!["approved","published"].includes(checked.state))fail("editorial_transition_invalid");
  if(input.expectedRevision!==checked.revision||input.expectedContentDigest!==checked.contentDigest)fail("editorial_revision_conflict");
  const at=timestamp(input.at),actor=actorId(input.authority.actorId);
  if(at<checked.updatedAt||checked.revision>=Number.MAX_SAFE_INTEGER)fail("editorial_time_invalid");
  return {...checked,state:"draft",revision:checked.revision+1,basePublishedDigest:digest(input.currentPublishedDigest),createdBy:actor,lastEditorId:actor,submittedBy:null,approval:null,createdAt:at,updatedAt:at};
}

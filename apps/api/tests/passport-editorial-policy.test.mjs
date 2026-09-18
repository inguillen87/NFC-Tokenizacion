// Synthetic, dependency-free tests. Never imports DB, external APIs, credentials or real TAP URLs.
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  EDITORIAL_VERSION, parseEditorialDocument, editorialContentDigest, editorialReviewIssues,
  createEditorialDraft, transitionEditorialDraft, planEditorialPublication,
} from "../src/lib/passport-editorial-policy.ts";
const ids = [1,2,3,4,5,6].map(i => `00000000-0000-4000-8000-${String(i).padStart(12,"0")}`);
const scope = { tenantId: ids[0], batchId: ids[1] };
const editor = { actorId: ids[2], canEdit: true, canReview: false };
const reviewer = { actorId: ids[3], canEdit: false, canReview: true };
const at = "2026-09-18T10:00:00.000Z";
const baseDigest = "a".repeat(64);
function document() {
  return { schemaVersion: EDITORIAL_VERSION, template: "agro", locale: "es-AR",
    identity: { product_name: "Producto de prueba", public_lot_label: "Lote de prueba", sku: "SKU-QA", winery: "Marca de prueba", region: "Origen declarado", image_url: null },
    agro_product_profile: { schemaVersion: "agro-dpp-v1", productName: "Producto de prueba", brand: "Marca de prueba", sku: "SKU-QA", batchLot: "Lote de prueba", crop: "Cultivo declarado",
      productionDate: "2026-01-10", expirationDate: "2027-01-10", technicalSheetUrl: "https://example.invalid/technical.pdf", safetySheetUrl: "https://example.invalid/safety.pdf",
      ppe: { summary: "Texto declarado por la empresa, no consejo médico", items: [] }, stewardship: { summary: null, items: [] }, support: { label: "Soporte de producto" } } };
}
function draft(doc = document()) { return createEditorialDraft({ id: ids[4], scope, authority: editor, document: doc, basePublishedDigest: baseDigest, at }); }
function command(current, action, authority = editor, extra = {}) {
  return { action, scope, authority, expectedRevision: current.revision, expectedContentDigest: current.contentDigest, at, ...extra };
}
function submit(current = draft()) { return transitionEditorialDraft(current, command(current, "submit")); }
function approved() { const pending = submit(); return transitionEditorialDraft(pending, command(pending, "approve", reviewer)); }
function plan(current, extra = {}) {
  return planEditorialPublication(current, { scope, canPublish: true, expectedRevision: current.revision, expectedContentDigest: current.contentDigest, currentPublishedDigest: baseDigest, ...extra });
}
function error(code) { return e => e.code === code && e.message === code; }

test("known public agro fields and terminology are preserved", () => {
  const d = parseEditorialDocument(document());
  assert.equal(d.agro_product_profile.schemaVersion, "agro-dpp-v1");
  assert.equal(d.agro_product_profile.productName, d.identity.product_name);
  assert.equal(d.agro_product_profile.ppe.summary, document().agro_product_profile.ppe.summary);
  assert.equal(d.agro_product_profile.support.email, null);
});
test("a general draft may be incomplete without inventing identity", () => {
  const d = parseEditorialDocument({ schemaVersion: EDITORIAL_VERSION, template: "general", locale: "en", identity: {} });
  assert.equal(d.identity.product_name, null);
  assert.equal(d.agro_product_profile, null);
  assert.ok(editorialReviewIssues(d).some(i => i.code === "product_name_required"));
});
test("template, language and profile version are allowlists", () => {
  for (const patch of [{ template: "anything" }, { locale: "xx" }, { schemaVersion: "future" }]) assert.throws(() => parseEditorialDocument({ ...document(), ...patch }));
  const d = document(); d.agro_product_profile.schemaVersion = "other";
  assert.throws(() => parseEditorialDocument(d), error("editorial_schema_invalid"));
});
test("a general template cannot silently retain a hidden agro draft", () => {
  assert.throws(() => parseEditorialDocument({ ...document(), template: "general" }), error("editorial_template_mismatch"));
});
test("NFC security fields cannot enter the public identity", () => {
  for (const field of ["cmac", "uid", "ttStatus", "readCounter", "meta_key", "sdm_config", "isAuthentic", "active"]) {
    const d = document(); d.identity[field] = "not-public";
    assert.throws(() => parseEditorialDocument(d), error("editorial_field_not_allowed"));
  }
});
test("unknown keys are rejected recursively, including support and guidance", () => {
  for (const where of ["agro", "support", "ppe"]) {
    const d = document(); const target = where === "agro" ? d.agro_product_profile : d.agro_product_profile[where];
    target.auth_token = "not-a-real-token";
    assert.throws(() => parseEditorialDocument(d), error("editorial_field_not_allowed"));
  }
});
test("input objects with getters, foreign prototypes or pollution keys are not used", () => {
  const d = document(); let calls = 0;
  Object.defineProperty(d.identity, "sku", { enumerable: true, get() { calls++; return "unexpected"; } });
  assert.throws(() => parseEditorialDocument(d)); assert.equal(calls, 0);
  const foreign = document(); foreign.identity = Object.create({ product_name: "inherited" });
  assert.throws(() => parseEditorialDocument(foreign));
  assert.throws(() => parseEditorialDocument(JSON.parse('{"__proto__":{}}')), error("editorial_field_not_allowed"));
});
test("numeric and overlong text is rejected instead of being silently truncated", () => {
  for (const value of [42, true, "a".repeat(161), "secret\u0000data"]) {
    const d = document(); d.identity.product_name = value;
    assert.throws(() => parseEditorialDocument(d), error("editorial_text_invalid"));
  }
});
test("dates must be actual calendar dates and in the declared order", () => {
  for (const value of ["2026-02-30", "2025-02-29", "not-a-date", "2026-13-01"]) {
    const d = document(); d.agro_product_profile.productionDate = value;
    assert.throws(() => parseEditorialDocument(d), error("editorial_date_invalid"));
  }
  const d = document(); d.agro_product_profile.expirationDate = "2025-01-01";
  assert.throws(() => parseEditorialDocument(d), error("editorial_date_order_invalid"));
  d.agro_product_profile.productionDate = "2024-02-29";
  assert.equal(parseEditorialDocument(d).agro_product_profile.productionDate, "2024-02-29");
});
test("document URLs require HTTPS without user credentials and remove fragments", () => {
  for (const url of ["javascript:alert(1)", "http://example.invalid", "https://user:secret@example.invalid", "file:///etc/passwd"]) {
    const d = document(); d.agro_product_profile.safetySheetUrl = url;
    assert.throws(() => parseEditorialDocument(d), error("editorial_url_invalid"));
  }
  const d = document(); d.identity.image_url = "https://example.invalid/product.png#fragment";
  assert.equal(parseEditorialDocument(d).identity.image_url, "https://example.invalid/product.png");
});
test("public contact data and lists are validated without silently fixing them", () => {
  const d = document(); d.agro_product_profile.support.email = "bad-email";
  assert.throws(() => parseEditorialDocument(d), error("editorial_email_invalid"));
  delete d.agro_product_profile.support.email; d.agro_product_profile.support.phone = "call support";
  assert.throws(() => parseEditorialDocument(d), error("editorial_phone_invalid"));
  delete d.agro_product_profile.support.phone; d.agro_product_profile.ppe.items = Array(13).fill("item");
  assert.throws(() => parseEditorialDocument(d), error("editorial_list_invalid"));
  d.agro_product_profile.ppe.items = [" item ", "item"];
  assert.deepEqual(parseEditorialDocument(d).agro_product_profile.ppe.items, ["item"]);
});
test("normalization makes independent copies of all public fields", () => {
  const d = document(); const normalized = parseEditorialDocument(d);
  normalized.agro_product_profile.support.label = "modified";
  assert.equal(d.agro_product_profile.support.label, "Soporte de producto");
});
test("stable content digest is independent of JSON property order", () => {
  const d = document(); const reversed = Object.fromEntries(Object.entries(d).reverse());
  reversed.identity = Object.fromEntries(Object.entries(d.identity).reverse());
  assert.equal(editorialContentDigest(d), editorialContentDigest(reversed));
  reversed.identity.region = "different"; assert.notEqual(editorialContentDigest(d), editorialContentDigest(reversed));
});
test("duplicated public identity values cannot disagree at review", () => {
  const d = document(); d.agro_product_profile.brand = "Different brand";
  assert.ok(editorialReviewIssues(d).some(i => i.severity === "error" && i.code === "identity_values_disagree"));
});
test("missing document references are warnings, not invented legal certification", () => {
  const d = document(); delete d.agro_product_profile.technicalSheetUrl; delete d.agro_product_profile.safetySheetUrl;
  const issues = editorialReviewIssues(d);
  assert.equal(issues.length, 2); assert.ok(issues.every(i => i.severity === "warning"));
  assert.equal(submit(draft(d)).state, "in_review");
});
test("an agro template without a declared agro identity cannot enter review", () => {
  const d = document(); delete d.agro_product_profile.crop;
  assert.throws(() => submit(draft(d)), error("editorial_review_requirements_failed"));
});
test("creation requires explicit edit authority and valid server scope", () => {
  assert.throws(() => createEditorialDraft({ id: ids[4], scope, authority: { ...editor, canEdit: false }, document: document(), basePublishedDigest: baseDigest, at }), error("editorial_edit_forbidden"));
  assert.throws(() => createEditorialDraft({ id: ids[4], scope: { ...scope, tenantId: "foreign" }, authority: editor, document: document(), basePublishedDigest: baseDigest, at }), error("editorial_id_invalid"));
});
test("new drafts start unapproved at revision one", () => {
  const d = draft(); assert.equal(d.state, "draft"); assert.equal(d.revision, 1);
  assert.equal(d.submittedBy, null); assert.equal(d.approval, null);
});
test("edits increment revision without mutating stored input", () => {
  const current = draft(), before = structuredClone(current), doc = document(); doc.identity.region = "Changed";
  const next = transitionEditorialDraft(current, command(current, "edit", editor, { document: doc }));
  assert.equal(next.revision, 2); assert.notEqual(next.contentDigest, current.contentDigest);
  assert.deepEqual(current, before);
});
test("stale revision and stale content digest are rejected", () => {
  const d = draft();
  assert.throws(() => transitionEditorialDraft(d, command(d, "submit", editor, { expectedRevision: 0 })), error("editorial_revision_conflict"));
  assert.throws(() => transitionEditorialDraft(d, command(d, "submit", editor, { expectedContentDigest: "b".repeat(64) })), error("editorial_revision_conflict"));
});
test("cross-tenant and cross-batch operations are rejected", () => {
  const d = draft(); for (const other of [{ ...scope, tenantId: ids[5] }, { ...scope, batchId: ids[5] }]) {
    assert.throws(() => transitionEditorialDraft(d, command(d, "submit", editor, { scope: other })), error("editorial_scope_forbidden"));
  }
});
test("review cannot silently change the content under review", () => {
  const current = submit();
  assert.throws(() => transitionEditorialDraft(current, command(current, "edit", editor, { document: document() })), error("editorial_transition_invalid"));
});
test("request changes reopens editing without retaining approval", () => {
  const current = submit(), reopened = transitionEditorialDraft(current, command(current, "request_changes", reviewer));
  assert.equal(reopened.state, "changes_requested");
  const edited = transitionEditorialDraft(reopened, command(reopened, "edit", editor, { document: document() }));
  assert.equal(edited.state, "draft"); assert.equal(edited.approval, null); assert.equal(edited.submittedBy, null);
});
test("an editor cannot act as a reviewer merely by submitting content", () => {
  const current = submit();
  assert.throws(() => transitionEditorialDraft(current, command(current, "approve", editor)), error("editorial_action_forbidden"));
});
test("creator and submitter cannot self-approve even with review capability", () => {
  const current = submit();
  assert.throws(() => transitionEditorialDraft(current, command(current, "approve", { ...editor, canReview: true })), error("editorial_independent_review_required"));
});
test("a distinct submitter also cannot approve their own submission", () => {
  const d = draft(); const submitter = { actorId: ids[5], canEdit: true, canReview: true };
  const pending = transitionEditorialDraft(d, command(d, "submit", submitter));
  assert.throws(() => transitionEditorialDraft(pending, command(pending, "approve", submitter)), error("editorial_independent_review_required"));
});
test("independent approval binds the exact reviewed content", () => {
  const a = approved(); assert.equal(a.state, "approved"); assert.equal(a.revision, 3);
  assert.equal(a.approval.actorId, reviewer.actorId); assert.equal(a.approval.contentDigest, a.contentDigest);
});
test("approved content cannot be edited in place", () => {
  const a = approved(); assert.throws(() => transitionEditorialDraft(a, command(a, "edit", editor, { document: document() })), error("editorial_transition_invalid"));
});
test("corrupted stored content cannot be submitted or published under its old hash", () => {
  const d = draft(); d.document.identity.region = "tampered";
  assert.throws(() => transitionEditorialDraft(d, command(d, "submit")), error("editorial_integrity_mismatch"));
  const a = approved(); a.approval.contentDigest = "c".repeat(64);
  assert.throws(() => plan(a), error("editorial_approval_invalid"));
});
test("timestamps and revision counters cannot regress or overflow", () => {
  const d = draft(); assert.throws(() => transitionEditorialDraft(d, command(d, "submit", editor, { at: "2026-09-17T10:00:00Z" })), error("editorial_time_invalid"));
  assert.throws(() => transitionEditorialDraft(d, command(d, "submit", editor, { at: "2026-02-30T10:00:00Z" })), error("editorial_time_invalid"));
  const huge = { ...d, revision: Number.MAX_SAFE_INTEGER };
  assert.throws(() => transitionEditorialDraft(huge, command(huge, "submit")), error("editorial_revision_invalid"));
});
test("publication preparation requires approved content, current version and explicit capability", () => {
  assert.throws(() => plan(draft()), error("editorial_approval_required"));
  const a = approved(); assert.throws(() => plan(a, { canPublish: false }), error("editorial_publish_forbidden"));
  assert.throws(() => plan(a, { expectedRevision: 2 }), error("editorial_revision_conflict"));
  assert.throws(() => plan(a, { scope: { ...scope, batchId: ids[5] } }), error("editorial_scope_forbidden"));
});
test("a changed published version must be reconciled before preparing publication", () => {
  assert.throws(() => plan(approved(), { currentPublishedDigest: "b".repeat(64) }), error("editorial_published_content_changed"));
});
test("publication plan is not applied and includes only editable public product fields", () => {
  const a = approved(), before = structuredClone(a), p = plan(a);
  assert.equal(p.applied, false); assert.equal(p.requiresAtomicCommit, true);
  assert.deepEqual(Object.keys(p.patch).sort(), ["product_name", "public_lot_label", "sku", "winery", "region", "image_url", "agro_product_profile"].sort());
  p.patch.agro_product_profile.support.label = "independent copy";
  assert.deepEqual(a, before);
});
test("general publication does not silently delete agro or other technical configuration", () => {
  const doc = { schemaVersion: EDITORIAL_VERSION, template: "general", locale: "pt-BR", identity: { product_name: "Example" } };
  const pending = submit(draft(doc)); const a = transitionEditorialDraft(pending, command(pending, "approve", reviewer));
  assert.ok(!Object.hasOwn(plan(a).patch, "agro_product_profile"));
});
test("core has no DB calls, provider integration, browser storage or deployment effects", async () => {
  const code = await readFile(new URL("../src/lib/passport-editorial-policy.ts", import.meta.url), "utf8");
  assert.doesNotMatch(code, /import .*from ["']\.\/db|fetch\s*\(|localStorage|sessionStorage|process\.env|setInterval/);
  assert.match(code, /applied: false as const/);
});

test("canonical persisted actor IDs need not be UUIDs", () => {
  const authority = { actorId: "user_example_QA", canEdit: true, canReview: false };
  const d = createEditorialDraft({ id: ids[4], scope, authority, document: document(), basePublishedDigest: baseDigest, at });
  assert.equal(d.createdBy, "user_example_QA");
  assert.throws(() => createEditorialDraft({ id: ids[4], scope, authority: { ...authority, actorId: "not a persisted id" }, document: document(), basePublishedDigest: baseDigest, at }), error("editorial_actor_invalid"));
});
test("persisted draft shapes cannot propagate arbitrary technical fields", () => {
  const d = draft(); d.raw_sdm_config = { secret: "not-real-data" };
  assert.throws(() => transitionEditorialDraft(d, command(d, "submit")), error("editorial_field_not_allowed"));
  const a = approved(); a.approval.raw_token = "test-only";
  assert.throws(() => plan(a), error("editorial_field_not_allowed"));
});
test("URL expansion must remain bounded and normalized content is idempotent", () => {
  const d = document(); d.identity.image_url = "https://example.invalid/" + "é".repeat(1000);
  assert.throws(() => parseEditorialDocument(d), error("editorial_url_invalid"));
  const normalized = parseEditorialDocument(document());
  assert.deepEqual(parseEditorialDocument(normalized), normalized);
});

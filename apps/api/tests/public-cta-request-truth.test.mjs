import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const registerWarranty = await readFile(new URL("../src/app/public/cta/register-warranty/route.ts", import.meta.url), "utf8");
const reportProblem = await readFile(new URL("../src/app/public/cta/report-problem/route.ts", import.meta.url), "utf8");
const provenance = await readFile(new URL("../src/app/public/cta/provenance/route.ts", import.meta.url), "utf8");
const demoCta = await readFile(new URL("../src/lib/demo-cta.ts", import.meta.url), "utf8");
const sun = await readFile(new URL("../src/app/sun/route.ts", import.meta.url), "utf8");

test("warranty CTA records a tenant-policy review request and never confirms coverage", () => {
  assert.match(registerWarranty, /target\.warrantyPolicy/);
  assert.match(registerWarranty, /recordDemoCta\("warranty_review_requested"/);
  assert.match(registerWarranty, /request_status: "pending_review"/);
  assert.match(registerWarranty, /outcome: "request_recorded"/);
  assert.match(registerWarranty, /warranty_confirmed: false/);
  assert.match(registerWarranty, /consumer_or_contact/);
  assert.match(registerWarranty, /purchase_evidence/);
  assert.match(registerWarranty, /terms_accepted/);
  assert.match(registerWarranty, /real_warranty_service: false/);
  assert.doesNotMatch(registerWarranty, /recordDemoCta\("register_warranty"/);
});

test("problem report records a review request without inventing a support ticket", () => {
  assert.match(reportProblem, /recordDemoCta\("problem_report_request"/);
  assert.match(reportProblem, /request_status: "pending_review"/);
  assert.match(reportProblem, /outcome: "request_recorded"/);
  assert.match(reportProblem, /ticket_created: false/);
  assert.match(reportProblem, /real_ticket_service: false/);
  assert.doesNotMatch(reportProblem, /recordDemoCta\("report_problem"/);
});

test("public lifecycle and SUN UI preserve request-only semantics", () => {
  assert.match(demoCta, /stage: "warranty_request_recorded", status: warrantyAction \? "pending_review"/);
  assert.doesNotMatch(demoCta, /stage: "warranty_registered"/);
  assert.match(provenance, /warranty_registered: false/);
  assert.match(provenance, /support_ticket_created: false/);
  assert.match(provenance, /Recorded demo requests are pending review/);
  assert.match(sun, /solicitud registrada y pendiente de revision; no confirma garantia ni ticket/);
});

test("public provenance derives final ownership and ledger state only from tenant-scoped durable registries", () => {
  assert.match(demoCta, /ownership_status: "unavailable_from_demo_log"/);
  assert.match(demoCta, /ledger_status: "unavailable_from_demo_log"/);
  assert.doesNotMatch(demoCta, /ownership_status: ownershipAction \? "claimed"/);
  assert.doesNotMatch(demoCta, /ledger_status: tokenAction \?/);

  assert.match(provenance, /FROM consumer_product_ownerships/);
  assert.match(provenance, /FROM tokenization_requests/);
  assert.match(provenance, /FROM evidence_anchors/);
  assert.match(provenance, /WHERE tenant_id = \$\{target\.tenantId\}/);
  assert.match(provenance, /AND batch_id = \$\{target\.batchId\}/);
  assert.match(provenance, /AND upper\(uid_hex\) = \$\{uid\.toUpperCase\(\)\}/);
  assert.match(provenance, /ORDER BY updated_at DESC/);
  assert.match(provenance, /ownership_claimed: ownershipRead\.available \? ownershipStatus === "claimed" : null/);
  assert.match(provenance, /rpc_verified_in_this_response: false/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../src/app/(app)/supplier-orders/[orderId]/page.tsx", import.meta.url), "utf8");
const panel = await readFile(new URL("../src/app/(app)/supplier-orders/[orderId]/packaging-governance-panel.tsx", import.meta.url), "utf8");
const exportForm = await readFile(new URL("../src/app/(app)/supplier-orders/[orderId]/export-form.tsx", import.meta.url), "utf8");

test("supplier detail loads authoritative packaging governance and blocks export until approved", () => {
  assert.match(page, /supplier-orders\/\$\{encodeURIComponent\(orderId\)\}\/packaging/);
  assert.match(page, /packagingStatus === "approved"/);
  assert.match(page, /dashboardHighImpactPermissionMatches\([\s\S]*"supplier_pack\.export"[\s\S]*session\.deniedPermissions/);
  assert.match(page, /disabled=\{!canExportFactoryPack \|\| !packagingApproved\}/);
  assert.match(exportForm, /if \(disabled\)/);
  assert.match(exportForm, /disabled=\{loading \|\| disabled\}/);
});

test("packaging UX preserves industrial truth and exposes every physical approval gate", () => {
  assert.match(panel, /dry inlay es un componente para converter/i);
  assert.match(panel, /smart label terminada/i);
  for (const evidence of ["rf_sample", "line_trial", "adhesive", "artwork_dieline", "encoding_readback", "tagtamper_placement"]) {
    assert.ok(panel.includes(evidence), `missing ${evidence} evidence input`);
  }
  for (const approval of ["rfSampleApproved", "lineTrialApproved", "adhesiveApproved", "artworkApproved", "encodingTrialApproved"]) {
    assert.ok(panel.includes(approval), `missing ${approval} approval control`);
  }
});

test("approval decisions do not resend an editable spec or client authority context", () => {
  assert.match(panel, /approvalDecision \? \{\} : \{ spec: cleanSpec\(spec\) \}/);
  assert.doesNotMatch(panel, /tenant_id\s*:/);
  assert.doesNotMatch(panel, /decided_by\s*:/);
  assert.doesNotMatch(panel, /previous_revision\s*:/);
});

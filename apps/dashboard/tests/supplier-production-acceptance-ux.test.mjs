import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const panel = await readFile(new URL("../src/components/supplier-production-acceptance-panel.tsx", import.meta.url), "utf8");
const consoleSource = await readFile(new URL("../src/components/supplier-order-console.tsx", import.meta.url), "utf8");

function functionBody(name, nextName) {
  const declarationIndex = (functionName, from = 0) => {
    const pattern = new RegExp(`(?:async\\s+)?function\\s+${functionName}\\s*\\(`, "g");
    pattern.lastIndex = from;
    return pattern.exec(panel)?.index ?? -1;
  };
  const start = declarationIndex(name);
  const end = declarationIndex(nextName, start + 1);
  assert.notEqual(start, -1, `missing ${name}`);
  assert.notEqual(end, -1, `missing ${nextName}`);
  return panel.slice(start, end);
}

test("production acceptance v2 is mounted only for the selected production BID", () => {
  assert.match(consoleSource, /import \{ SupplierProductionAcceptancePanel \}/);
  assert.match(consoleSource, /selectedOrderId && selectedSubBatch && activePackPurpose === "production"/);
  assert.match(consoleSource, /orderId=\{selectedOrderId\}/);
  assert.match(consoleSource, /bid=\{selectedSubBatch\.bid\}/);
  assert.match(panel, /supplier-production-acceptance\/v2/);
  assert.match(panel, /data-testid="supplier-production-acceptance-v2"/);
});

test("plan and tenant-quality decision payloads never claim server-owned scope", () => {
  const submit = functionBody("submitPlan", "decidePlan");
  const decide = functionBody("decidePlan", "createSession");
  for (const field of [
    "inspection_level", "target_aql", "sample_size", "accept_number", "reject_number",
    "policy_reference", "policy_document_sha256", "stratification_dimension",
  ]) assert.match(panel, new RegExp(field));
  for (const forbidden of ["tenant_id", "actor_id", "auth_session_id", "revision", "approved_by", "approved_at"]) {
    assert.doesNotMatch(submit, new RegExp(`${forbidden}\\s*:`));
    assert.doesNotMatch(decide, new RegExp(`${forbidden}\\s*:`));
  }
  assert.match(panel, /can_approve_tenant_quality_plan === true/);
  assert.match(panel, /acceptance\.next_action !== "tenant_quality_decision"/);
  assert.match(panel, /unsignedDecimal\.test\(targetAqlText\)/);
  assert.match(panel, /unsignedInteger\.test\(acceptNumberText\)/);
  assert.match(decide, /decision:\s*decisionForm\.decision/);
  assert.match(decide, /approval_evidence_sha256/);
});

test("session creation sends only the approved plan id and preserves server-owned selection", () => {
  const create = functionBody("createSession", "finalizeSession");
  assert.match(create, /const payload = \{ plan_id: approvedPlan\.id \}/);
  assert.match(create, /`\$\{basePath\}\/sessions`/);
  assert.doesNotMatch(create, /sample_size\s*:/);
  assert.doesNotMatch(create, /challenge\s*:/);
  assert.doesNotMatch(create, /selection_seed/);
  assert.match(create, /operationKey\(`session:\$\{latestSession\?\.id \|\| "initial"\}`/);
  assert.match(panel, /El servidor fija TTL, seed, challenge y selección estratificada/);
  assert.match(panel, /uid_masked/);
  assert.doesNotMatch(panel, /sample\.uid_hex/);
  assert.doesNotMatch(panel, /selection_seed_ciphertext|challenge_ciphertext/);
});

test("finalization sends observations only and never a client verdict or count", () => {
  const finalize = functionBody("finalizeSession", "updateObservation");
  const payloadStart = finalize.indexOf("const payload = {");
  const payloadEnd = finalize.indexOf('setMutation("finalize")', payloadStart);
  const payload = finalize.slice(payloadStart, payloadEnd);
  assert.match(payload, /challenge:\s*ceremony\.challenge/);
  assert.match(payload, /observations:\s*productionObservations/);
  assert.match(payload, /snapshot_urls:\s*snapshots\.values/);
  assert.match(payload, /notes:\s*notes\.trim\(\)/);
  for (const forbidden of ["status", "passed", "qa_passed", "sample_count", "nonconforming_count", "tenant_id", "actor_id", "selection_seed_reveal"]) {
    assert.doesNotMatch(payload, new RegExp(`${forbidden}\\s*:`));
  }
  assert.match(panel, /El backend deriva pass\/fail, conteos y disposición/);
  assert.match(panel, /activation_allowed === false/);
  assert.match(panel, /value="BLOQUEADA"/);
});

test("production UX is accessible, fail-closed and preserves the physical NFC path", () => {
  assert.match(panel, /aria-live="polite"/);
  assert.match(panel, /<fieldset/);
  assert.match(panel, /htmlFor="production-plan-decision"/);
  assert.match(panel, /inspecciona físicamente cada unidad/);
  assert.match(panel, /no reemplaza la inspección presencial/);
  assert.match(panel, /no modifica K_META, K_FILE, UID, BID, SDM ni la criptografía física NFC/);
  assert.match(panel, /No pegues URL SUN cruda con picc_data\/enc\/cmac/);
  assert.match(panel, /forbiddenSunParameters/);
  assert.match(panel, /setAcceptance\(null\)/);
  assert.doesNotMatch(panel, /\bKMS\b|\bHSM\b/);
  assert.match(panel, /"Idempotency-Key"/);
});

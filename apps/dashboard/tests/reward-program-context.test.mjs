import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as configuration from "../src/lib/loyalty-configuration.ts";
import * as notices from "../src/lib/reward-reservation-notices.ts";

const tenant = "qa-brand";
const id = "10000000-0000-4000-8000-000000000001";
const otherId = "20000000-0000-4000-8000-000000000001";
const revision = "2026-10-14 12:00:00.000001+00";
const program = { id, revision, lastOperationId: null, name: "Programa asociado QA", vertical: "wine", status: "active", pointsName: "Puntos", pointsPerValidTap: 0, cooldownSeconds: 0, startAt: "2026-01-01T00:00:00.000Z", endAt: null };
const board = (patch = {}) => ({ ok: true, tenant, profile: { revision, lastOperationId: null, status: "draft", allowedActions: [] }, programs: [program, { ...program, id: otherId, name: "Otro programa QA" }], quizzes: [], ...patch });
const requirements = { version: notices.REWARD_REQUIREMENTS_VERSION, program: { name: program.name, association_confirmed: true, age_gate_required: true }, starts_at: "2026-10-01T00:00:00.000Z", ends_at: null, requires_age_gate: true, eligibility_policy_review: true, fulfillment_policy_review: false, redemption_limit_per_member: 1, redemption_limit_known: true };
const reward = { id: otherId, program_id: id, tenant_slug: tenant, code: "VISIT", title: "Visita QA", points: 0, stock_total: 10, stock_remaining: 2, status: "active", requires_age_gate: true, network_visible: false, reservation_requirements: requirements };
const context = { tenantScope: tenant, dataSource: "production" };

test("program navigation requires the same confirmed tenant, version and persisted association", () => {
  const url = notices.rewardProgramConfigurationLink(reward, context);
  assert.equal(url, `/loyalty/configuration?tenant=${tenant}&program=${id}`);
  for (const patch of [{ tenant_slug: "other-brand" }, { program_id: undefined }, { program_id: "not-an-id" }, { reservation_requirements: null }, { reservation_requirements: { ...requirements, version: "unknown" } }]) {
    assert.equal(notices.rewardProgramConfigurationLink({ ...reward, ...patch }, context), null);
  }
  for (const association_confirmed of [false, null, undefined, "true"]) assert.equal(notices.rewardProgramConfigurationLink({ ...reward, reservation_requirements: { ...requirements, program: { ...requirements.program, association_confirmed } } }, context), null);
  for (const dataSource of ["demo", "unavailable"]) assert.equal(notices.rewardProgramConfigurationLink(reward, { ...context, dataSource }), null);
  for (const tenantScope of ["", "other-brand", "QA-BRAND", "qa-brand&program=other", " qa-brand "]) assert.equal(notices.rewardProgramConfigurationLink(reward, { ...context, tenantScope }), null);
});

test("exact program lookup is independent of list order and leaves persisted state unchanged", () => {
  const data = board({ programs: [{ ...program, id: otherId }, program] });
  const before = JSON.stringify(data);
  const selected = configuration.configurationProgramContext(data, tenant, id);
  assert.equal(selected.state, "selected"); assert.equal(selected.program, program);
  assert.equal(JSON.stringify(data), before);
  assert.equal(selected.program.status, "active");
  assert.equal(selected.program.pointsPerValidTap, 0);
  assert.equal(selected.clearHref, `/loyalty/configuration?tenant=${tenant}`);
  const caseId = "aaaaaaaa-0000-4000-8000-000000000001";
  assert.equal(configuration.configurationProgramContext(board({ programs: [{ ...program, id: caseId }] }), tenant, caseId.toUpperCase()).program.id, caseId);
  assert.equal(notices.rewardProgramConfigurationLink({ ...reward, program_id: caseId.toUpperCase() }, context), `/loyalty/configuration?tenant=${tenant}&program=${caseId}`);
});

test("missing or bounded-out programs never fall back to the first program or a new draft", () => {
  for (const data of [board({ programs: [] }), board({ programs: [{ ...program, id: otherId }] }), board({ programs: [{ ...program, id: otherId }], limits: { programs: 100, quizzes: 300, programsTruncated: true, quizzesTruncated: false } })]) {
    const selected = configuration.configurationProgramContext(data, tenant, id);
    assert.equal(selected.state, "missing"); assert.equal(selected.program, null);
    assert.match(selected.message, /no se seleccionó otro programa/);
  }
});

test("wrong tenant, duplicate records, malformed program and missing source suppress selection", () => {
  for (const data of [null, board({ tenant: "other-brand" }), board({ programs: [program, program] }), board({ programs: [{ ...program, status: "unknown" }] })]) {
    const selected = configuration.configurationProgramContext(data, tenant, id);
    assert.equal(selected.state, "unavailable"); assert.equal(selected.program, null);
  }
  assert.equal(configuration.configurationProgramContext(board(), tenant, id, true).state, "unavailable");
  const caseId = "aaaaaaaa-0000-4000-8000-000000000001";
  assert.equal(configuration.configurationProgramContext(board({ programs: [{ ...program, id: caseId }, { ...program, id: caseId.toUpperCase() }] }), tenant, caseId).state, "unavailable");
});

test("ambiguous query arrays and malformed inputs cannot select or echo an identifier", () => {
  for (const requested of [[id], [id, otherId], [], null, "", "not-an-id", `${id}&tenant=other-brand`, 42]) {
    const selected = configuration.configurationProgramContext(board(), tenant, requested);
    assert.equal(selected.state, "invalid"); assert.equal(selected.program, null);
    assert.equal(selected.clearHref, `/loyalty/configuration?tenant=${tenant}`);
    assert.doesNotMatch(selected.message, /not-an-id|other-brand|10000000/);
  }
});

test("clearing context uses a local tenant-bound GET and absence of query retains the normal workspace", () => {
  const cleared = configuration.configurationProgramContext(board(), tenant, undefined);
  assert.equal(cleared.state, "none"); assert.equal(cleared.program, null); assert.equal(cleared.message, "");
  const badScope = configuration.configurationProgramContext(board(), "//external.invalid/path", id);
  assert.equal(badScope.state, "unavailable"); assert.equal(badScope.clearHref, "/loyalty/configuration");
});

const require = createRequire(import.meta.url);
const css = new Proxy({}, { get: (_, key) => key === "__esModule" ? false : String(key) });
function loadComponent(path, substitutes) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)((id) => Object.hasOwn(substitutes, id) ? substitutes[id] : id.endsWith(".module.css") ? css : require(id), module, module.exports);
  return module.exports.default;
}
const Workspace = loadComponent("../src/components/loyalty-configuration-workspace.tsx", { "../lib/loyalty-configuration": configuration });
const workspaceProps = { tenant, canWrite: true, canSelectTenant: false, initialData: board(), initialProgramQuery: id };
const renderWorkspace = (patch = {}) => renderToStaticMarkup(React.createElement(Workspace, { ...workspaceProps, ...patch }));

test("clearing the linked selection is unavailable while edits or a request remain unresolved", () => {
  for (const [stateName, stateSlot] of [["dirty", 7], ["busy", 8], ["uncertain", 12]]) {
    let stateIndex = 0;
    const reactShim = { ...React, useState: initial => { const index = stateIndex++; return [index === stateSlot ? true : index === 6 ? false : typeof initial === "function" ? initial() : initial, () => {}]; }, useEffect: () => {}, useRef: () => ({ current: null }) };
    const EditingWorkspace = loadComponent("../src/components/loyalty-configuration-workspace.tsx", { react: reactShim, "../lib/loyalty-configuration": configuration });
    const html = renderToStaticMarkup(React.createElement(EditingWorkspace, { ...workspaceProps, initialData: board({ programs: [{ ...program, status: "paused" }] }) }));
    assert.doesNotMatch(html, /href="\/loyalty\/configuration\?tenant=qa-brand"/, stateName);
    assert.match(html, /Tu formulario se conserva/, stateName);
  }
  assert.match(renderWorkspace(), /href="\/loyalty\/configuration\?tenant=qa-brand"/);
});

test("linked program renders in consultation before any editing or publication action", () => {
  const html = renderWorkspace();
  assert.match(html, /data-program-context="selected"/);
  assert.match(html, /<fieldset disabled=""/);
  assert.match(html, /value="Programa asociado QA"/);
  assert.match(html, /Abrir configuración del programa/);
  assert.match(html, /href="\/loyalty\/configuration\?tenant=qa-brand"/);
  assert.doesNotMatch(html, />Retirar publicación<|>Guardar borrador<|>Confirmar publicación</);
  assert.doesNotMatch(renderWorkspace({ canWrite: false }), /Abrir configuración del programa/);
  assert.match(renderWorkspace({ initialData: board({ programs: [{ ...program, status: "paused" }] }) }), /<fieldset disabled=""/);
});

test("unknown context remains unselected while a cleared query restores services, without a render request", () => {
  const previousFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = () => { requests++; throw new Error("Rendering must not send a request"); };
  try {
    const html = renderWorkspace({ initialProgramQuery: [id] });
    assert.match(html, /data-program-context="invalid"/);
    assert.doesNotMatch(html, /value="Programa asociado QA"|aria-label="Editor de configuración"/);
    assert.match(renderWorkspace({ initialProgramQuery: undefined }), /Servicios de esta marca/);
    assert.doesNotMatch(renderWorkspace({ initialData: board({ tenant: "other-brand" }) }), /Programa asociado QA|Otro programa QA|aria-label="Editor de configuración"/);
    assert.equal(requests, 0);
  } finally { globalThis.fetch = previousFetch; }
});

test("edit dialog exposes saved restrictions and opens its program in a separate protected tab", () => {
  let stateIndex = 0;
  const editingState = [true, reward, reward.code, reward.title, "Descripción QA", "TASTING", reward.points, reward.stock_total, "", reward.status, reward.requires_age_gate, reward.network_visible];
  const reactShim = { ...React, useState: initial => { const index = stateIndex++; return [index < editingState.length ? editingState[index] : typeof initial === "function" ? initial() : initial, () => {}]; }, useEffect: () => {}, useRef: () => ({ current: null }) };
  const Notice = loadComponent("../src/components/reward-reservation-notice.tsx", { "../lib/reward-reservation-notices": notices });
  const Icon = () => React.createElement("svg", { "aria-hidden": "true" });
  const Rewards = loadComponent("../src/app/(app)/loyalty/rewards/rewards-client.tsx", {
    react: reactShim, "next/navigation": { useRouter: () => ({ refresh: () => {} }) }, "@product/ui": {},
    "../../../../components/reward-reservation-notice": { default: Notice, __esModule: true },
    "../../../../lib/reward-reservation-notices": notices,
    "lucide-react": new Proxy({}, { get: () => Icon }),
  });
  const renderRewards = (patch = {}) => {
    stateIndex = 0;
    return renderToStaticMarkup(React.createElement(Rewards, { initialRewards: [reward], tenantScope: tenant, isDemo: false, canWrite: true, dataSource: "production", availability: "ready", sourceReason: "", ...patch }));
  };
  const html = renderRewards();
  assert.match(html, /aria-label="Condiciones guardadas del beneficio"/);
  assert.match(html, /<details[^>]*open=""/);
  assert.match(html, /Verificación de edad \(\+18\) configurada/);
  assert.match(html, /Condiciones personalizadas/);
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /href="\/loyalty\/configuration\?tenant=qa-brand&amp;program=10000000-0000-4000-8000-000000000001"/);
  assert.match(html, /Consultar programa \(abre otra pestaña\)/);
  assert.match(html, /Guardar no garantiza que una persona pueda reservar/);
  assert.match(html, /id="reward-edit-code"[^>]*value="VISIT"/);
  for (const availability of ["ready_empty", "upstream_error", "forbidden"]) assert.doesNotMatch(renderRewards({ availability }), /Consultar programa \(abre otra pestaña\)/);
  for (const patch of [{ isDemo: true }, { tenantScope: "" }, { dataSource: "demo" }, { dataSource: "unavailable" }]) assert.doesNotMatch(renderRewards(patch), /Consultar programa \(abre otra pestaña\)/);

  // Exercise the actual modal key handler; a link between form controls must remain in the native Tab order.
  stateIndex = 0;
  const findDialog = node => Array.isArray(node) ? node.map(findDialog).find(Boolean) : node && typeof node === "object" ? node.type === "dialog" ? node : findDialog(node.props?.children) : null;
  const dialog = findDialog(Rewards({ initialRewards: [reward], tenantScope: tenant, isDemo: false, canWrite: true, dataSource: "production", availability: "ready", sourceReason: "" }));
  assert.ok(dialog);
  let firstFocused = 0, lastFocused = 0, prevented = 0;
  const first = { focus: () => firstFocused++ }, summary = { focus: () => {} }, anchor = { focus: () => {} }, input = { focus: () => {} }, last = { focus: () => lastFocused++ };
  const currentTarget = { querySelectorAll: selector => [first, ...(selector.includes("summary") ? [summary] : []), ...(selector.includes("a[href]") ? [anchor] : []), input, last] };
  const previousDocument = globalThis.document;
  globalThis.document = { activeElement: anchor };
  try {
    for (const active of [summary, anchor]) for (const shiftKey of [false, true]) {
      globalThis.document.activeElement = active;
      dialog.props.onKeyDown({ key: "Tab", shiftKey, currentTarget, preventDefault: () => prevented++ });
    }
    assert.equal(prevented, 0); assert.equal(firstFocused, 0); assert.equal(lastFocused, 0);
    globalThis.document.activeElement = last;
    dialog.props.onKeyDown({ key: "Tab", shiftKey: false, currentTarget, preventDefault: () => prevented++ });
    globalThis.document.activeElement = first;
    dialog.props.onKeyDown({ key: "Tab", shiftKey: true, currentTarget, preventDefault: () => prevented++ });
    assert.equal(prevented, 2); assert.equal(firstFocused, 1); assert.equal(lastFocused, 1);
  } finally { if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument; }
});

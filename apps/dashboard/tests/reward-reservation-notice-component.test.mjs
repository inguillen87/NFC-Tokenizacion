import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as noticeModel from "../src/lib/reward-reservation-notices.ts";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../src/components/reward-reservation-notice.tsx", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
const module = { exports: {} };
new Function("require", "module", "exports", code)((id) => {
  if (id === "../lib/reward-reservation-notices") return noticeModel;
  if (id.endsWith(".module.css")) return { notice: "notice", summary: "summary", heading: "heading", status: "status", body: "body", rows: "rows", row: "row", note: "note" };
  return require(id);
}, module, module.exports);
const Component = module.exports.default;
const requirements = { version: noticeModel.REWARD_REQUIREMENTS_VERSION, program: { association_confirmed: true, name: "Club QA", age_gate_required: true }, starts_at: "2026-10-01T00:00:00.000Z", ends_at: null, requires_age_gate: false, eligibility_policy_review: true, fulfillment_policy_review: false, redemption_limit_per_member: 1, redemption_limit_known: true };
const props = { reward: { tenant_slug: "qa-brand", reservation_requirements: requirements }, tenantScope: "qa-brand", dataSource: "production" };
const render = (patch = {}) => renderToStaticMarkup(React.createElement(Component, { ...props, ...patch }));

test("conditions are a native keyboard disclosure with structured labels and no financial controls", () => {
  const html = render();
  assert.match(html, /<details[^>]+data-reservation-notice="review"/);
  assert.match(html, /<summary[^>]*>.*Condiciones de acceso/);
  for (const label of ["Programa", "Desde", "Hasta", "Edad", "Acceso", "Entrega", "Límite por persona"]) assert.ok(html.includes(`<dt>${label}</dt>`));
  assert.match(html, /Club QA/); assert.match(html, /\+18/); assert.match(html, /requieren revisión/);
  assert.doesNotMatch(html, /<button|<form|<input|<select|<textarea|onclick|fetch\(/i);
});
test("unavailable and illustrative sources expose their origin without certifying conditions", () => {
  assert.match(render({ dataSource: "demo" }), /Información ilustrativa/);
  assert.match(render({ dataSource: "unavailable" }), /No se pudo confirmar la fuente/);
  assert.doesNotMatch(render({ dataSource: "unavailable" }), /Club QA|<dl/);
});
test("cross-tenant association is suppressed and returned text is escaped", () => {
  assert.doesNotMatch(render({ tenantScope: "other-brand" }), /Club QA|<dl/);
  const html = render({ reward: { ...props.reward, reservation_requirements: { ...requirements, program: { ...requirements.program, name: "<script>private</script>" } } } });
  assert.doesNotMatch(html, /<script>/); assert.match(html, /&lt;script&gt;/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../src/app/(app)/loyalty/rewards/rewards-client.tsx", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const module = { exports: {} };
new Function("require", "module", "exports", code)(() => ({}), module, module.exports);
const { buildRewardSavePayload, rewardSaveErrorCopy } = module.exports;
const reward = { id: "10000000-0000-4000-8000-000000000001", program_id: "20000000-0000-4000-8000-000000000001", tenant_slug: "tenant-a", code: "VISIT", title: "Visita", stock_total: 10, stock_remaining: 2, requires_age_gate: true, network_visible: false };
const form = overrides => ({ code: "VISIT", title: "Título editado", description: "Descripción", type: "TOUR", points_cost: 0, stock_total: 10, image_url: "", status: "active", requires_age_gate: true, network_visible: false, ...overrides });

test("editing metadata sends saved program identity and flags without resetting stock", () => {
  const payload = buildRewardSavePayload("tenant-other", form(), reward);
  assert.equal(payload.tenant_slug, "tenant-a");
  assert.equal(payload.reward_id, reward.id); assert.equal(payload.program_id, reward.program_id);
  assert.equal(payload.requires_age_gate, true); assert.equal(payload.network_visible, false);
  assert.equal(Object.hasOwn(payload, "stock_total"), false); assert.equal(Object.hasOwn(payload, "stock_remaining"), false);
});
test("changing total stock sends only the desired total and leaves concurrency to persisted counters", () => {
  const payload = buildRewardSavePayload("tenant-a", form({ stock_total: 12 }), reward);
  assert.equal(payload.stock_total, 12); assert.equal(Object.hasOwn(payload, "stock_remaining"), false);
});
test("zero and unlimited saved stocks retain their meaning during metadata edits", () => {
  for (const total of [0, null]) {
    const payload = buildRewardSavePayload("tenant-a", form({ stock_total: total }), { ...reward, stock_total: total });
    assert.equal(Object.hasOwn(payload, "stock_total"), false); assert.equal(Object.hasOwn(payload, "stock_remaining"), false);
  }
  assert.match(source, /setStockTotal\(reward\.stock_total \?\? null\)/);
});
test("new benefits initialize stock explicitly but require a selected company", () => {
  assert.throws(() => buildRewardSavePayload("", form(), null), /tenant_required/);
  const payload = buildRewardSavePayload(" Tenant-A ", form({ stock_total: 0 }), null);
  assert.equal(payload.tenant_slug, "tenant-a"); assert.equal(payload.stock_total, 0); assert.equal(payload.stock_remaining, 0);
  assert.doesNotMatch(source, /setCustomTenant\("demobodega"\)|useState\("demobodega"\)/);
});
test("missing saved identifiers or policy cannot be silently defaulted into a mutation", () => {
  for (const patch of [{ id: undefined }, { program_id: undefined }, { requires_age_gate: undefined }, { network_visible: undefined }]) {
    assert.throws(() => buildRewardSavePayload("tenant-a", form(), { ...reward, ...patch }), /reward_configuration_unavailable/);
  }
});
test("invalid numeric input remains visible for correction and is never coerced to zero", () => {
  for (const value of [NaN, Infinity, -1, 1.5, 2_147_483_648]) {
    assert.throws(() => buildRewardSavePayload("tenant-a", form({ stock_total: value }), reward), /invalid_stock_total/);
    assert.throws(() => buildRewardSavePayload("tenant-a", form({ points_cost: value }), reward), /invalid_points_cost/);
  }
  assert.doesNotMatch(source, /setStockTotal\(parseInt|setPointsCost\(parseInt/);
});
test("stock/program errors explain recovery and preserve the edit form", () => {
  assert.match(rewardSaveErrorCopy("stock_total_below_consumed"), /consumidas|canjes/);
  assert.match(rewardSaveErrorCopy("loyalty_program_not_found"), /programa.*configurado/);
  assert.match(rewardSaveErrorCopy("reward_update_conflict"), /formulario sigue aquí/);
  assert.match(rewardSaveErrorCopy("private-database-error"), /No se pudo confirmar/);
  assert.doesNotMatch(rewardSaveErrorCopy("private-database-error"), /private-database-error/);
  assert.match(source, /Cambiar el total agrega o quita unidades/);
});

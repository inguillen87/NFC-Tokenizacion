import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { REWARD_REQUIREMENTS_VERSION } from "../src/lib/reward-reservation-notices.ts";

const source = readFileSync(new URL("../src/app/(app)/loyalty/rewards/rewards-client.tsx", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const module = { exports: {} };
new Function("require", "module", "exports", code)(name => name.endsWith("/reward-reservation-notices") ? { REWARD_REQUIREMENTS_VERSION } : {}, module, module.exports);
const { buildRewardSavePayload, canEditReward, rewardSaveErrorCopy, rewardStockLabel } = module.exports;
const reward = { id: "10000000-0000-4000-8000-000000000001", program_id: "20000000-0000-4000-8000-000000000001", tenant_slug: "tenant-a", code: "VISIT", title: "Visita", stock_total: 10, stock_remaining: 2, requires_age_gate: true, network_visible: false };
const form = overrides => ({ code: "VISIT", title: "Título editado", description: "Descripción", type: "TOUR", points_cost: 0, stock_total: 10, image_url: "", status: "active", requires_age_gate: true, network_visible: false, ...overrides });

test("reward cards distinguish confirmed, missing and inconsistent stock", () => {
  for (const [remaining, total, label] of [
    [0, 5, "Disponibles: 0 de 5"],
    [0, 0, "Disponibles: 0 de 0"],
    [1, 5, "Disponibles: 1 de 5"],
    [0, null, "Disponibles: 0 · total sin informar"],
    [2, undefined, "Disponibles: 2 · total sin informar"],
    [null, 5, "Stock: 5 en total · disponibilidad sin confirmar"],
    [undefined, 0, "Stock: 0 en total · disponibilidad sin confirmar"],
    [null, null, "Sin límite de stock registrado"],
    [undefined, null, "Stock no informado"],
    [null, undefined, "Stock no informado"],
    [undefined, undefined, "Stock no informado"],
    [2_147_483_647, 2_147_483_647, "Disponibles: 2147483647 de 2147483647"],
    [6, 5, "Stock inconsistente"],
    [1, 0, "Stock inconsistente"],
  ]) {
    assert.equal(rewardStockLabel(remaining, total), label);
  }
  for (const value of ["0", false, {}, NaN, Infinity, -1, 1.5, 2_147_483_648]) {
    assert.equal(rewardStockLabel(value, 5), "Stock inconsistente");
    assert.equal(rewardStockLabel(0, value), "Stock inconsistente");
  }
  assert.match(source, /\{rewardStockLabel\(item\.stock_remaining, item\.stock_total\)\}/);
});

test("editing requires persisted values the form can represent without rewriting", () => {
  const requirements = { version: REWARD_REQUIREMENTS_VERSION, program: { association_confirmed: true } };
  const modern = { ...reward, points: 0, type: "SERVICE", status: "archived", description: null, image_url: null, reservation_requirements: requirements };
  assert.equal(canEditReward(modern, "tenant-a"), true);
  assert.equal(canEditReward(modern, "tenant-other"), false);
  for (const patch of [
    { code: "S".repeat(200) }, { code: " visit " }, { type: "UNSUPPORTED" }, { status: "legacy" }, { status: ["active"] },
    { points: null }, { stock_remaining: null }, { network_visible: undefined }, { image_url: undefined },
    { reservation_requirements: { ...requirements, program: { association_confirmed: false } } },
  ]) assert.equal(canEditReward({ ...modern, ...patch }, "tenant-a"), false);
  assert.equal(canEditReward({ ...modern, stock_total: null, stock_remaining: null }, "tenant-a"), true);
});

test("editing another field preserves a stored null description", () => {
  const missing = { ...reward, description: null };
  assert.equal(Object.hasOwn(buildRewardSavePayload("tenant-a", form({ description: "" }), missing), "description"), false);
  assert.equal(buildRewardSavePayload("tenant-a", form({ description: "Nueva descripción" }), missing).description, "Nueva descripción");
  assert.equal(buildRewardSavePayload("tenant-a", form({ description: "" }), { ...missing, description: "Anterior" }).description, "");
});

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
  assert.match(source, /setStockTotal\(reward\.stock_total\)/);
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


test("the new-benefit payload carries an explicit creation intent while exact edits do not", () => {
  const creating = buildRewardSavePayload("tenant-a", form(), null);
  assert.equal(creating.creationIntent, "admin-reward-first-create.v1");
  assert.equal(Object.hasOwn(creating, "reward_id"), false);
  const editing = buildRewardSavePayload("tenant-a", form(), reward);
  assert.equal(Object.hasOwn(editing, "creationIntent"), false);
  assert.equal(editing.reward_id, reward.id); assert.equal(editing.program_id, reward.program_id);
});

test("a duplicate new code explains deliberate recovery and keeps the current form", () => {
  const copy = rewardSaveErrorCopy("reward_create_conflict");
  assert.match(copy, /otro código/); assert.match(copy, /existente.*editar/); assert.match(copy, /formulario sigue aquí/);
});

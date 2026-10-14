import assert from "node:assert/strict";
import test from "node:test";
import { REWARD_REQUIREMENTS_VERSION, rewardReservationNotice } from "../src/lib/reward-reservation-notices.ts";

const context = { tenantScope: "tenant-a", dataSource: "production" };
const requirements = () => ({
  version: REWARD_REQUIREMENTS_VERSION,
  program: { association_confirmed: true, name: "Club de la marca", age_gate_required: false },
  starts_at: "2026-10-01T12:00:00.000Z", ends_at: "2026-12-31T23:59:00.000Z",
  requires_age_gate: false, eligibility_policy_review: false, fulfillment_policy_review: false,
  redemption_limit_per_member: null, redemption_limit_known: true,
});
const reward = (patch = {}) => ({ tenant_slug: "tenant-a", status: "active", reservation_requirements: { ...requirements(), ...patch } });
const row = (notice, label) => notice.rows.find(item => item.label === label);

test("configured false and known null keep their meaning without authorizing a reservation", () => {
  const notice = rewardReservationNotice(reward(), context);
  assert.equal(notice.state, "reported");
  assert.equal(row(notice, "Límite por persona").value, "Sin límite configurado");
  assert.match(row(notice, "Edad").value, /Sin requisito de edad configurado/);
  assert.match(row(notice, "Acceso").value, /Sin condiciones personalizadas configuradas/);
  assert.match(notice.note, /estado Activo no confirma/);
  assert.equal(Object.hasOwn(notice, "canReserve"), false);
});
test("legacy missing, unsupported version and malformed object remain different", () => {
  assert.equal(rewardReservationNotice({ tenant_slug: "tenant-a" }, context).state, "legacy");
  for (const value of [null, [], "policy", { version: "future.v2" }]) {
    assert.equal(rewardReservationNotice({ tenant_slug: "tenant-a", reservation_requirements: value }, context).state, "invalid");
  }
});
test("source absence and demo never certify persisted configuration", () => {
  assert.equal(rewardReservationNotice(reward(), { ...context, dataSource: "unavailable" }).state, "unavailable");
  const demo = rewardReservationNotice(reward(), { ...context, dataSource: "demo" });
  assert.equal(demo.state, "demo"); assert.deepEqual(demo.rows, []);
  assert.match(demo.note, /no confirma programas/);
});
test("a mismatched or absent tenant does not disclose a program under a scoped catalog", () => {
  for (const tenant_slug of ["tenant-b", undefined, null]) {
    const notice = rewardReservationNotice({ ...reward(), tenant_slug }, context);
    assert.equal(notice.state, "scope_mismatch"); assert.deepEqual(notice.rows, []);
    assert.doesNotMatch(JSON.stringify(notice), /Club de la marca/);
  }
  assert.equal(rewardReservationNotice(reward(), { ...context, tenantScope: " Tenant-A " }).state, "reported");
});
test("global read-only catalogs may inspect a returned program but never create an authority", () => {
  const notice = rewardReservationNotice({ ...reward(), tenant_slug: "tenant-b" }, { ...context, tenantScope: "" });
  assert.equal(notice.state, "reported");
  assert.match(notice.note, /se valida para cada persona/);
  assert.equal(rewardReservationNotice({ ...reward(), tenant_slug: null }, { ...context, tenantScope: "" }).state, "scope_mismatch");
});
test("program association must be confirmed independently of a plausible name", () => {
  for (const association_confirmed of [false, null, undefined, "true"]) {
    const notice = rewardReservationNotice(reward({ program: { association_confirmed, name: "Other private program", age_gate_required: false } }), context);
    assert.equal(notice.state, "review");
    assert.doesNotMatch(row(notice, "Programa").value, /Other private program/);
    assert.equal(row(notice, "Edad").attention, true);
  }
  assert.match(row(rewardReservationNotice(reward({ program: { association_confirmed: true, name: null, age_gate_required: false } }), context), "Programa").value, /nombre no informado/);
});
test("age gating from either benefit or program remains visible and unknown is never false", () => {
  for (const patch of [{ requires_age_gate: true }, { program: { ...requirements().program, age_gate_required: true } }]) {
    assert.match(row(rewardReservationNotice(reward(patch), context), "Edad").value, /\(\+18\)/);
  }
  const partial = rewardReservationNotice(reward({ requires_age_gate: true, program: { ...requirements().program, age_gate_required: null } }), context);
  assert.match(row(partial, "Edad").value, /\+18.*falta confirmar/);
  for (const requires_age_gate of [null, undefined, "false", 0]) {
    assert.match(row(rewardReservationNotice(reward({ requires_age_gate }), context), "Edad").value, /sin confirmar/);
  }
});
test("unknown or nonempty policy projections ask for review and never render raw data", () => {
  for (const key of ["eligibility_policy_review", "fulfillment_policy_review"]) {
    for (const value of [true, null, undefined, "false", { credential: "not-for-display" }]) {
      const notice = rewardReservationNotice(reward({ [key]: value }), context);
      assert.equal(notice.state, "review");
      assert.match(row(notice, key.startsWith("eligibility") ? "Acceso" : "Entrega").value, /revisión/);
      assert.doesNotMatch(JSON.stringify(notice), /not-for-display/);
    }
  }
});
test("limit unknown, explicitly unlimited, zero and a positive limit stay distinct", () => {
  for (const redemption_limit_known of [false, undefined, null, "true"]) {
    assert.equal(row(rewardReservationNotice(reward({ redemption_limit_known }), context), "Límite por persona").value, "Límite sin confirmar");
  }
  for (const [limit, expected] of [[null, "Sin límite configurado"], [0, "Cero reservas configuradas"], [1, "1 reserva"], [3, "3 reservas"]]) {
    assert.equal(row(rewardReservationNotice(reward({ redemption_limit_per_member: limit }), context), "Límite por persona").value, expected);
  }
  for (const limit of [undefined, NaN, Infinity, -1, 1.5, "2", 2_147_483_648]) {
    assert.equal(row(rewardReservationNotice(reward({ redemption_limit_per_member: limit }), context), "Límite por persona").value, "Límite sin confirmar");
  }
});
test("timestamps require canonical valid instants; null is not an unlimited period", () => {
  assert.match(row(rewardReservationNotice(reward(), context), "Desde").value, /UTC$/);
  assert.equal(row(rewardReservationNotice(reward({ ends_at: null }), context), "Hasta").value, "Fecha no informada");
  for (const value of [undefined, "2026-02-30T12:00:00.000Z", "tomorrow", 0, "2026-12-31", "2026-12-31T23:59:00.000+00:00"]) {
    assert.equal(row(rewardReservationNotice(reward({ ends_at: value }), context), "Hasta").value, "Fecha sin confirmar");
  }
  const reversed = rewardReservationNotice(reward({ ends_at: "2026-09-30T00:00:00.000Z" }), context);
  assert.equal(reversed.state, "review"); assert.match(row(reversed, "Hasta").value, /anterior al inicio/);
});
test("absent required fields remain unknown instead of inheriting defaults", () => {
  for (const key of Object.keys(requirements()).filter(key => key !== "version")) {
    const projection = requirements(); delete projection[key];
    assert.equal(rewardReservationNotice({ ...reward(), reservation_requirements: projection }, context).state, "review");
  }
});

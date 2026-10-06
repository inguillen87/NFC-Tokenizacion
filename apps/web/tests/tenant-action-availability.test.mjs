import test from "node:test";
import assert from "node:assert/strict";
import { parseTenantActionConfiguration, resolveTenantActionAvailability, TENANT_ACTIONS_VERSION } from "../src/app/sun/tenant-action-availability.ts";
import { resolvePostTapQuickActionAvailability } from "../src/app/sun/post-tap-policy.ts";

const program = { id: "10000000-0000-4000-8000-000000000001", name: "Programa publicado", pointsName: "Puntos", pointsPerValidTap: 0 };
const trivia = { id: "10000000-0000-4000-8000-000000000002", title: "Trivia publicada", revision: "a".repeat(64), pointsPerCorrect: 0, completionBonus: 0 };
const configuration = { version: TENANT_ACTIONS_VERSION, status: "published", allowedActions: ["lead", "feedback", "sommelier", "marketplace"], program, trivia, catalogAvailable: true };
const resolve = overrides => resolveTenantActionAvailability({ configuration, verifiedTenant: true, allowedActions: ["rewards"], ...overrides });

test("missing, malformed, unverified and unavailable configuration never invent services", () => {
  for (const overrides of [{ configuration: undefined }, { configuration: null }, { configuration: {} }, { verifiedTenant: false }, { canEngage: false }, { configuration: { ...configuration, status: "unavailable" } }]) {
    const result = resolve(overrides);
    for (const action of ["lead", "feedback", "sommelier", "marketplace", "loyalty", "trivia"]) assert.equal(result[action], false, action);
  }
});
test("published service choices are explicit and never grant unrelated forms", () => {
  for (const action of ["lead", "feedback", "sommelier"]) {
    const result = resolve({ configuration: { ...configuration, allowedActions: [action], program: null, trivia: null } });
    for (const other of ["lead", "feedback", "sommelier", "marketplace", "loyalty", "trivia"]) assert.equal(result[other], action === other, other);
  }
  assert.equal(resolve({ blockedActions: ["sommelier", "feedback", "rewards", "marketplace"] }).sommelier, false);
  assert.equal(resolve({ configuration: { ...configuration, catalogAvailable: false } }).marketplace, false);
});
test("loyalty needs published records and tap reward permission independently of profile switches", () => {
  const result = resolve({ configuration: { ...configuration, status: "unpublished", allowedActions: [] } });
  assert.equal(result.lead, false); assert.equal(result.trivia, true); assert.equal(result.loyalty, true);
  assert.equal(resolve({ allowedActions: [] }).trivia, false);
  assert.equal(resolve({ allowedActions: ["claim"] }).loyalty, false);
  assert.equal(resolve({ blockedActions: ["rewards"] }).trivia, false);
  assert.equal(resolve({ configuration: { ...configuration, trivia: null } }).trivia, false);
  assert.equal(resolve({ configuration: { ...configuration, trivia: null } }).loyalty, true);
});
test("projection parser strips private extras and accepts zero without fabricating awards", () => {
  assert.deepEqual(parseTenantActionConfiguration({ ...configuration, email: "synthetic@example.invalid", correctIndex: 1 }), configuration);
  for (const changes of [{ version: "old" }, { allowedActions: ["rewards"] }, { allowedActions: "lead" }, { catalogAvailable: 1 }, { program: undefined }, { trivia: undefined },
    { trivia: { ...trivia, revision: "A".repeat(64) } }, { trivia: { ...trivia, pointsPerCorrect: -1 } }, { program: { ...program, pointsPerValidTap: "10" } }]) assert.equal(parseTenantActionConfiguration({ ...configuration, ...changes }), null);
});
test("public tenant identity is optional for legacy service projections and strict when reported", () => {
  assert.equal(parseTenantActionConfiguration(configuration).tenantSlug, undefined);
  assert.equal(parseTenantActionConfiguration({ ...configuration, tenantSlug: "tenant-qa" }).tenantSlug, "tenant-qa");
  assert.equal(parseTenantActionConfiguration({ ...configuration, tenantSlug: null }).tenantSlug, null);
  for (const tenantSlug of ["", "../tenant", "tenant-qa\n", "TENANT", ["tenant-qa"]]) assert.equal(parseTenantActionConfiguration({ ...configuration, tenantSlug }), null);
});
test("company settings do not remove rights governed by the existing ownership policy", () => {
  const result = resolvePostTapQuickActionAvailability({ allowedActions: ["claim", "warranty", "tokenization", "provenance"], configuration: null, verifiedTenant: true });
  assert.equal(result.primary, true); assert.equal(result.warranty, true); assert.equal(result.wallet, true); assert.equal(result.trace, true);
  assert.equal(result.marketplace, false); assert.equal(result.rewards, false);
});
test("explicit demo simulation stays separate from missing real configuration", () => {
  assert.equal(resolve({ configuration: null }).trivia, false);
  assert.equal(resolve({ configuration: null, verifiedTenant: false, isDemoPreview: true }).trivia, true);
});

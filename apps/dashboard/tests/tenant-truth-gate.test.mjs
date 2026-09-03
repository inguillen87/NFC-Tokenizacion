import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { canDemoSandboxAccess } from "../src/lib/admin-proxy-policy.ts";
import { requiredPermissionForAdminResource } from "../src/lib/permission-policy.ts";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [rewardsPage, rewardsClient, loyaltyPage, overviewPage, campaignsPage, offersPage] = await Promise.all([
  read("../src/app/(app)/loyalty/rewards/page.tsx"),
  read("../src/app/(app)/loyalty/rewards/rewards-client.tsx"),
  read("../src/app/(app)/loyalty/page.tsx"),
  read("../src/app/(app)/loyalty/overview/page.tsx"),
  read("../src/app/(app)/loyalty/campaigns/page.tsx"),
  read("../src/app/(app)/consumer-network/offers/page.tsx"),
]);

test("admin BFF maps commercial reads and writes to their existing capabilities", () => {
  assert.equal(requiredPermissionForAdminResource("GET", "loyalty/overview"), "rewards:read");
  assert.equal(requiredPermissionForAdminResource("GET", "loyalty/rewards"), "rewards:read");
  assert.equal(requiredPermissionForAdminResource("POST", "loyalty/rewards"), "rewards:write");
  assert.equal(requiredPermissionForAdminResource("GET", "loyalty/trivia/overview"), "campaigns:read");
  assert.equal(requiredPermissionForAdminResource("POST", "campaigns/test-whatsapp"), "campaigns:test_whatsapp");
  assert.equal(requiredPermissionForAdminResource("POST", "rewards/redemptions/validate"), "rewards:validate");
  assert.equal(requiredPermissionForAdminResource("GET", "consumer-network/overview"), "crm:read");
  assert.equal(requiredPermissionForAdminResource("GET", "consumer-network/offers"), "marketplace:read");
  assert.equal(requiredPermissionForAdminResource("PATCH", "consumer-network/offers"), "marketplace:write");
});

test("demo policy permits declared commercial reads but rejects reward mutations", () => {
  assert.equal(canDemoSandboxAccess("GET", "loyalty/overview"), true);
  assert.equal(canDemoSandboxAccess("GET", "loyalty/rewards"), true);
  assert.equal(canDemoSandboxAccess("GET", "loyalty/trivia/overview"), true);
  assert.equal(canDemoSandboxAccess("POST", "loyalty/rewards"), false);
  assert.equal(canDemoSandboxAccess("POST", "campaigns/test-whatsapp"), false);
});

test("commercial pages enforce the same read permissions exposed by navigation", () => {
  assert.match(rewardsPage, /requireDashboardSession\("rewards:read"\)/);
  assert.match(campaignsPage, /requireDashboardSession\("campaigns:read"\)/);
  assert.match(overviewPage, /requireDashboardSession\("rewards:read"\)/);
  assert.match(offersPage, /requireDashboardSession\("marketplace:read"\)/);
});

test("rewards requires explicit global intent and separates confirmed empty, forbidden and upstream failure", () => {
  assert.match(rewardsPage, /loyalty\/rewards\?scope=global/);
  assert.match(rewardsPage, /const canWrite = Boolean\(tenantScope\) && !session\.isDemo/);
  assert.match(rewardsPage, /"ready_empty" \| "forbidden" \| "upstream_error"/);
  assert.match(rewardsPage, /response\.status === 403/);
  assert.match(rewardsPage, /meta\.demoMode/);
  assert.match(rewardsPage, /reason: "illustrative_presets"/);
  assert.match(overviewPage, /loyalty\/rewards\?scope=global/);
});

test("RewardsClient is explicitly source-aware and cannot expose mutations in demo or read-only sessions", () => {
  for (const prop of ["isDemo", "canWrite", "dataSource"]) {
    assert.match(rewardsClient, new RegExp(`${prop}:`));
  }
  assert.match(rewardsClient, /if \(!canWrite\) return/);
  assert.match(rewardsClient, /if \(!canWrite\) \{[\s\S]*Esta sesión tiene acceso de solo lectura/);
  assert.match(rewardsClient, /\{canWrite \? \([\s\S]*Nuevo Beneficio/);
  assert.match(rewardsClient, /isModalOpen && canWrite/);
  assert.match(rewardsClient, /Datos ilustrativos · sin persistencia/);
  assert.match(rewardsClient, /fuente respondió correctamente y confirmó que todavía no hay beneficios/);
  assert.match(rewardsClient, /No se pudo confirmar la fuente de recompensas/);
});

test("loyalty never turns a forbidden or unavailable source into operational zero", () => {
  assert.match(loyaltyPage, /type LoyaltyAvailability = "ready" \| "ready_empty" \| "forbidden" \| "upstream_error"/);
  assert.match(loyaltyPage, /response\.status === 403/);
  assert.match(loyaltyPage, /Los indicadores no disponibles se muestran con “—”, nunca como actividad cero/);
  assert.match(loyaltyPage, /metricsAvailable \? String\(overview\.points_issued \?\? 0\) : "—"/);
  assert.doesNotMatch(loyaltyPage, /Loyalty Engine Activo/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { buildLoyaltyAdminUrl } = await import(
  "../src/app/(app)/loyalty/campaigns/loyalty-campaign-scope.ts"
);
const campaignPage = await readFile(
  new URL("../src/app/(app)/loyalty/campaigns/page.tsx", import.meta.url),
  "utf8",
);
const campaignClient = await readFile(
  new URL("../src/app/(app)/loyalty/campaigns/loyalty-campaigns-client.tsx", import.meta.url),
  "utf8",
);
const orderRequestsPage = await readFile(
  new URL("../src/app/(app)/consumer-network/order-requests/page.tsx", import.meta.url),
  "utf8",
);

test("loyalty admin URLs require an authorized tenant scope", () => {
  assert.equal(buildLoyaltyAdminUrl("consumer-network/members", ""), null);
  assert.equal(buildLoyaltyAdminUrl("consumer-network/members", "   "), null);
  assert.equal(buildLoyaltyAdminUrl("consumer-network/members?tenant=attacker", "tenant-a"), null);
  assert.equal(
    buildLoyaltyAdminUrl("/consumer-network/members", " Tenant-A "),
    "/api/admin/consumer-network/members?tenant=tenant-a",
  );
});

test("loyalty campaigns derive scope on the server and never hardcode the demo tenant in requests", () => {
  const sessionIndex = campaignPage.indexOf("await requireDashboardSession()");
  const contextIndex = campaignPage.indexOf("await createAdminPageContext(session, query.tenant)");
  assert.ok(sessionIndex >= 0 && contextIndex > sessionIndex);
  assert.match(campaignPage, /tenantScope=\{adminContext\.tenantSlug\}/);
  assert.match(campaignPage, /allowDemoData=\{Boolean\(session\.isDemo\)\}/);

  assert.match(campaignClient, /buildLoyaltyAdminUrl\("consumer-network\/members", tenantScope\)/);
  assert.match(campaignClient, /buildLoyaltyAdminUrl\("loyalty\/trivia\/overview", tenantScope\)/);
  assert.match(campaignClient, /buildLoyaltyAdminUrl\("campaigns\/test-whatsapp", tenantScope\)/);
  assert.match(campaignClient, /buildLoyaltyAdminUrl\("rewards\/redemptions\/validate", tenantScope\)/);
  assert.match(campaignClient, /String\(payload\?\.tenant \|\| ""\)[\s\S]*tenant_scope_mismatch/);
  assert.doesNotMatch(campaignClient, /[?&]tenant=demobodega/);
});

test("production loyalty views fail closed instead of substituting demo audiences, trivia or campaigns", () => {
  assert.match(campaignClient, /const audienceUsesDemo = allowDemoData && Boolean\(audienceError\)/);
  assert.match(campaignClient, /allowDemoData \? INITIAL_CAMPAIGNS : \[\]/);
  assert.match(campaignClient, /triviaGuideEnabled = allowDemoData/);
  assert.match(campaignClient, /visibleTriviaQuestions/);
  assert.match(campaignClient, /loyalty-audience-unavailable/);
  assert.match(campaignClient, /loyalty-trivia-unavailable/);
  assert.match(campaignClient, /No se muestran perfiles demo ni se interpreta la falla como cero clientes/);
  assert.match(campaignClient, /no se generan conclusiones ni recomendaciones desde datos sustitutos/);
});

test("order requests use the scoped BFF, distinguish failures from empty data and provide a real CSV path", () => {
  const pageBody = orderRequestsPage.slice(orderRequestsPage.indexOf("export default async function OrderRequestsPage"));
  const permissionIndex = pageBody.indexOf('"consumers.read_pii"');
  const contextIndex = pageBody.indexOf("await createAdminPageContext(session, query.tenant)");
  const requestIndex = pageBody.indexOf("await getOrderRequests(adminContext");
  assert.ok(permissionIndex >= 0 && contextIndex > permissionIndex && requestIndex > contextIndex);

  assert.match(orderRequestsPage, /fetchAdminPage\(context, "consumer-portal\/order-requests"\)/);
  assert.match(orderRequestsPage, /normalizedTenant\(\(payload as \{ tenant\?: unknown \}\)\.tenant\) !== context\.tenantSlug/);
  assert.match(orderRequestsPage, /tenant_scope_mismatch/);
  assert.match(orderRequestsPage, /order-requests-source-unavailable/);
  assert.match(orderRequestsPage, /order-requests-confirmed-empty/);
  assert.match(orderRequestsPage, /data-order-requests-source=\{result\.source\}/);
  assert.match(orderRequestsPage, /<DataTable/);
  assert.match(orderRequestsPage, /disabled[\s\S]*aria-describedby=\{reasonId\}/);
  assert.match(orderRequestsPage, /CSV disponible en la tabla/);
  assert.doesNotMatch(orderRequestsPage, /Carlos Gómez|carlos\.g@example\.com|Lucía Fernández|lucia\.f@example\.com/);
});

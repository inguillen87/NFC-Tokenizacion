import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const publicRoute = await readFile(new URL("../src/app/marketplace/offers/route.ts", import.meta.url), "utf8");
const adminRoute = await readFile(new URL("../src/app/admin/consumer-network/offers/route.ts", import.meta.url), "utf8");
const dashboardPage = await readFile(new URL("../../dashboard/src/app/(app)/consumer-network/offers/page.tsx", import.meta.url), "utf8");

test("anonymous marketplace catalog returns only explicit public-network offers", () => {
  assert.match(publicRoute, /enforceCriticalRateLimit/);
  assert.match(publicRoute, /o\.visibility = 'nexid_network'/);
  assert.match(publicRoute, /visibility: "nexid_network"/);
  assert.match(publicRoute, /cache-control/);
  assert.doesNotMatch(publicRoute, /SELECT\s+o\.\*/);
  assert.doesNotMatch(publicRoute, /eligibility_json/);
});

test("private offer inventory uses the authenticated tenant-scoped admin route", () => {
  assert.ok(adminRoute.indexOf("checkAdmin(req)") < adminRoute.indexOf("ensureConsumerPortalSchema()"));
  assert.match(adminRoute, /getAdminTenantScope\(req\)/);
  assert.match(adminRoute, /resolveConsumerNetworkTenant\(\{ forcedTenantSlug, requestedTenantSlug \}\)/);
  assert.match(adminRoute, /WHERE \(\$\{tenant\} = '' OR t\.slug = \$\{tenant\}\)/);
  assert.match(adminRoute, /LIMIT 100/);

  assert.match(dashboardPage, /createAdminPageContext\(session, query\.tenant\)/);
  assert.match(dashboardPage, /fetchAdminPage\(context, "consumer-network\/offers"\)/);
  assert.doesNotMatch(dashboardPage, /\/marketplace\/offers/);
  assert.doesNotMatch(dashboardPage, /<button[^>]*>[\s\S]{0,80}\+ Crear oferta/);
});

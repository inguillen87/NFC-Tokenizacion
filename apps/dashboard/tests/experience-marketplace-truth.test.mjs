import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const experiencesPage = await readFile(new URL("../src/app/(app)/loyalty/experiences/page.tsx", import.meta.url), "utf8");
const adminExperiencesPage = await readFile(new URL("../src/app/(app)/experiences/page.tsx", import.meta.url), "utf8");
const experiencesPanel = await readFile(new URL("../src/components/verified-experiences-panel.tsx", import.meta.url), "utf8");
const marketplace = await readFile(new URL("../src/app/(app)/consumer-network/marketplace/page.tsx", import.meta.url), "utf8");
const marketplaceRoute = await readFile(new URL("../src/app/api/tenant-marketplace/route.ts", import.meta.url), "utf8");
const marketplaceItemRoute = await readFile(new URL("../src/app/api/tenant-marketplace/[id]/route.ts", import.meta.url), "utf8");
const marketplaceHelpers = await readFile(new URL("../src/app/api/tenant-marketplace/route-helpers.ts", import.meta.url), "utf8");

test("experiences keeps ready-empty separate from upstream, transport and payload failures", () => {
  assert.match(experiencesPage, /availability: "unreachable"/);
  assert.match(experiencesPage, /availability: "upstream_error"/);
  assert.match(experiencesPage, /availability: "invalid_payload"/);
  assert.match(experiencesPage, /availability: "ready"/);
  assert.match(experiencesPage, /La fuente confirmó una lista vacía/);
  assert.match(experiencesPage, /No se infieren registros ni ceros/);
  assert.match(experiencesPage, /score: formatTrustScore\(review\.trust_score\)/);
  assert.match(experiencesPage, /return "No informado"/);
  assert.match(experiencesPage, /Producto sin nombre reportado/);
  assert.doesNotMatch(experiencesPage, /score: "0\/100"|if \(!response\.ok\) return null/);
  assert.doesNotMatch(experiencesPage, /Number\(review\.trust_score \|\| 0\)|Producto verificado/);
});

test("shared experiences panel never promotes empty or failed sources to real reviews", () => {
  assert.match(experiencesPanel, /availability = "fixture"/);
  assert.match(experiencesPanel, /availability === "ready"[\s\S]*items\.slice/);
  assert.match(experiencesPanel, /No se muestran reviews de ejemplo/);
  assert.match(experiencesPanel, /Ejemplo de cola de moderación/);
  assert.match(experiencesPanel, /experience\.trust === null \? "Trust no informado"/);
  assert.match(experiencesPanel, /Producto sin nombre reportado/);
  assert.match(experiencesPanel, /Ubicación no reportada/);
  assert.match(experiencesPanel, /Sin badge de verificación/);
  assert.doesNotMatch(experiencesPanel, /fallbackExperiences|Experiencias verificadas por dueños reales/);
  assert.doesNotMatch(experiencesPanel, /Number\(item\.trust_score \|\| 0\)|Producto verificado/);
});

test("admin experiences treats reviews and taps as governed digital evidence", () => {
  assert.match(adminExperiencesPage, /habilitadas por policy después de una lectura asociada a evidencia digital/);
  assert.match(adminExperiencesPage, /no prueba por sí sola autenticidad, procedencia, uso ni estado físico/);
  assert.match(adminExperiencesPage, /Check-ins registrados/);
  assert.doesNotMatch(adminExperiencesPage, /escaneo de productos auténticos|Check-ins verificados/);
});

test("club and marketplace fixtures are explicit examples without invented production metrics", () => {
  assert.match(experiencesPage, /Clubes de ejemplo por vertical/);
  assert.match(experiencesPage, /no representan miembros, ratings, compras ni check-ins observados/);
  assert.match(marketplace, /Vista previa · ejemplos de prueba social/);
  assert.match(marketplace, /fixtures de UX, no reviews del tenant/);
  assert.doesNotMatch(experiencesPage, /842 miembros|510 miembros|1\.120 miembros|4\.9 estrellas verificadas|87% compra validada|Check-in real|Clubes vivos/);
  assert.doesNotMatch(marketplace, /Estado de la Red: Activo|Marketplace con prueba social real/);
});

test("marketplace discloses source, withholds false zeroes and marks the in-memory API as demo", () => {
  assert.match(marketplace, /MarketplaceAvailability/);
  assert.match(marketplace, /setAvailability\("unreachable"\)/);
  assert.match(marketplace, /setAvailability\("upstream_error"\)/);
  assert.match(marketplace, /setAvailability\("invalid_payload"\)/);
  assert.match(marketplace, /availability === "ready" \? totals\.total : "—"/);
  assert.match(marketplace, /Este estado no representa inventario cero/);
  assert.match(marketplace, /Catálogo temporal del sandbox/);
  assert.match(marketplaceRoute, /demoMode: true,[\s\S]*dataSource: "demo"/);
  assert.match(marketplace, /setCanWrite\(data\.canWrite === true\)/);
  assert.match(marketplace, /Solo lectura · falta marketplace:write/);
  assert.match(marketplace, /isEditorOpen && canWrite/);
  assert.match(marketplace, /Catálogo conectado · Sandbox/);
  assert.match(marketplace, /Simulación no persistente/);
  assert.match(marketplace, /Nada de esta vista publica inventario ni ventas reales/);
  assert.ok(
    marketplace.indexOf("Simulación no persistente") < marketplace.indexOf("Productos en este escenario"),
    "the sandbox disclosure must appear before any demo totals",
  );
});

test("tenant marketplace demo mutations are authenticated, permissioned and tenant isolated", () => {
  assert.match(marketplaceHelpers, /getDashboardSession\(\)/);
  assert.match(marketplaceHelpers, /dashboardPermissionMatches\(session\.permissions, permission, session\.deniedPermissions\)/);
  assert.match(marketplaceHelpers, /queryTenant && queryTenant !== sessionTenant/);
  assert.match(marketplaceHelpers, /__tenantMarketplaceStores\?: Map<string, MarketplaceStore>/);
  assert.match(marketplaceRoute, /authorizeTenantMarketplaceMutation\(req\)/);
  assert.match(marketplaceRoute, /tenantMarketplaceSameOrigin\(req\)/);
  assert.match(marketplaceRoute, /MAX_IMPORT_ITEMS = 100/);
  assert.match(marketplaceItemRoute, /authorizeTenantMarketplaceMutation\(req\)/);
  assert.match(marketplaceItemRoute, /tenantMarketplaceSameOrigin\(req\)/);
  assert.doesNotMatch(marketplaceRoute + marketplaceItemRoute, /__tenantMarketplaceStore\?: MarketplaceStore/);
});

test("tenantless administrators must choose one explicit tenant for every marketplace request", () => {
  assert.match(marketplace, /tenant_required/);
  assert.match(marketplace, /new URLSearchParams\(window\.location\.search\)\.get\("tenant"\)/);
  assert.match(marketplace, /Tenant requerido para aislar el catálogo/);
  assert.match(marketplace, /href="\/tenants"/);
  assert.match(marketplace, /\?tenant=\$\{encodeURIComponent\(tenantScope\)\}/);
  assert.match(marketplace, /fetch\(marketplaceApiUrl\(\), \{ cache: "no-store" \}\)/);
  assert.match(marketplace, /fetch\(marketplaceApiUrl\(editingId\),/);
  assert.match(marketplace, /fetch\(marketplaceApiUrl\(item\.id\),/);
  assert.match(marketplace, /fetch\(marketplaceApiUrl\(id\), \{ method: "DELETE" \}\)/);
  assert.match(marketplace, /window\.history\.replaceState\(\{\}, "", url\)/);
});

test("experiences and marketplace surfaces remain UTF-8 without visible mojibake", () => {
  assert.doesNotMatch(experiencesPage + experiencesPanel + marketplace, /Ã.|Â.|â.|�/u);
});

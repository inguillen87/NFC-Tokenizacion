import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const experiencesPage = await readFile(new URL("../src/app/(app)/loyalty/experiences/page.tsx", import.meta.url), "utf8");
const adminExperiencesPage = await readFile(new URL("../src/app/(app)/experiences/page.tsx", import.meta.url), "utf8");
const experiencesPanel = await readFile(new URL("../src/components/verified-experiences-panel.tsx", import.meta.url), "utf8");
const marketplace = await readFile(new URL("../src/app/(app)/consumer-network/marketplace/page.tsx", import.meta.url), "utf8");
const workspace = await readFile(new URL("../src/components/tenant-marketplace-workspace.tsx", import.meta.url), "utf8");
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

test("club fixtures remain explicit examples and the operational catalog claims no invented production metrics", () => {
  assert.match(experiencesPage, /Clubes de ejemplo por vertical/);
  assert.match(experiencesPage, /no representan miembros, ratings, compras ni check-ins observados/);
  assert.match(workspace, /Vista previa del formulario · sin publicar/);
  assert.match(workspace, /Una consulta no realiza un pago ni reserva stock/);
  assert.doesNotMatch(experiencesPage, /842 miembros|510 miembros|1\.120 miembros|4\.9 estrellas verificadas|87% compra validada|Check-in real|Clubes vivos/);
  assert.doesNotMatch(workspace, /Estado de la Red: Activo|Marketplace con prueba social real|Trust 0-100|Flujo directo simulado|Reviews/);
});

test("operational marketplace rejects unavailable sources instead of substituting demo inventories or zeroes", () => {
  assert.match(marketplace, /parseTenantCatalog\(body, context\.tenantSlug\)/);
  assert.match(marketplace, /context\.tenantSlug && !session\.isDemo/);
  assert.match(workspace, /este estado no significa que no haya productos/);
  assert.match(workspace, /La fuente confirmó que todavía no hay productos/);
  assert.match(workspace, /La demostración no consulta ni modifica el catálogo/);
  assert.match(marketplaceRoute, /forwardTenantMarketplace\(req\)/);
  assert.doesNotMatch(marketplace + marketplaceRoute + marketplaceHelpers, /__tenantMarketplaceStores|initialItems|demoMode: true|dataSource: "demo"/);
});

test("tenant marketplace forwards a validated credential with permission and canonical company boundaries", () => {
  assert.match(marketplaceHelpers, /getDashboardSessionCredential\(/);
  assert.match(marketplaceHelpers, /dashboardPermissionMatches\(session\.permissions, permission, session\.deniedPermissions\)/);
  assert.match(marketplaceHelpers, /resolveDashboardTenantScope\(session, requested\)/);
  assert.match(marketplaceHelpers, /catalog_same_origin_required/);
  assert.match(marketplaceHelpers, /catalog_body_too_large/);
  assert.match(marketplaceHelpers, /session\.isDemo/);
  assert.match(marketplaceItemRoute, /marketplaceMethodUnavailable\(\)/);
  assert.doesNotMatch(marketplaceItemRoute, /fetch\(|DELETE FROM|store\.items/);
});

test("tenantless administrators must choose one explicit tenant for every marketplace request", () => {
  assert.match(marketplace, /createAdminPageContext\(session, query\.tenant\)/);
  assert.match(workspace, /Empresa autorizada/);
  assert.match(workspace, /href="\/tenants"/);
  assert.match(workspace, /new URLSearchParams\(\{ tenant \}\)/);
  assert.match(workspace, /No se usa un catálogo global como reemplazo/);
  assert.match(marketplaceHelpers, /if \(!tenant\) return deny\("catalog_tenant_required", 400\)/);
});

test("experiences and marketplace surfaces remain UTF-8 without visible mojibake", () => {
  assert.doesNotMatch(experiencesPage + experiencesPanel + marketplace + workspace, /Ã.|Â.|â.|�/u);
});

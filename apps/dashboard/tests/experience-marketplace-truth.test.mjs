import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const experiencesPage = await readFile(new URL("../src/app/(app)/loyalty/experiences/page.tsx", import.meta.url), "utf8");
const adminExperiencesPage = await readFile(new URL("../src/app/(app)/experiences/page.tsx", import.meta.url), "utf8");
const experiencesPanel = await readFile(new URL("../src/components/verified-experiences-panel.tsx", import.meta.url), "utf8");
const marketplace = await readFile(new URL("../src/app/(app)/consumer-network/marketplace/page.tsx", import.meta.url), "utf8");
const marketplaceRoute = await readFile(new URL("../src/app/api/tenant-marketplace/route.ts", import.meta.url), "utf8");

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
  assert.match(marketplaceRoute, /demoMode: true, dataSource: "demo"/);
});

test("experiences and marketplace surfaces remain UTF-8 without visible mojibake", () => {
  assert.doesNotMatch(experiencesPage + experiencesPanel + marketplace, /Ã.|Â.|â.|�/u);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [
  multirubro,
  realtime,
  demoMap,
  loyaltyOverview,
  assetBank,
  batches,
  pilot,
  superadmin,
  opsCenter,
  experiences,
  marketplace,
  settings,
  proof,
  proofComposer,
  tenantDetail,
  homePage,
  customerGrowth,
  dashboardHome,
  demoMobile,
  eventsPage,
  dashboardCopy,
  tokenizationQueue,
  tagsPage,
  tagPassport,
  adminRoute,
  loyaltyExperiences,
  onboardingPage,
  salesPlaybook,
] = await Promise.all([
  read("../src/components/multirubro-ops-panel.tsx"),
  read("../src/components/realtime-ops-monitor.tsx"),
  read("../src/components/demo-ops-map.tsx"),
  read("../src/app/(app)/loyalty/overview/page.tsx"),
  read("../src/components/product-asset-bank-panel.tsx"),
  read("../src/app/(app)/batches/page.tsx"),
  read("../src/components/pilot-launchpad.tsx"),
  read("../src/app/(app)/superadmin-network/page.tsx"),
  read("../src/components/ops-command-center.tsx"),
  read("../src/components/verified-experiences-panel.tsx"),
  read("../src/app/(app)/consumer-network/marketplace/page.tsx"),
  read("../src/app/(app)/settings/page.tsx"),
  read("../src/app/(app)/proof/page.tsx"),
  read("../src/app/(app)/proof/anchor/proof-anchor-composer.tsx"),
  read("../src/app/(app)/tenants/[slug]/page.tsx"),
  read("../src/app/(app)/page.tsx"),
  read("../src/components/customer-growth-command-center.tsx"),
  read("../src/components/dashboard-home-client.tsx"),
  read("../src/app/(app)/demo-lab/mobile/[tenant]/[itemId]/page.tsx"),
  read("../src/app/(app)/events/page.tsx"),
  read("../src/lib/dashboard-content.ts"),
  read("../src/components/tokenization-queue-panel.tsx"),
  read("../src/app/(app)/tags/page.tsx"),
  read("../src/app/(app)/tags/[uid]/page.tsx"),
  read("../src/app/api/admin/[...path]/route.ts"),
  read("../src/app/(app)/loyalty/experiences/page.tsx"),
  read("../src/app/(app)/onboarding/page.tsx"),
  read("../src/app/(app)/sales-playbook/page.tsx"),
]);

test("valid NFC messages are never relabeled as original products or clones", () => {
  assert.match(multirubro, /const validMessages = tapsTotal > 0/);
  assert.match(multirubro, /Mensajes NFC válidos \/ con alerta/);
  assert.match(multirubro, /scans: point\.scans \?\? 0/);
  assert.match(multirubro, /status: \(point\.risk \?\? 0\) > 0 \? "RISK" : "REPORTED"/);
  assert.doesNotMatch(multirubro, /Originales vs Clones|\["Originales"|\["Clones"|"AUTH_OK"/);
  assert.match(demoMap, /Sin alerta reportada/);
  assert.doesNotMatch(demoMap, />\s*Autenticado\s*</);
});

test("runtime rates and visual scores withhold values without a denominator", () => {
  assert.match(realtime, /visibleEvents\.length \? formatPercent\(cleanRate\) : "Sin base"/);
  assert.match(realtime, /GPS reportado/);
  assert.doesNotMatch(realtime, />Confianza<|GPS Real/);

  assert.match(loyaltyOverview, /const consumerReady = Boolean/);
  assert.match(loyaltyOverview, /no se convierten en actividad cero ni en tasas estimadas/);
  assert.match(loyaltyOverview, /metricText\(consumer\.totalActivity, consumerReady\)/);
  assert.match(loyaltyOverview, /rateText\(consumer\.actorLinkedActivityRate, consumerReady\)/);
  assert.doesNotMatch(loyaltyOverview, /tapToRegistrationRate|registrationToMembershipRate/);
  assert.doesNotMatch(loyaltyOverview, />100%<\/span>/);

  assert.match(assetBank, /"Sin score"/);
  assert.doesNotMatch(assetBank, /profile\.assetScore \?\? 0/);
  assert.match(batches, /assetsReady && assetScores\.length/);
  assert.match(pilot, /snapshot\.assetsAvailable && snapshot\.scoredAssetProfiles > 0/);
  assert.match(superadmin, /assetScores\.length \? [`'"]/);
  assert.match(opsCenter, /tenant\.scans > 0 \? `\$\{tenant\.riskScore\}\/100` : "sin base"/);
});

test("experience policy describes digital evidence instead of physical owner or product proof", () => {
  assert.match(experiences, /Replay o señales de riesgo bloquean según policy; no prueba el producto físico/);
  assert.match(experiences, /Titularidad digital confirmada/);
  assert.match(experiences, /Evento NFC registrado/);
  assert.doesNotMatch(experiences, /La persona toca el producto real|Dueño verificado|Tap físico confirmado/);
  assert.match(marketplace, /Ejemplo: titularidad digital confirmada/);
  assert.doesNotMatch(marketplace, /Ejemplo: dueño verificado/);
});

test("Polygon and hash-only proof stay digital and do not assert physical custody", () => {
  assert.match(settings, /Polygon registra derechos digitales declarados; no prueba propiedad ni custodia fisica/);
  assert.match(proof, /Titularidad digital y certificado/);
  assert.match(proof, /No prueba propiedad fisica/);
  assert.match(proof, /ninguna de las dos acredita por si sola propiedad, ubicacion o custodia fisica/);
  assert.match(proofComposer, /Registra evidencia declarada de un cambio de control/);
  assert.match(proofComposer, /no prueba la entrega fisica por si sola/);
  assert.doesNotMatch(proofComposer, /Prueba un cambio de control|Cierra un hito logistico verificable/);
});

test("directory playbooks and operational copy do not invent live tenant evidence", () => {
  assert.match(tenantDetail, /Vista orientativa del directorio: no consulta métricas operativas/);
  assert.match(tenantDetail, /kpis: \{ batches: "—", tags: "—", scans: "—", incidents: "Sin fuente operativa" \}/);
  assert.doesNotMatch(tenantDetail, /240\/30d|680\/30d|1\.2k\/30d|3 clones|1 replay aislado/);

  assert.match(homePage, /no certifica el producto físico/);
  assert.match(opsCenter, /Los eventos aportan evidencia digital; no certifican el producto físico/);
  assert.match(customerGrowth, /No autentica el producto físico/);
  assert.match(dashboardHome, /no representa autenticidad física/);
  assert.match(demoMobile, /no prueba recorrido, contenido ni apertura física/);
});

test("events and dashboard descriptions describe NFC evidence instead of physical authenticity", () => {
  assert.match(eventsPage, /eventos reportados y alertas derivadas de la validación NFC/);
  assert.match(eventsPage, /evidencia técnica por evento/);
  assert.doesNotMatch(eventsPage, /actividad real y alertas de autenticidad|evidencia real por tap|revisar autenticaciones/);
  assert.match(dashboardCopy, /KPIs críticos de validación de mensajes NFC/);
  assert.match(dashboardCopy, /standardizes digital evidence for NFC events/);
  assert.doesNotMatch(dashboardCopy, /Critical authentication|democratizes product authentication|democratiza la autenticación física/);
});

test("maps expose source and stream state while treating geography as reported", () => {
  assert.match(multirubro, /Fuente \$\{demoDataMode \? "demo" : "API operativa"\} · stream \$\{streamState\}/);
  assert.match(multirubro, /no prueba una ruta física/);
  assert.doesNotMatch(multirubro, /Heatmap de taps en tiempo real|hubs activos|Emular tap fisico/);
});

test("tag views and tokenization preserve digital and reported-evidence boundaries", () => {
  assert.match(tokenizationQueue, /Mensaje NFC válido según política/);
  assert.match(tokenizationQueue, /Polygon registra el certificado digital/);
  assert.match(tokenizationQueue, /Las transferencias quedan como solicitud hasta incorporar executor, recibo y verificación ownerOf/);
  assert.match(tokenizationQueue, /no acredita propiedad física/);
  assert.doesNotMatch(tokenizationQueue, /Tap válido, tenant|Polygon registra ownership/);

  assert.match(tagsPage, /trazabilidad digital de eventos por unidad; no prueba recorrido ni estado físico/);
  assert.match(tagsPage, /Última ubicación reportada/);
  assert.doesNotMatch(tagsPage, /Registry real por UID|verificación real|trazabilidad física/);
  assert.match(tagPassport, /Las ubicaciones provienen del evento o dispositivo reportante/);
  assert.match(tagPassport, /Primer evento reportado/);
  assert.match(tagPassport, /Último evento reportado/);
  assert.doesNotMatch(tagPassport, />First verified:|>Last verified:|Verification timeline/);

  assert.match(adminRoute, /source: "demo"/);
  assert.doesNotMatch(adminRoute, /source: "real",\s*\n\s*location: \{ city: "Buenos Aires"/);
});

test("realtime, growth and onboarding copy require source-backed NFC events", () => {
  assert.match(realtime, /CRM de eventos NFC/);
  assert.match(realtime, /mapa de ubicaciones reportadas/);
  assert.match(realtime, /ACTIVIDAD RECIENTE/);
  assert.doesNotMatch(realtime, /Lecturas reales|Esperando lecturas reales|ACTIVIDAD EN VIVO|CRM en vivo/);

  assert.match(customerGrowth, /Producto reconocido/);
  assert.match(customerGrowth, /Un UID identifica producto; nunca una persona/);
  assert.match(customerGrowth, /membresía activa y consentimiento vigente para el canal/);
  assert.match(customerGrowth, /Indicadores independientes/);
  assert.doesNotMatch(customerGrowth, /UIDs con eventos reportados|segmento para evaluar club|UIDs con evidencia real|tap físico listos/);

  assert.match(loyaltyExperiences, /Mensaje NFC fresco con veredicto válido/);
  assert.match(onboardingPage, /recorrido operativo con fuente visible/);
  assert.match(salesPlaybook, /mensaje criptográfico NFC fresco/);
  assert.doesNotMatch(`${loyaltyExperiences}\n${salesPlaybook}`, /Tap físico fresco|tap físico fresco/);
});

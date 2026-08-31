import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [page, telemetry, tapLocationModel, locationExperience, passportMap, consumerStatus, sectionNav, actions] = await Promise.all([
  readFile(new URL("../src/app/sun/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/sun/tap-precision-telemetry.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/sun/tap-location-model.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/app/sun/sun-location-experience.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/sun/sun-passport-map.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/sun/sun-consumer-status.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/app/sun/sun-section-nav.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/sun/cta-actions.tsx", import.meta.url), "utf8"),
]);

test("the first mobile viewport is product-first and keeps the official image eager", () => {
  assert.match(page, /data-testid="sun-summary-product"/);
  assert.match(page, /sun-summary-product grid grid-cols-\[92px_minmax\(0,1fr\)\]/);
  assert.match(page, /sun-summary-product__visual relative h-28/);
  assert.match(page, /fetchPriority="high"/);
  assert.match(page, /data-testid="sun-summary-status"/);
  assert.match(page, /data-testid="sun-summary-facts"/);
  assert.match(page, /Perfil oficial del piloto/);
});

test("consumer copy leads with the decision while preserving the physical boundary", () => {
  assert.match(consumerStatus, /El tag informa: sello cerrado/);
  assert.match(consumerStatus, /El tag informa: sello abierto/);
  assert.match(consumerStatus, /Si vos no lo abriste o ves daños, no uses el producto y avisá a la marca/);
  assert.match(consumerStatus, /Esto no certifica por sí solo el contenido ni una inspección física del envase/);
  assert.match(page, /Este resultado corresponde a la etiqueta digital\. No confirma por sí solo la autenticidad ni el estado del producto físico/);
  assert.match(page, /La apertura fue declarada por un operador; no fue detectada automáticamente por la etiqueta digital/);
});

test("opened or manually declared states expose a report path and keep protected actions gated", () => {
  assert.match(page, /const isOpenedAttentionState = isVerifiedOpenedState \|\| isManualOpenedState/);
  assert.match(page, /const isRiskBlocked =[\s\S]*?isInvalidSealState/);
  assert.match(page, /\? \{ label: "Avisar a la marca", href: reportProblemHref, tone: "risk" \}/);
  assert.match(actions, /const isManualOpenedConsumerFlow = tapState === "manual_opened"/);
  assert.match(actions, /const isOpenedConsumerFlow = isSensorOpenedConsumerFlow \|\| isManualOpenedConsumerFlow/);
  assert.match(actions, /const commercialActionsAllowed = canExecute && !isManualOpenedConsumerFlow/);
  assert.match(actions, /const showReportFlow = isOpenedConsumerFlow \|\| tapState === "blocked"/);
  assert.match(actions, /Enviar aviso para revisión/);
});

test("phone location is explicit, low-precision and sends only the minimal browser context", () => {
  assert.match(page, /const telemetryEndpoint = "\/api\/sun-context"/);
  assert.match(telemetry, /function shareApproximateLocation\(\)/);
  assert.match(telemetry, /requestApproximateBrowserLocation\(navigator\.geolocation, locationRequestedAtMs\)/);
  assert.match(tapLocationModel, /geolocation\.getCurrentPosition/);
  assert.match(tapLocationModel, /enableHighAccuracy: false/);
  assert.match(tapLocationModel, /timeout: 12_000/);
  assert.match(tapLocationModel, /maximumAge: 0/);
  assert.match(tapLocationModel, /APPROXIMATE_ACCURACY_FLOOR_M/);
  assert.match(telemetry, /geoConsent: true/);
  assert.match(telemetry, /geoPrecision: "approximate"/);
  assert.match(telemetry, /Agregar zona al pasaporte/);
  assert.match(telemetry, /client: clientContext\(\)/);
  assert.match(telemetry, /timezone: Intl\.DateTimeFormat/);
  assert.doesNotMatch(telemetry, /getHighEntropyValues|userAgent|deviceMemory|hardwareConcurrency|screen:\s*\{|languages:\s*/);
});

test("the location capability stays event-bound and a denial never blocks the passport", () => {
  assert.match(telemetry, /`nexid:tap-context:\$\{bid\}:\$\{eventId \|\| "unknown"\}:\$\{readCounter \?\? "latest"\}`/);
  assert.match(telemetry, /Boolean\(endpoint && bid && eventId && freshToken\)/);
  assert.match(telemetry, /Number\.isSafeInteger\(readCounter\)/);
  assert.match(telemetry, /window\.sessionStorage\.setItem\(storageKey, JSON\.stringify\(\{ status: "sent", receipt: nextReceipt \}\)\)/);
  assert.doesNotMatch(telemetry, /sessionStorage\.setItem\([^\n]*freshToken|capabilityStorageKey|window\.location\.replace/);
  assert.match(telemetry, /El permiso fue denegado[\s\S]*?el pasaporte sigue funcionando sin ubicación/);
  assert.match(telemetry, /La validación SUN no cambió; hacé un nuevo tap físico para volver a intentarlo/);
});

test("real SUN maps keep IP separate and make third-party cartography opt-in", () => {
  assert.match(page, /browser_geolocation_approximate_consent/);
  assert.match(page, /browser_gps_approximate_consent/);
  assert.match(page, /rawLocationSource === "ip_geo" \|\| rawLocationSource === "edge_ip_approx"/);
  assert.match(locationExperience, /const effectiveTap = confirmedTap \|\| tap/);
  assert.match(locationExperience, /externalTiles=\{showRoute\}/);
  assert.match(passportMap, /externalTiles \? mapStyleForTheme\(isLightTheme\(\)\) : localCoordinateStyle\(isLightTheme\(\)\)/);
  assert.match(passportMap, /data-external-tiles=\{externalTiles \? "enabled" : "disabled"\}/);
  assert.match(passportMap, /Vista local sin solicitudes automáticas a proveedores de mapas externos/);
  assert.match(passportMap, /Abrir mapa ↗/);
});

test("mobile navigation uses four unique product sections and keeps engagement progressive", () => {
  assert.match(sectionNav, /grid grid-cols-4/);
  for (const label of ["Resumen", "Origen", "Estado", "Servicios"]) assert.match(sectionNav, new RegExp(`label: "${label}"`));
  assert.doesNotMatch(sectionNav, /label: "Ruta"/);
  assert.match(page, /showEngagementSuite \? \(/);
  assert.match(page, /id="qr-engagement"/);
});

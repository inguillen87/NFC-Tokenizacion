import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [page, telemetry, cleaner, nextStep, actions, styles] = await Promise.all([
  readFile(new URL("../src/app/sun/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/sun/tap-precision-telemetry.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/sun/fresh-handoff-url-cleaner.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/sun/post-tap-next-step.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/sun/cta-actions.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
]);

test("the physical product image is a primary mobile visual, not a thumbnail", () => {
  assert.match(page, /className="sun-result-card__media"/);
  assert.match(styles, /\.sun-result-card__product\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /\.sun-result-card__media\s*\{[\s\S]*?min-height: 15rem/);
  assert.match(styles, /\.sun-result-card__media img\s*\{[\s\S]*?height: 15rem/);
  assert.match(page, /fetchPriority="high"/);
  assert.match(styles, /html:is\(\.theme-light, \[data-theme="light"\]\) \.sun-result-card__media/);
});

test("consumer seal copy leads with the decision a non-technical buyer needs", () => {
  assert.match(page, /El sello no registra aperturas/);
  assert.match(page, /El sello registra una apertura/);
  assert.match(page, /Si vos no lo abriste o el envase está dañado, no uses el producto y avisá a la marca/);
  assert.match(page, /Ver garantía y beneficios/);
  assert.match(page, /Avisar a la marca/);
  assert.match(page, /Lectura digital confirmada/);
  assert.match(page, /Atención recomendada/);
  assert.match(page, /No confirma por sí solo la autenticidad ni el estado del producto físico/);
  assert.doesNotMatch(page, /La etiqueta digital respondió correctamente/);
  assert.doesNotMatch(page, /Cerrado, según la etiqueta|Abierto, según la etiqueta/);
});

test("opened seal gets a safety-first ticket path while loyalty remains progressive", () => {
  assert.match(page, /const isOpenedAttentionState = isVerifiedOpenedState \|\| isManualOpenedState/);
  assert.match(page, /const showEngagementSuite = engagementBaseEligible && isWineProduct && !isOpenedAttentionState/);
  const eligibilityStart = page.indexOf("const engagementBaseEligible =");
  const eligibilityEnd = page.indexOf("const troubleshooting =", eligibilityStart);
  const eligibilitySource = page.slice(eligibilityStart, eligibilityEnd);
  assert.match(eligibilitySource, /isVerifiedOpenedState/);
  assert.match(eligibilitySource, /!isManualOpenedState/);
  assert.doesNotMatch(eligibilitySource, /isOpenedAttentionState/);
  assert.match(page, /const isRiskBlocked =[^\n]*isManualOpenedState/);
  assert.match(page, /sealState=\{isVerifiedOpenedState \? "opened"/);
  assert.match(page, /reportProblemHref = bid && \(uid \|\| eventId\)[\s\S]*"#report-action"/);
  assert.match(nextStep, /sealState\?: "closed" \| "opened" \| "unknown"/);
  assert.match(nextStep, /¿Abriste vos el sello\?/);
  assert.match(nextStep, /No lo abrí: avisar a la marca/);
  assert.match(nextStep, /Más opciones de la marca/);
  assert.match(actions, /id="report-action"/);
  assert.match(actions, /const isManualOpenedConsumerFlow = tapState === "manual_opened"/);
  assert.match(actions, /const isSensorOpenedConsumerFlow = tapState === "opened"/);
  assert.match(actions, /const isOpenedConsumerFlow = isSensorOpenedConsumerFlow \|\| isManualOpenedConsumerFlow/);
  assert.match(actions, /const commercialActionsAllowed = canExecute && !isManualOpenedConsumerFlow/);
  assert.match(actions, /const canStartClaim = commercialActionsAllowed && policyAllowsAction\("claimOwnership"\)/);
  assert.match(actions, /!commercialActionsAllowed && SECURITY_GATED_ACTIONS\.has\(actionKey\)/);
  assert.match(actions, /const showReportFlow = isOpenedConsumerFlow \|\| tapState === "blocked"/);
  assert.match(actions, /Enviar aviso para revisión/);
  assert.match(actions, /category: isOpenedConsumerFlow \? "seal_opened" : "tap_review"/);
  assert.match(actions, /Quedó asignado al equipo de la marca para revisar esta lectura/);
  assert.match(page, /const isManualOpenedState/);
  assert.match(page, /tapState=\{isManualOpenedState \? "manual_opened"/);
  assert.match(actions, /isManualOpenedConsumerFlow \? "Apertura declarada"/);
  assert.match(actions, /La etiqueta digital no la detectó automáticamente/);
  assert.match(page, /La apertura fue declarada por un operador; no fue detectada automáticamente por la etiqueta digital/);
});

test("phone location uses the hardened same-origin proxy and a fresh high-accuracy request", () => {
  assert.match(page, /const telemetryEndpoint = "\/api\/sun-context"/);
  assert.doesNotMatch(page, /resolvedApiBase[^\n]*\/sun\/context/);
  assert.match(telemetry, /enableHighAccuracy: true/);
  assert.match(telemetry, /maximumAge: 0/);
  assert.match(telemetry, /timeout: 15000/);
  assert.match(telemetry, /roundApproximateCoordinate\(position\.coords\.latitude\)/);
  assert.match(telemetry, /APPROXIMATE_ACCURACY_FLOOR_M/);
  assert.match(telemetry, /Compartir zona y contexto/);
});

test("a fresh physical handoff opens explicit consent once and never prompts a stale snapshot", () => {
  assert.match(telemetry, /AUTO_LOCATION_PROMPT_VERSION = "v2"/);
  assert.match(telemetry, /nexid:tap-location-prompt:\$\{AUTO_LOCATION_PROMPT_VERSION\}:\$\{eventId \|\| "unknown"\}/);
  assert.match(telemetry, /autoPromptAttemptedRef/);
  assert.match(telemetry, /state !== "idle" \|\| !enabled \|\| !eventId \|\| !capabilityToken/);
  assert.match(telemetry, /freshTokenExpiryMs\(capabilityToken\)/);
  assert.match(telemetry, /window\.sessionStorage\.getItem\(storageKey\) \|\| window\.sessionStorage\.getItem\(promptStorageKey\)/);
  assert.match(telemetry, /setConsentOpen\(true\)/);
  assert.match(telemetry, /Permitir zona y contexto/);
  assert.match(telemetry, /extendedContextConsent: true/);
  assert.match(telemetry, /acceptContextConsent/);
  assert.match(telemetry, /declineContextConsent/);
});

test("consented SUN context reports only browser-observed device and connection facts", () => {
  assert.match(telemetry, /getHighEntropyValues/);
  for (const hint of ["architecture", "bitness", "model", "platformVersion"]) {
    assert.match(telemetry, new RegExp(`"${hint}"`));
  }
  assert.match(telemetry, /const model = cleanText\(highEntropy\.model\)/);
  assert.match(telemetry, /modelSource: model \? "ua_ch_high_entropy" : null/);
  assert.match(telemetry, /deviceType: inferDeviceType/);
  assert.match(telemetry, /os: inferDeviceOs/);
  assert.match(telemetry, /languages: Array\.isArray\(nav\.languages\)/);
  assert.match(telemetry, /timezone: Intl\.DateTimeFormat/);
  assert.match(telemetry, /screen: \{/);
  assert.match(telemetry, /hardware: \{/);
  assert.match(telemetry, /memoryGb: Number\.isFinite\(nav\.deviceMemory\)/);
  assert.match(telemetry, /logicalProcessors: Number\.isFinite\(nav\.hardwareConcurrency\)/);
  assert.match(telemetry, /effectiveType: cleanText\(connection\.effectiveType\)/);
  assert.match(telemetry, /downlinkMbps: Number\.isFinite\(connection\.downlink\)/);
  assert.match(telemetry, /rttMs: Number\.isFinite\(connection\.rtt\)/);
  assert.match(telemetry, /saveData: connection\.saveData === true/);
  assert.match(telemetry, /Nothing is sent if the person denies that native permission/);
  assert.match(telemetry, /A denial is local-only: no device or network profile is transmitted/);
});

test("phone location retry retains only the short event-bound capability in this tab", () => {
  assert.match(telemetry, /nexid:tap-context-capability:/);
  assert.match(telemetry, /window\.sessionStorage\.setItem\(capabilityStorageKey, candidate\)/);
  assert.match(telemetry, /freshTokenExpiryMs/);
  assert.match(telemetry, /window\.location\.replace/);
  assert.match(telemetry, /Hace falta un toque nuevo para actualizar la zona/);
  assert.match(cleaner, /fresh-secured/);
  assert.doesNotMatch(cleaner, /fresh-consumed/);
});

test("public mobile map never presents IP as the phone position", () => {
  assert.match(page, /rawLocationSource === "browser_gps_approximate_consent"/);
  assert.match(page, /resolveSunCurrentTapPlace/);
  assert.match(page, /CONSENTED_BROWSER_LOCATION_FALLBACK/);
  assert.match(page, /consumerCurrentTapMapPoints/);
  assert.match(page, /chrome=\{isDemoPreview \? "full" : "consumer"\}/);
  assert.match(page, /No usamos la ubicación por IP como si fuera la del teléfono/);
  assert.match(page, /no dibujamos una estimación por IP como si fuera tu ubicación/i);
  assert.doesNotMatch(page, /Floating sommelier trigger|fixed bottom-6 right-6/);
});

test("mobile navigation has three unique destinations and engagement is progressive", () => {
  assert.match(page, /grid grid-cols-3/);
  assert.match(page, />Producto<\/span>/);
  assert.match(page, /\{isOpenedAttentionState \? "Avisar" : "Acciones"\}/);
  assert.match(page, />Evidencia<\/span>/);
  assert.doesNotMatch(page, />Ruta<\/span>/);
  assert.match(page, /<details id="qr-engagement"/);
});

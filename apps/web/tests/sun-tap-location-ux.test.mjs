import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const [page, telemetry, locationExperience] = await Promise.all([
  readFile(new URL("../src/app/sun/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/sun/tap-precision-telemetry.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/sun/sun-location-experience.tsx", import.meta.url), "utf8"),
]);

test("complete dynamic SUN payload reaches the API from the browser, not an SSR BFF", () => {
  const completePayload = page.indexOf("const hasCompleteDynamicSunPayload");
  const browserRedirect = page.indexOf("redirect(`${resolvedApiBase}/sun?${query.toString()}`)", completePayload);
  const serverFetch = page.indexOf("await fetch(`${resolvedApiBase}/sun?${query.toString()}`", completePayload);

  assert.notEqual(completePayload, -1);
  assert.notEqual(browserRedirect, -1);
  assert.notEqual(serverFetch, -1);
  assert.ok(browserRedirect < serverFetch);
  assert.match(page, /\["bid", "picc_data", "enc", "cmac"\]/);
  assert.match(page, /const localOverrideEnabled = process\.env\.NODE_ENV === "development" && !process\.env\.VERCEL_ENV/);
  assert.match(page, /if \(override && localOverrideEnabled\)/);
});

test("GPS confirmation is opt-in, rounded and labelled as occurring after the tap", () => {
  assert.match(page, /const telemetryEndpoint = "\/api\/sun-context"/);
  assert.doesNotMatch(page, /telemetryEndpoint = `\$\{resolvedApiBase[^\n]+\/sun\/context/);
  assert.match(page, /const canRequestBrowserLocation = !isQrScan/);
  assert.match(page, /&& Boolean\(eventId && freshToken\)/);
  assert.match(page, /enabled: canRequestBrowserLocation/);
  assert.match(telemetry, /onClick=\{shareApproximateLocation\}/);
  assert.match(telemetry, /roundApproximateCoordinate\(position\.coords\.latitude\)/);
  assert.match(telemetry, /maximumAge: 0/);
  assert.match(telemetry, /locationMeasuredAtMs < locationRequestedAtMs/);
  assert.match(telemetry, /measuredAt: new Date\(locationMeasuredAtMs\)/);
  assert.match(telemetry, /Ubicación opcional guardada/);
  assert.match(telemetry, /Compartir ubicación aproximada/);
  assert.match(telemetry, /La ciudad estimada por la red puede ser incorrecta/);
  assert.match(telemetry, /nextReceipt\?\.source !== "browser_gps_approximate_consent"/);
  assert.match(telemetry, /position\.coords\.accuracy > 50_000/);
  assert.match(telemetry, /no es una coordenada emitida por el NFC ni prueba el instante RF exacto/);
  assert.match(telemetry, /tapReceivedAt/);
  assert.match(telemetry, /receivedAt/);
  assert.doesNotMatch(telemetry, /ubicación exacta al momento del tap/i);
});

test("telemetry resets per tap and only adds timezone as browser context", () => {
  const effectStart = telemetry.indexOf("useEffect(() => {");
  const storageRead = telemetry.indexOf("window.sessionStorage.getItem(storageKey)", effectStart);
  const resetState = telemetry.indexOf('setState("idle")', effectStart);
  const resetReceipt = telemetry.indexOf("setReceipt(null)", effectStart);
  const contextStart = telemetry.indexOf("function clientContext()");
  const contextEnd = telemetry.indexOf("export function TapPrecisionTelemetry", contextStart);
  const context = telemetry.slice(contextStart, contextEnd);

  assert.notEqual(effectStart, -1);
  assert.ok(resetState < storageRead);
  assert.ok(resetReceipt < storageRead);
  assert.match(context, /timezone:/);
  assert.doesNotMatch(context, /language:|languages:|platform:|userAgent:|mobile:|viewport:|pixelRatio:/);
  assert.match(telemetry, /agrega sólo la zona horaria/);
  assert.match(telemetry, /no agrega idioma, user-agent, plataforma ni tamaño de pantalla/);
});

test("GPS permission never auto-opens a blocking sheet over the product", () => {
  assert.doesNotMatch(telemetry, /consentOpen|setConsentOpen|autoPromptAttemptedRef/);
  assert.doesNotMatch(telemetry, /role="dialog"|fixed inset-0|Permitir zona y contexto/);
  assert.match(telemetry, /<button[\s\S]*?onClick=\{shareApproximateLocation\}/);
});

test("successful confirmation updates the map locally without consuming the fresh handoff", () => {
  assert.match(telemetry, /setReceipt\(nextReceipt\)/);
  assert.match(telemetry, /onLocationConfirmed\?\.\(nextReceipt\)/);
  assert.doesNotMatch(telemetry, /router\.refresh\(\)|useRouter/);
  assert.match(locationExperience, /const effectiveTap = confirmedTap \|\| tap/);
  assert.match(locationExperience, /distanceLabelFor\(distanceKm\(origin, confirmedTap\)\)/);
  assert.match(locationExperience, /source: "browser_gps_approximate_consent"/);
  assert.match(telemetry, /Abrir zona aproximada/);
  assert.match(telemetry, /actualizó el evento sin repetir el tap/);
});

test("SUN summary exposes truthful location evidence before the origin map", () => {
  const summaryStart = page.indexOf('id="sun-summary"');
  const summaryEnd = page.indexOf('</section>', summaryStart);
  const originStart = page.indexOf('id="sun-origin"');
  const summary = page.slice(summaryStart, summaryEnd);

  assert.notEqual(summaryStart, -1);
  assert.notEqual(summaryEnd, -1);
  assert.ok(summaryStart < originStart);
  assert.match(page, /const summaryLocationLabel = isDemoPreview[\s\S]*?"Zona aproximada confirmada"[\s\S]*?"Zona de red · no es GPS"[\s\S]*?"Ubicación de esta lectura"/);
  assert.match(page, /const summaryLocationDisplay = hasCurrentTapCoords \? tapDisplay : "Sin ubicación registrada"/);
  assert.match(summary, /!isDemoPreview && isVerifiedOpenedState && isTechnicallyAuthentic[\s\S]*?\? "#sun-condition"/);
  assert.match(summary, /Fuente \/ precisión/);
  assert.match(summary, /Hora del tap/);
  assert.match(summary, /canRequestBrowserLocation && !hasConfirmedBrowserLocation/);
  assert.match(summary, /data-testid="sun-location-consent-cta"/);
  assert.match(summary, /Compartir ubicación aproximada del teléfono/);
  assert.match(page, /No es tu posición:[\s\S]*?puede ubicarte en otra ciudad/);
  assert.match(summary, /Este resultado corresponde únicamente a este tag y esta lectura/);
});

test("a historical location is never relabelled as the current tap", () => {
  const tapDisplayStart = page.indexOf("const tapDisplay =");
  const tapDisplayEnd = page.indexOf("const rawLocationSource", tapDisplayStart);
  const projection = page.slice(tapDisplayStart, tapDisplayEnd);

  assert.match(projection, /"Tap actual no geolocalizado"/);
  assert.doesNotMatch(projection, /lastVerifiedLocation|timelineSummary/);
});

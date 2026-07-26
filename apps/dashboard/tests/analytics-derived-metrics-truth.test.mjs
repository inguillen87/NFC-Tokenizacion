import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const analytics = await readFile(new URL("../src/components/analytics-panels.tsx", import.meta.url), "utf8");
const i18n = await readFile(new URL("../../../packages/config/src/i18n.ts", import.meta.url), "utf8");
const dashboardContent = await readFile(new URL("../src/lib/dashboard-content.ts", import.meta.url), "utf8");
const multirubro = await readFile(new URL("../src/components/multirubro-ops-panel.tsx", import.meta.url), "utf8");

test("analytics never fabricates lifecycle conversions from journeys or fixed coefficients", () => {
  assert.match(analytics, /Mensajes NFC válidos \(derivado\)/);
  assert.match(analytics, /Claim, garantía y marketplace quedan N\/D/);
  assert.doesNotMatch(analytics, /claims \* 0\.35|claims \* 0\.2|stage: "Warranty"|stage: "Marketplace"/);
});

test("gamification projections expose their assumptions and simulation status", () => {
  assert.match(analytics, /const baseClaimRate = 0\.14/);
  assert.match(analytics, /const boostedClaimRate = 0\.22/);
  assert.match(analytics, /Claims simulados/);
  assert.match(analytics, /No son conversiones observadas ni una audiencia contactable/);
});

test("analytics withholds missing rates and does not infer map risk from tap volume", () => {
  assert.match(analytics, /validRate == null \? "N\/D"/);
  assert.match(analytics, /verdict: "REPORTED"/);
  assert.doesNotMatch(analytics, /item\.taps > 20 \? 0 : 1/);
  assert.match(analytics, /el conector visual no representa un recorrido físico/);
  assert.match(analytics, /playbackEnabled=\{false\}/);
  assert.doesNotMatch(analytics, /Origen del producto, tap actual, distancia y ruta punteada/);
});

test("analytics labels explicit INVALID separately from replay, tamper and unknown", () => {
  assert.match(analytics, /Tasa de resultados INVALID explicitos/);
  assert.doesNotMatch(analytics, /Tasa de mensajes sospechosos/);
  assert.match(i18n, /Clases independientes; pueden no sumar 100%/);
});

test("journey connectors require a declared product-passport origin", () => {
  assert.match(analytics, /isDeclaredProductOrigin\(item\.originSource\) && item\.origin\.lat/);
  assert.match(analytics, /first_observed_event/);
  assert.match(analytics, /sin distancia logistica/);
  assert.match(analytics, /antes \/ despues; sin ruta/);
});

test("dashboard copy does not ship fixed deltas as live operational facts", () => {
  const copy = `${i18n}\n${dashboardContent}`;
  assert.doesNotMatch(copy, /\+12\.4%|98\.8% \/ 1\.2%|-8\.3%|\+4 incidentes|\+4 incidents|\+4 esta semana|\+4 nesta semana|\+4 this week|\+2 onboarding/);
  assert.match(copy, /Comparativo N\/D/);
  assert.match(copy, /Comparison N\/A/);
});

test("dashboard heatmap preserves an explicitly reported zero scan count", () => {
  assert.match(multirubro, /scans: point\.scans \?\? 0/);
  assert.doesNotMatch(multirubro, /scans: point\.scans \|\| 1/);
});

test("reseller MRR is withheld until an explicit billing source reports it", () => {
  assert.match(analytics, /billingConfirmed = billingAmount !== null && Boolean\(billingSource\)/);
  assert.match(analytics, /resellerRevenueDisplay = billingConfirmed/);
  assert.match(dashboardContent, /requiere fuente billing/);
  assert.doesNotMatch(analytics, /USD \$\{\(api\.resellerPerformance \?\? 0\)/);
});

test("live verdicts and map precision stay in separate evidence buckets", () => {
  assert.match(multirubro, /type EventVerdictBucket = "valid" \| "duplicate_replay" \| "tamper" \| "invalid" \| "unknown"/);
  assert.match(multirubro, /verdictBucket === "duplicate_replay"/);
  assert.match(multirubro, /verdictBucket === "invalid"/);
  assert.match(multirubro, /verdictBucket === "unknown"/);
  assert.doesNotMatch(multirubro, /const isInvalidLike = !isValid/);
  assert.match(multirubro, /City centroid e IP son aproximados/);
  assert.match(multirubro, /locationAccuracyM/);
  assert.match(multirubro, /locationFilter === "all"/);
  assert.match(multirubro, /source\.includes\("gps"\)/);
  assert.match(multirubro, /GPS reportado por cliente; no verificacion independiente/);
  assert.match(multirubro, /const isRisk = \["duplicate_replay", "tamper", "invalid"\]\.includes\(verdictBucket\)/);
  assert.doesNotMatch(multirubro, /const isRisk = verdictBucket !== "valid"/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [globalMap, premiumMap, realMap] = await Promise.all([
  readFile(new URL("../../../packages/ui/src/global-ops-map.tsx", import.meta.url), "utf8"),
  readFile(new URL("../../../packages/ui/src/premium-vector-map.tsx", import.meta.url), "utf8"),
  readFile(new URL("../../../packages/ui/src/real-geographic-map.tsx", import.meta.url), "utf8"),
]);

test("consumer map fails closed unless the phone shared an approximate location with consent", () => {
  assert.match(globalMap, /chrome\?: "full" \| "compact" \| "consumer"/);
  assert.match(globalMap, /CONSENTED_CONSUMER_LOCATION_SOURCES = new Set/);
  assert.match(globalMap, /"browser_geolocation_approximate_consent"/);
  assert.match(globalMap, /"browser_gps_approximate_consent"/);
  assert.match(globalMap, /CONSENTED_CONSUMER_LOCATION_SOURCES\.has\(String\(point\.locationSource/);
  assert.match(globalMap, /\.filter\(isConsentedConsumerLocation\)[\s\S]*?\.slice\(0, 1\)/);
  assert.match(realMap, /if \(consumerChrome\) return points\.filter\(isConsentedConsumerPoint\)\.slice\(0, 1\)/);
  assert.match(realMap, /No mostramos un punto por red o IP/);
  assert.doesNotMatch(globalMap, /edge_ip_approx|ip_geo/);
});

test("consumer map renders one compact MapLibre point without operational routes or heat", () => {
  assert.match(premiumMap, /"enterprise-atlas" \| "consumer"/);
  assert.match(globalMap, /routes=\{isConsumerChrome \? \[\] : vectorRoutes\}/);
  assert.match(globalMap, /density=\{isConsumerChrome \? "route"/);
  assert.match(globalMap, /chrome=\{isConsumerChrome \? "consumer"/);
  assert.match(globalMap, /maxPoints=\{isConsumerChrome \? 1/);
  assert.match(globalMap, /maxRoutes=\{isConsumerChrome \? 0/);
  assert.match(globalMap, /h-\[18rem\] sm:h-\[20rem\]/);
  assert.match(realMap, /const visibleRoutes = useMemo\(\(\) => consumerChrome \? \[\]/);
  assert.match(realMap, /if \(consumerChrome\) \{[\s\S]*?nexid-consumer-accuracy-fill[\s\S]*?return;/);
  assert.match(realMap, /data-nexid-map="maplibre-gl"/);
  assert.match(realMap, /loaded && !mapError && !consumerChrome/);
  assert.match(realMap, /!consumerChrome && \(caption \|\| evidenceSteps\.length \|\| ledgerItems\.length\)/);
});

test("consumer uncertainty is a privacy-aware radius, not an exact-looking pin", () => {
  assert.match(premiumMap, /locationAccuracyM\?: number/);
  assert.match(globalMap, /locationAccuracyM: point\.locationAccuracyM \?\? point\.accuracyM \?\? undefined/);
  assert.match(realMap, /Math\.min\(50_000, Math\.max\(150, value\)\)/);
  assert.match(realMap, /function geodesicCircle/);
  assert.match(realMap, /type: "Polygon"/);
  assert.match(realMap, /nexid-consumer-accuracy-line/);
  assert.match(realMap, /consumerAccuracyCoordinates\.forEach\(\(coordinate\) => bounds\.extend\(coordinate\)\)/);
  assert.match(realMap, /map\.fitBounds\(bounds, \{ padding: 52, maxZoom: 14/);
  assert.match(realMap, /Zona aproximada autorizada/);
  assert.match(realMap, /data-consumer-location=\{consumerChrome \? "consented-approximate" : undefined\}/);
});

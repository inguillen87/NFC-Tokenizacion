import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  describeTraceabilityMapTruth,
  resolveTraceabilityMapTruth,
} from "../src/lib/traceability-map-truth.ts";

const globe = await readFile(new URL("../src/components/premium-traceability-globe.tsx", import.meta.url), "utf8");
const landing = await readFile(new URL("../src/components/landing-sections.tsx", import.meta.url), "utf8");
const hero = await readFile(new URL("../src/components/hero-scene.tsx", import.meta.url), "utf8");
const truthContract = await readFile(new URL("../src/lib/traceability-map-truth.ts", import.meta.url), "utf8");
const globalOpsMap = await readFile(new URL("../../../packages/ui/src/global-ops-map.tsx", import.meta.url), "utf8");
const globe3dMap = await readFile(new URL("../../../packages/ui/src/globe-3d-map.tsx", import.meta.url), "utf8");

test("public globe fails closed for degraded, empty and unverified public feeds", () => {
  assert.equal(resolveTraceabilityMapTruth(null), "unavailable");
  assert.equal(resolveTraceabilityMapTruth({ degraded: true, source: "public-proof", events: [{}], evidenceVerified: true, evidenceUrl: "https://example.test/tx" }), "fixture");
  assert.equal(resolveTraceabilityMapTruth({ degraded: false, source: "public-proof", events: [] }), "unavailable");
  assert.equal(resolveTraceabilityMapTruth({ degraded: false, source: "public-proof", events: [{}], evidenceVerified: false, evidenceUrl: null }), "recorded_events");
});

test("public globe reserves verified language for confirmed HTTPS public evidence", () => {
  const state = resolveTraceabilityMapTruth({
    degraded: false,
    source: "public-proof",
    events: [{}],
    evidenceVerified: true,
    evidenceUrl: "https://explorer.example/tx/0xabc",
  });
  assert.equal(state, "public_evidence");
  assert.match(describeTraceabilityMapTruth(state).sourceLabel, /verificada/);
  assert.doesNotMatch(describeTraceabilityMapTruth("fixture").sourceLabel, /verificada|auditada/);
});

test("public globe and landing remove fixed confidence and live fixture claims", () => {
  assert.match(globe, /describeTraceabilityMapTruth\(truthState\)/);
  assert.match(truthContract, /Datos simulados · no auditados/);
  assert.match(landing, /Nodos simulados; no es telemetría en vivo/);
  assert.doesNotMatch(globe, /98\.7%|Ruta comercial auditada|Tap verificado|Origen verificado/);
  assert.doesNotMatch(landing, /Live Network|Red en vivo|rutas comerciales en vivo/);
});

test("public globe fails closed when no observed geographic feed is available", () => {
  assert.match(globe, /data-geographic-truth=\{truthState\}/);
  assert.match(globe, /data-geographic-renderer=\{hasObservedGeography \? "maplibre-gl" : "none"\}/);
  assert.match(globe, /No se dibujan ubicaciones, rutas ni calor sin coordenadas observadas y una fuente declarada/);
  assert.match(globe, /El mapa queda cerrado hasta recibir coordenadas válidas y con fuente/);
  assert.match(globe, /No usamos puntos, rutas, continentes ni zonas de calor de ejemplo como si fueran telemetría/);
  assert.match(globe, /<PremiumVectorMap/);
  assert.match(globe, /hasObservedGeography \? \(/);
  assert.match(globe, /data-caller-geography=\{callerScenarioIgnored \? "unverified-ignored" : "none"\}/);
  assert.match(globe, /if \(typeof value !== "number" && typeof value !== "string"\) return null/);
  assert.match(globe, /typeof value === "string" && value\.trim\(\) === ""/);
  assert.doesNotMatch(globe, /createAtlasTexture|new THREE\.|native-three|fallbackPoints|fallbackRoutes|<svg/);
});

test("hero fixture routes never claim audited or physical-tap evidence", () => {
  assert.match(hero, /Escenario ilustrativo; sin evidencia de tap físico ni custodia/);
  assert.match(hero, /Ruta global ilustrativa/);
  assert.doesNotMatch(hero, /Audited (?:global )?route|Ruta (?:global )?auditada|Rota (?:global )?auditada|Evidencia de tap fisico|Physical tap, SUN/);
});

test("shared operations maps distinguish reported events from physical routes", () => {
  assert.match(globalOpsMap, /02 tap simulado/);
  assert.match(globalOpsMap, /no prueban recorridos ni custodia física/);
  assert.doesNotMatch(globalOpsMap, /02 tap fisico|02 tap físico|Rutas origen-tap/);

  assert.match(globe3dMap, /Conexión reportada/);
  assert.match(globe3dMap, /no prueba recorrido físico/);
  assert.doesNotMatch(globe3dMap, /Ruta verificada|Ruta de trazabilidad|taps verificados|Distancia auditada/);
});

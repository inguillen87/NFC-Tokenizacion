import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolveSunEntry } from "../src/app/sun/sun-availability.ts";
import { selectedValleSecretoDemo, valleSecretoDemoResult, valleSecretoDemoScenario, VALLE_SECRETO_DEMO } from "../src/app/sun/valle-secreto-demo.ts";
import { demoSommelierAnswer } from "../src/app/sun/sun-demo-sommelier.ts";

test("Valle Secreto cannot override NFC, QR, snapshot or incomplete real entry", () => {
  const clean = { isQrScan: false, demoRequested: true, snapshotId: "", snapshotTrace: "", snapshotAccess: "", freshToken: "", hasSnapshotMarker: false, hasDynamicMarker: false, dynamic: [] };
  assert.equal(resolveSunEntry(clean), "demo");
  for (const override of [
    { isQrScan: true }, { snapshotId: "733", hasSnapshotMarker: true }, { snapshotAccess: "private-placeholder", hasSnapshotMarker: true },
    { freshToken: "private-placeholder", hasSnapshotMarker: true }, { hasDynamicMarker: true },
    { hasDynamicMarker: true, dynamic: ["2", "real-batch", "picc-placeholder", "enc-placeholder", "cmac-placeholder"] },
    { demoRequested: false },
  ]) {
    const isDemo = resolveSunEntry({ ...clean, ...override }) === "demo";
    assert.equal(isDemo, false);
    assert.equal(selectedValleSecretoDemo(isDemo, "valle-secreto"), null);
    assert.equal(valleSecretoDemoResult(isDemo, "valle-secreto", "opened"), null);
  }
  for (const profile of ["valle-secreto ", "VALLE-SECRETO", "other", undefined, ["valle-secreto"]]) assert.equal(valleSecretoDemoResult(true, profile, "closed"), null);
});

test("demo scenarios preserve an empty real trace and disable every business action", () => {
  for (const scenario of ["closed", "opened", "invalid", undefined]) {
    const result = valleSecretoDemoResult(true, "valle-secreto", scenario);
    assert.equal(result.status.reason, "demo_preview");
    assert.equal(result.status.productState, scenario === "opened" ? "VALID_OPENED" : "VALID_CLOSED");
    assert.equal(result.identity.uid, null);
    assert.equal(result.identity.scanCount, 0);
    assert.equal(result.identity.eventId, "demo-sun-preview");
    assert.deepEqual(result.provenance.timelineSummary, []);
    assert.equal(result.iot.wineryCoordinates, null);
    assert.equal(result.tapContext, undefined);
    assert.equal(result.iot.sensorEvidenceKind, "simulated");
    assert.equal(result.iot.sensorSnapshot.deviceId, null);
    assert.equal(result.iot.sensorSnapshot.observedAt, null);
    assert.ok(Object.values(result.cta).every(value => value === false));
    assert.deepEqual(result.allowedActions, []);
    assert.ok(result.blockedActions.includes("purchase"));
  }
  assert.equal(valleSecretoDemoScenario("OPENED"), "closed");
});

test("all branded references use the Chilean producer, selected vintage and attributed public sources", () => {
  const result = valleSecretoDemoResult(true, "valle-secreto", "closed");
  assert.equal(result.product.winery, "Valle Secreto");
  assert.equal(result.product.vintage, "2019");
  assert.equal(result.product.barrelMonths, 24);
  assert.equal(result.product.region, "Cachapoal Andes, Chile");
  assert.equal([...VALLE_SECRETO_DEMO.blend.matchAll(/(\d+)%/g)].reduce((sum, value) => sum + Number(value[1]), 0), 100);
  for (const key of ["photoSource", "technicalSheet", "experiences", "estate", "practices"]) assert.equal(new URL(VALLE_SECRETO_DEMO[key]).hostname, "vallesecreto.cl");
  assert.equal(new URL(VALLE_SECRETO_DEMO.certificate).hostname, "www.sustainable.cl");
  const map = new URL(VALLE_SECRETO_DEMO.mapUrl);
  assert.equal(map.hostname, "www.google.com");
  assert.match(map.searchParams.get("query"), /Los Maquis/);
  assert.doesNotMatch(JSON.stringify(result), /Tunuyan|Balmec|Mendoza|Buenos Aires|firstVerified|txHash/);
});

test("branded guidance provides producer facts without inventing stock, prizes or sensor readings", () => {
  for (const [locale, serving, barrel] of [["es-AR", "¿Cómo lo sirvo?", "¿Cuánto tiempo en barricas?"], ["en", "How should I serve it?", "Which barrels?"], ["pt-BR", "Como devo servir?", "Quantos meses em barricas?"]]) {
    const response = demoSommelierAnswer(serving, locale, VALLE_SECRETO_DEMO);
    assert.match(response.text, /16–18/);
    assert.equal(response.sourceUrl, VALLE_SECRETO_DEMO.technicalSheet);
    assert.match(demoSommelierAnswer(barrel, locale, VALLE_SECRETO_DEMO).text, /24/);
  }
  assert.equal(demoSommelierAnswer("mapa del tesoro", "es-AR", VALLE_SECRETO_DEMO).sourceUrl, VALLE_SECRETO_DEMO.experiences);
  assert.equal(demoSommelierAnswer("sustentabilidad", "es-AR", VALLE_SECRETO_DEMO).sourceUrl, VALLE_SECRETO_DEMO.practices);
});

test("page passes the named profile only to demo content while real permissions remain independent", async () => {
  const page = await readFile(new URL("../src/app/sun/page.tsx", import.meta.url), "utf8");
  assert.match(page, /selectedValleSecretoDemo\(isDemoPreview, readParam\(params, "profile"\)\)/);
  assert.match(page, /const publishedPromotion: SunPublishedPromotion \| null = valleDemo \? null : declaredPromotion/);
  assert.match(page, /isDemoPreview=\{isDemoPreview\}\s+demoWineProfile=\{valleDemo\}/);
  assert.match(page, /!isDemoPreview && bid && \(uid \|\| eventId\)/);
  assert.match(page, /\{valleDemo \? <ValleSecretoDemoServices locale=\{locale\} \/> : hasSourceResult \? <SunServicesHub/);
});

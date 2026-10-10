import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { SYNGENTA_DEMO, selectedSyngentaDemo, syngentaDemoCopy, syngentaDemoResult } from "../src/app/sun/syngenta-demo.ts";
import { resolveSunEntry } from "../src/app/sun/sun-availability.ts";
import { resolveSunDemoProfile } from "../src/app/sun/sun-demo-entry.ts";
import { sunDemoScenarioHref, SYNGENTA_DEMO_HREF } from "../src/lib/sun-demo-links.ts";
import { resolveDemoProductProfile, isDemoProductProfileKey } from "../src/lib/demo-product-profiles.ts";
import { valleSecretoDemoResult } from "../src/app/sun/valle-secreto-demo.ts";
import { expectedTelemetryFailure, expectedTelemetryConsole } from "./syngenta-demo.browser.mjs";

test("only deliberate exclusions of the two declared telemetry scripts accept Chrome's blocked-client variants", () => {
  const scripts = [
    "https://static.cloudflareinsights.com/beacon.min.js/v4bc70e2c01a94c73b74392e4234840661791215815920",
    "https://vercel.live/_next-live/feedback/feedback.js",
  ];
  for (const url of scripts) {
    const request = { url, declared: true, excluded: true, method: "GET", resourceType: "script" };
    for (const code of ["net::ERR_BLOCKED_BY_CLIENT", "net::ERR_BLOCKED_BY_CLIENT.Inspector"]) {
      assert.equal(expectedTelemetryFailure({ ...request, code }), true);
      assert.equal(expectedTelemetryConsole({ ...request, text: `Failed to load resource: ${code}` }), true);
      for (const flag of ["declared", "excluded"]) {
        assert.equal(expectedTelemetryFailure({ ...request, code, [flag]: false }), false);
        assert.equal(expectedTelemetryConsole({ ...request, text: `Failed to load resource: ${code}`, [flag]: false }), false);
      }
      assert.equal(expectedTelemetryFailure({ ...request, code, method: "POST" }), false);
      assert.equal(expectedTelemetryFailure({ ...request, code, resourceType: "fetch" }), false);
      for (const otherUrl of [url + "?extra=1", "https://nexid.lat/_next/static/app.js", "https://api.nexid.lat/sun"]) {
        assert.equal(expectedTelemetryFailure({ ...request, code, url: otherUrl }), false);
        assert.equal(expectedTelemetryConsole({ ...request, text: `Failed to load resource: ${code}`, url: otherUrl }), false);
      }
    }
    for (const code of ["net::ERR_ABORTED", "net::ERR_NETWORK_CHANGED", "net::ERR_NAME_NOT_RESOLVED"]) {
      assert.equal(expectedTelemetryFailure({ ...request, code }), false);
      assert.equal(expectedTelemetryConsole({ ...request, text: `Failed to load resource: ${code}` }), false);
    }
    assert.equal(expectedTelemetryConsole({ ...request, text: "Application error" }), false);
  }
});

const empty = { isQrScan: false, demoRequested: true, snapshotId: "", snapshotTrace: "", snapshotAccess: "", freshToken: "", dynamic: ["", "", "", "", ""] };

test("Syngenta catalog identity and document references are fixed public facts, not query-selected destinations", () => {
  assert.equal(SYNGENTA_DEMO.name, "AMISTAR XTRA");
  assert.equal(SYNGENTA_DEMO.brand, "Syngenta");
  assert.equal(SYNGENTA_DEMO.category, "Fungicida");
  assert.equal(SYNGENTA_DEMO.formulation, "Suspensión concentrada");
  assert.equal(SYNGENTA_DEMO.container, "Bidón de 5 L");
  assert.equal(SYNGENTA_DEMO.tagProposal, "NTAG 424 DNA TagTamper");
  assert.equal(SYNGENTA_DEMO.tagSource, "https://www.nxp.com/docs/en/application-note/AN12196.pdf");
  assert.equal(SYNGENTA_DEMO.registrationNumber, "34011");
  assert.equal(SYNGENTA_DEMO.lot, "DEMO-SYN-001");
  const documents = {
    productPage: "/product/crop-protection/fungicida/amistar-xtra",
    label: "/sites/g/files/kgtney396/files/media/document/2016/08/16/amistar20xtra_etiqueta_4541.pdf",
    safetySheet: "/sites/g/files/kgtney396/files/media/document/2024/02/28/AMISTAR%20XTRA_hoja_de_seguridad.pdf",
  };
  for (const [field, path] of Object.entries(documents)) {
    const url = new URL(SYNGENTA_DEMO[field]);
    assert.equal(url.origin, "https://www.syngenta.com.ar");
    assert.equal(url.pathname, path);
    assert.equal(url.username + url.password + url.search + url.hash, "");
  }
  assert.equal(SYNGENTA_DEMO.imageUrl, "/sun/syngenta/amistar-xtra-5l-planeta.webp");
  assert.equal(SYNGENTA_DEMO.logo, "/sun/syngenta/logo.svg");
  assert.equal(SYNGENTA_DEMO.photoSource, "https://www.mercadolibre.com.ar/syngenta-amistar-xtra-fungicida-x-5-l--azoxistrobina/up/MLAU3544079462");
});

function renderSyngentaExperience(locale, scenario) {
  const componentUrl = new URL("../src/app/sun/syngenta-demo-experience.tsx", import.meta.url);
  const require = createRequire(import.meta.url);
  const module = { exports: {} };
  const css = { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
  const compiled = ts.transpileModule(readFileSync(componentUrl, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const localRequire = name => {
    if (name.endsWith(".module.css")) return css;
    if (name === "./syngenta-demo") return { SYNGENTA_DEMO };
    if(name === './syngenta-demo-map') return {SyngentaDemoMap:()=>React.createElement('div', {'data-testid':'syngenta-map-stub'})};
    if(name === './syngenta-product-assistant') return {SyngentaProductAssistant:()=>React.createElement('div', {'data-testid':'syngenta-assistant-stub'})};
    if (name.startsWith(".")) throw new Error(`Unexpected production dependency: ${name}`);
    return require(name);
  };
  new Function("require", "module", "exports", compiled)(localRequire, module, module.exports);
  return renderToStaticMarkup(React.createElement(module.exports.SyngentaDemoExperience, { locale, scenario }));
}

test("the 5 L container and optional seal proposal remain public information, not a physical validation in any state", () => {
  const expected = {
    "es-AR": ["Bidón de 5 L", "Propuesta para el sello de apertura", "todavía no hay un sello físico validado", "No vigila continuamente", "composición química", "corte y vuelva a unir"],
    en: ["5 L canister", "Proposal for the opening seal", "no physical seal has been validated yet", "does not monitor continuously", "chemical composition", "cut and reconnect"],
    "pt-BR": ["Galão de 5 L", "Proposta para o lacre de abertura", "ainda não há um lacre físico validado", "Não monitora continuamente", "composição química", "corte e a reconexão"],
  };
  for (const [locale, phrases] of Object.entries(expected)) for (const scenario of ["closed", "opened", "invalid"]) {
    const html = renderSyngentaExperience(locale, scenario);
    const facts = html.match(/<dl\b[^>]*>[\s\S]*?<\/dl>/)?.[0];
    assert.ok(facts && facts.includes(phrases[0]));
    assert.equal((facts.match(/<dt>/g) || []).length, 4);
    const details = html.match(/<details\b[^>]*data-testid="syngenta-seal-details"[^>]*>[\s\S]*?<\/details>/)?.[0];
    assert.ok(details && !/<details\b[^>]*\bopen(?:=|\s|>)/.test(details), "technical explanation starts collapsed");
    for (const phrase of phrases.slice(1)) assert.ok(details.includes(phrase), `${locale} preserves the proposal limit: ${phrase}`);
    assert.ok(details.includes(SYNGENTA_DEMO.tagProposal));
    const source = details.match(/<a\b[^>]*data-syngenta-tag-source[^>]*>/)?.[0];
    assert.ok(source && source.includes(`href="${SYNGENTA_DEMO.tagSource}"`));
    assert.match(source, /target="_blank"/);
    assert.match(source, /rel="noopener noreferrer"/);
    assert.match(source, /referrerPolicy="no-referrer"/i);
    assert.doesNotMatch(source, /data-syngenta-document|tenant=|bid=|fresh|cmac/);
    assert.doesNotMatch(html, /<form\b|type="submit"|<input\b/);
  }
});

test("closed, opened and invalid samples preserve public identity and grant no protected action", () => {
  const expected = { closed: [true, "VALID_CLOSED", "CLOSED"], opened: [true, "VALID_OPENED", "OPENED"], invalid: [false, "INVALID", "UNKNOWN"] };
  for (const [scenario, [ok, state, seal]] of Object.entries(expected)) {
    const result = syngentaDemoResult(true, "syngenta", scenario);
    assert.equal(result.ok, ok);
    assert.equal(result.status.productState, state);
    assert.equal(result.status.tamperStatus, seal);
    assert.equal(result.status.reason, "demo_preview");
    assert.equal(result.product.name, SYNGENTA_DEMO.name);
    assert.equal(result.identity.uid, null);
    assert.equal(result.identity.readCounter, 0);
    assert.equal(result.identity.scanCount, 0);
    assert.deepEqual(result.allowedActions, []);
    assert.deepEqual(result.blockedActions, ["claim", "warranty", "tokenize", "purchase", "rewards"]);
    assert(Object.values(result.cta).every(value => value === false));
    assert.equal(result.iot.wineryCoordinates, null);
    assert.equal(result.iot.sensorEvidenceKind, "none");
    assert.equal(result.iot.sensorSnapshot, undefined);
    assert.equal(result.tapContext, undefined);
    assert.deepEqual(result.provenance.timelineSummary, []);
    assert.equal(result.provenance.origin, null);
    for (const field of ["region", "varietal", "vintage", "barrelMonths", "storage"]) assert.equal(result.product[field], null);
    assert.equal(result.product.agro, undefined, "sample must not enter the live AgroDppExperience event writer");
  }
  assert.equal(syngentaDemoResult(true, "syngenta", "opened").status.tone, "warn");
  assert.equal(syngentaDemoResult(true, "syngenta", "invalid").status.tone, "risk");
});

test("NFC, snapshot and QR markers always take precedence over the requested Syngenta demo", () => {
  assert.equal(resolveSunEntry(empty), "demo");
  for (const overrides of [{ isQrScan: true }, { hasSnapshotMarker: true }, { hasDynamicMarker: true }, { snapshotId: "qa", snapshotTrace: "synthetic", snapshotAccess: "invalid" }, { freshToken: "synthetic" }, { dynamic: ["1", "qa", "synthetic", "synthetic", "synthetic"] }]) {
    const entry = resolveSunEntry({ ...empty, ...overrides });
    assert.notEqual(entry, "demo");
    assert.equal(selectedSyngentaDemo(entry === "demo", "syngenta"), null);
    assert.equal(syngentaDemoResult(entry === "demo", "syngenta", "closed"), null);
  }
  for (const value of [null, undefined, ["syngenta"], { key: "syngenta" }, "Syngenta", "syngenta&tenant=private", "https://www.syngenta.com.ar/", "__proto__"]) {
    assert.equal(selectedSyngentaDemo(true, value), null);
    assert.equal(syngentaDemoResult(true, value, "closed"), null);
  }
  assert.equal(resolveSunDemoProfile(true, { profile: ["syngenta"] }), "");
});

test("SUN-specific selection preserves legacy Demo Lab, Valle default and all scenario routes", () => {
  assert.equal(isDemoProductProfileKey("syngenta"), false);
  assert.equal(resolveDemoProductProfile("syngenta").key, "wine");
  assert.equal(resolveDemoProductProfile("agrochem").brand, "CampoNexo");
  assert.equal(resolveSunDemoProfile(true, { demo: "1" }), "valle-secreto");
  assert.equal(valleSecretoDemoResult(true, "valle-secreto", "closed").product.name, "Profundo 2019");
  assert.equal(sunDemoScenarioHref("syngenta", "closed"), SYNGENTA_DEMO_HREF);
  for (const state of ["closed", "opened", "invalid"]) {
    const url = new URL(sunDemoScenarioHref("syngenta", state), "https://nexid.lat");
    assert.deepEqual([...url.searchParams], [["demo", "1"], ["profile", "syngenta"], ["scenario", state]]);
    assert.equal(url.pathname, "/sun");
    const legacy = new URL(sunDemoScenarioHref("agrochem", state), url.origin);
    assert.equal(legacy.searchParams.get("source"), "demo-lab");
    assert.equal(legacy.searchParams.get("profile"), "agrochem");
  }
});

test("all languages distinguish public catalog content, simulated states and unavailable measurements", () => {
  const expected = { "es-AR": ["Sello cerrado · demo", "Sello abierto · demo", "Lectura no válida · demo"], en: ["Closed seal · demo", "Open seal · demo", "Invalid reading · demo"], "pt-BR": ["Lacre fechado · demo", "Lacre aberto · demo", "Leitura inválida · demo"] };
  for (const [locale, labels] of Object.entries(expected)) for (const [index, state] of ["closed", "opened", "invalid"].entries()) {
    const copy = syngentaDemoCopy(locale, state);
    assert.equal(copy.state, labels[index]);
    assert(copy.productStatusTitle.includes("AMISTAR XTRA"));
    assert(copy.trust.includes("Syngenta Argentina"));
    assert(copy.conditionBody.length > 30);
    assert(copy.stageBody.length > 30);
    assert(copy.photoCredit.includes("Tienda Planeta Verde"));
    assert.match(copy.photoCredit, /comercial|commercial/i, "the photo is a credited commercial reference");
    assert(!copy.conditionBody.includes("15.2") && !copy.conditionBody.includes("62%"));
  }
});

test("SUN integrates the demo behind source guards without the live agro or wine engagement contracts", async () => {
  const page = await readFile(new URL("../src/app/sun/page.tsx", import.meta.url), "utf8");
  assert(page.indexOf("const entry = resolveSunEntry(") < page.indexOf("const syngentaDemo = selectedSyngentaDemo("));
  assert.match(page, /selectedSyngentaDemo\(isDemoPreview, resolveSunDemoProfile\(isDemoPreview, params\)\)/);
  assert.match(page, /usesDemoSensorEvidence = isDemoPreview && !syngentaDemo &&/);
  assert.match(page, /syngentaDemo \? <SyngentaDemoOrigin locale=\{locale\} \/>/);
  assert.match(page, /SyngentaDemoExperience key=\{locale\} locale=\{locale\} scenario=\{demoScenario\}/);
  assert.match(page, /SyngentaDemoServices locale=\{locale\} scenario=\{demoScenario\}/);
  assert.match(page, /showEngagementSuite = \(engagementBaseEligible \|\| isDemoPreview\) && isWineProduct/);
  assert.match(page, /!valleDemo && !syngentaDemo \? <ReportProblemForm/);
  const riskNotice = page.match(/hasSourceResult && isRiskBlocked && !isDemoPreview \? \(([\s\S]*?)\) : null/)[1];
  assert.match(riskNotice, /<a\s+href=\{reportProblemHref\}/);
  assert.doesNotMatch(riskNotice, /<Link\b/);
});

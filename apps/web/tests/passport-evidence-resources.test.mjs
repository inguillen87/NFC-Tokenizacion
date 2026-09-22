import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const styles = new Proxy({}, { get: (_, key) => key });
function load(path, bindings = {}) {
  const source = readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", js)(name => name in bindings ? bindings[name] : require(name), module, module.exports);
  return module.exports;
}
const summary = load("lib/passport-evidence-summary.ts");
const modelModule = load("app/sun/passport-evidence-resources-model.ts", { "../../lib/passport-evidence-summary": summary });
const { passportEvidenceResourcesModel: model } = modelModule;
const currentModel = load("app/sun/current-editorial-resources-model.ts");
const base = { mode: "historical", carrierCode: "ntag424_dna_tt", occurredAt: "2026-09-20T17:15:00Z", eventReference: "713",
  statusLabel: "Mensaje validado", certificateHref: "/certificado/713?share=v1.fixture_signature" };
function markup(props = {}, locale = "es-AR") {
  const currentComponent = load("app/sun/current-editorial-resources.tsx", {
    "./current-editorial-resources-model": currentModel,
    "./sun-locale-provider": { useSunLocale: () => ({ locale, text: value => value }) },
    "./current-editorial-resources.module.css": { __esModule: true, default: styles },
  });
  const component = load("app/sun/passport-evidence-resources.tsx", {
    "./passport-evidence-resources-model": modelModule,
    "./sun-locale-provider": { useSunLocale: () => ({ locale, text: value => value }) },
    "./passport-evidence-resources.module.css": { __esModule: true, default: styles },
    "./current-editorial-resources": currentComponent,
  }).PassportEvidenceResources;
  return renderToStaticMarkup(React.createElement(component, { ...base, ...props }));
}

test("historical reading keeps its date and certificate without granting a fresh tap", () => {
  const view = model(base);
  assert.equal(view.mode, "historical");
  assert.equal(view.recordedAt.iso, base.occurredAt.replace("Z", ".000Z"));
  assert.match(view.recordedAt.label, /UTC$/);
  assert.equal(view.reference, "713");
  assert.match(view.explanation, /no equivale a un nuevo TAP/);
  assert.equal(view.resources[0].href, base.certificateHref);
  const html = markup();
  assert.match(html, /Registro histórico/);
  assert.match(html, /datetime="2026-09-20T17:15:00.000Z"/i);
  assert.match(html, /href="\/certificado\/713\?share=v1.fixture_signature"/);
  assert.doesNotMatch(html.replace(/href="[^"]*"/g, ""), /fixture_signature/);
  assert.doesNotMatch(html, /<button|<form|Activar|Solicitar/);
});

test("freshness does not become product authenticity or action authorization", () => {
  const view = model({ ...base, mode: "fresh" });
  assert.equal(view.title, "Lectura reciente");
  assert.match(view.explanation, /Cada acción protegida tiene sus propios requisitos/);
  assert.equal(view.resources[0].detail, "Evidencia digital; no certifica el producto físico.");
  assert.equal("allowedActions" in view, false);
});

test("missing and invalid dates remain unavailable instead of using render time", () => {
  for (const occurredAt of [undefined, null, "", "ayer", "2026-09-20", "2026-09-20T17:15:00", "2026-02-30T12:00:00Z", "invalid"]) {
    const view = model({ ...base, occurredAt });
    assert.equal(view.recordedAt, null, String(occurredAt));
    assert.match(markup({ occurredAt }), /Fecha no disponible/);
  }
  assert.equal(model({ ...base, occurredAt: "2026-09-20T14:15:00-03:00" }).recordedAt.iso, "2026-09-20T17:15:00.000Z");
});

test("event references preserve bigint digits and reject arbitrary identity text", () => {
  assert.equal(model({ ...base, eventReference: "9007199254740993" }).reference, "9007199254740993");
  for (const eventReference of ["04AABBCCDDEEFF", "<img src=x>", "000713", "0", "-1", "9223372036854775808", "713?uid=private"]) {
    assert.equal(model({ ...base, eventReference }).reference, null);
    assert.equal(model({ ...base, eventReference }).resources.length, 0);
  }
});

test("only the provided certificate access link for this event is accepted", () => {
  for (const certificateHref of [null, "", "/certificado/713", "/certificado/714?share=valid", "/certificado/713?share=",
    "/certificado/713?share=x&fresh=private", "/certificado/713?share=x&share=y", "//evil.test/certificado/713?share=x",
    "https://evil.test/certificado/713?share=x", "javascript:alert(1)", "/certificado/713?share=x#private", "/certificado/713?share=x%0a",
  ]) assert.equal(model({ ...base, certificateHref }).resources.length, 0, String(certificateHref));
  assert.equal(model({ ...base, certificateHref: "/certificado/713?share=v1.signature" }).resources.length, 1);
});

test("QR and demo cannot inherit a positive NFC label or a real certificate", () => {
  for (const mode of ["qr", "demo"]) {
    const view = model({ ...base, mode });
    assert.equal(view.statusLabel, null);
    assert.equal(view.reference, null);
    assert.equal(view.recordedAt, null);
    assert.equal(view.resources.length, 0);
    assert.doesNotMatch(markup({ mode }), /Mensaje validado|fixture_signature|#713|datetime=/i);
  }
  const demo = model({ ...base, mode: "demo", showProductNotices: true, technicalSheetHref: "https://docs.example.test/a.pdf" });
  assert.equal(demo.resources.length, 0);
  assert.match(markup({ mode: "demo" }), /Perfil ilustrativo/);
});

test("basic NFC, logistics UHF and unknown carriers never render positive NFC labels", () => {
  for (const carrierCode of ["ntag213", "ntag215", "ntag216", "uhf_rfid", "qr_basic", "gs1_digital_link", "unknown-chip", undefined]) {
    const view = model({ ...base, carrierCode });
    assert.notEqual(view.statusLabel, "Mensaje validado");
    assert.doesNotMatch(markup({ carrierCode }), />Mensaje validado</);
  }
  assert.equal(model({ ...base, carrierCode: "ntag424_dna" }).statusLabel, "Mensaje validado");
});

test("documents remain declared snapshot links without an invented date or validity", () => {
  const props = { technicalSheetHref: "https://docs.example.test/technical.pdf", safetySheetHref: "https://docs.example.test/safety.pdf", showProductNotices: true };
  const view = model({ ...base, ...props });
  assert.deepEqual(view.resources.map(r => r.kind), ["certificate", "technical", "safety", "notices"]);
  assert.equal(view.resources[3].href, "#product-notices");
  assert.equal(view.resources[1].detail, "Enlace conservado en esta lectura · docs.example.test");
  assert.equal(view.resources[2].detail, "Enlace conservado en esta lectura · docs.example.test");
  const html = markup(props);
  assert.match(html, /información presentada en esta ficha, separada de la evidencia NFC/);
  for (const mode of ["qr", "unknown"]) assert.doesNotMatch(markup({ ...props, mode }), /por la marca/);
  assert.match(html, /No confirman la versión vigente ni la fecha de revisión/);
  assert.match(html.replace(/href="[^"]*"/g, ""), /docs\.example\.test/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /referrerPolicy="no-referrer"/i);
  assert.doesNotMatch(html, /Documento verificado|Actualizado hoy|Sin recall|Producto seguro/);
});

test("historical documents remain in their reading block and never fill the current publication", () => {
  const html = markup({ technicalSheetHref: "https://old.example.test/old.pdf", currentEditorial: {
    protocol: "nexid.current-editorial.v1", source: "passport_studio", state: "legacy", observedAt: null,
  } });
  const currentIndex = html.indexOf('id="current-editorial-resources"');
  assert.ok(currentIndex > html.indexOf('id="passport-evidence-resources"'));
  assert.match(html.slice(0, currentIndex), /old\.example\.test\/old\.pdf/);
  assert.doesNotMatch(html.slice(currentIndex), /old\.example\.test|<a /);
  assert.match(html.slice(currentIndex), /data-editorial-state="legacy"/);
  assert.doesNotMatch(markup({ mode: "demo" }), /current-editorial-resources/);
});

test("resource links reject unsafe protocols, credentials and dynamic tag proof", () => {
  for (const value of ["http://docs.example.test/a.pdf", "javascript:alert(1)", "data:text/html,test", "/api/private",
    "https://user:password@docs.example.test/a.pdf", "https://docs.example.test/a.pdf?fresh_token=secret",
    "https://docs.example.test/a.pdf?uid=04AABB", "https://docs.example.test/a.pdf?cmac=secret",
  ]) assert.equal(model({ mode: "qr", technicalSheetHref: value }).resources.length, 0, value);
  assert.equal(model({ mode: "qr", technicalSheetHref: "https://docs.example.test/a.pdf" }).resources.length, 1);
});

test("all three locales expose the same evidence and resource boundaries", () => {
  for (const [locale, title, missing] of [["es-AR", "Evidencia y recursos", "Fecha no disponible"], ["en", "Evidence and resources", "Date unavailable"], ["pt-BR", "Evidências e recursos", "Data indisponível"]]) {
    const html = markup({ occurredAt: null }, locale);
    assert.ok(html.includes(title));
    assert.ok(html.includes(missing));
    assert.match(html, /aria-labelledby="passport-evidence-title"/);
    assert.match(html, /data-resource-kind="certificate"/);
  }
});

test("reading presentation escapes text and owns no request, mutation or token creation", () => {
  assert.match(markup({ statusLabel: "<script>alert(1)</script>" }), /&lt;script&gt;/);
  const component = readFileSync(new URL("../src/app/sun/passport-evidence-resources.tsx", import.meta.url), "utf8");
  const source = readFileSync(new URL("../src/app/sun/passport-evidence-resources-model.ts", import.meta.url), "utf8");
  assert.doesNotMatch(component + source, /fetch\(|XMLHttpRequest|localStorage|sessionStorage|Date\.now|new Date\(\)|create.*Token|onClick|<form/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const styles = new Proxy({}, { get: (_, key) => key });
function load(file, bindings = {}) {
  const source = readFileSync(new URL(`../src/app/sun/${file}`, import.meta.url), "utf8");
  const module = { exports: {} };
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function("require", "module", "exports", js)(name => name in bindings ? bindings[name] : require(name), module, module.exports);
  return module.exports;
}
const modelModule = load("current-editorial-resources-model.ts");
const { currentEditorialResourcesModel: model } = modelModule;
const base = {
  protocol: "nexid.current-editorial.v1", source: "passport_studio", state: "published",
  observedAt: "2026-09-21T16:00:00Z", version: 2, publishedAt: "2026-09-20T14:15:00-03:00", contentDigest: "a".repeat(64),
  document: {
    schemaVersion: "nexid.passport-editorial.v1", template: "agro", locale: "pt-BR",
    identity: { product_name: "Sementes novas", public_lot_label: "LOTE-2", sku: "S2", winery: "Empresa publicada", region: "Região declarada", image_url: null },
    agro_product_profile: { technicalSheetUrl: "https://docs.example.test/current.pdf?version=2", safetySheetUrl: null },
  },
};
function changedDocument(change) { return { ...base, document: { ...base.document, ...change } }; }
function markup(value = base, locale = "es-AR") {
  const component = load("current-editorial-resources.tsx", {
    "./current-editorial-resources-model": modelModule,
    "./sun-locale-provider": { useSunLocale: () => ({ locale, text: () => assert.fail("editorial data must not be translated") }) },
    "./current-editorial-resources.module.css": { __esModule: true, default: styles },
  }).CurrentEditorialResources;
  return renderToStaticMarkup(React.createElement(component, { currentEditorial: value }));
}

test("published metadata identifies its version, original language and UTC publication date", () => {
  const view = model(base);
  assert.equal(view.state, "published");
  assert.equal(view.publication.version, 2);
  assert.equal(view.publication.publishedAt.iso, "2026-09-20T17:15:00.000Z");
  assert.match(view.publication.publishedAt.label, /UTC$/);
  assert.equal(view.observedAt.iso, "2026-09-21T16:00:00.000Z");
  assert.equal(view.publication.locale, "pt-BR");
  assert.equal(view.publication.language, "Portugués");
  assert.equal(view.publication.identity[0].value, "Sementes novas");
});

test("published details start collapsed with named section and accessible document links", () => {
  const html = markup();
  assert.match(html, /aria-labelledby="current-editorial-title"/);
  assert.match(html, /data-testid="current-editorial-summary"/);
  assert.doesNotMatch(html, /<details[^>]*\sopen(?:\s|=|>)/);
  assert.match(html, /data-editorial-state="published"/);
  assert.match(html, /data-current-resource-kind="technical"/);
  assert.match(html.replace(/href="[^"]*"/g, ""), /docs\.example\.test/);
  assert.match(html, /referrerPolicy="no-referrer"/i);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /no a una revisión o certificación de los documentos/);
});

test("all negative states suppress content even when stale publication fields are present", () => {
  const labels = new Set();
  for (const state of ["unpublished", "legacy", "withdrawn", "invalid", "unavailable"]) {
    const view = model({ ...base, state });
    assert.equal(view.state, state);
    assert.equal(view.publication, null);
    labels.add(view.status);
    const html = markup({ ...base, state });
    assert.doesNotMatch(html, /Sementes novas|current\.pdf|data-current-resource-kind|<details/);
  }
  assert.equal(labels.size, 5);
  assert.match(markup({ ...base, state: "withdrawn" }), /El estado del lote impide mostrar/);
  assert.doesNotMatch(markup({ ...base, state: "withdrawn" }), /Publicación retirada|marca retiró|Producto retirado/);
});

test("an older API without the projection yields availability copy without inventing a date", () => {
  for (const value of [null, undefined]) {
    const view = model(value);
    assert.equal(view.state, "unavailable");
    assert.equal(view.observedAt, null);
    assert.equal(view.publication, null);
  }
  assert.doesNotMatch(markup(null), /<time|<a |Versión 2/);
});

test("a published version without its observation date is not shown as current", () => {
  const payload = { ...base, observedAt: null };
  assert.equal(model(payload).state, "invalid");
  assert.equal(model(payload).publication, null);
  assert.doesNotMatch(markup(payload), /current\.pdf|data-current-resource-kind|Versión 2/);
});

test("a publication later than the observation is rejected using normalized UTC dates", () => {
  const payload = { ...base, publishedAt: "2026-09-21T13:00:01-03:00" };
  assert.equal(model(payload).state, "invalid");
  assert.equal(model(payload).publication, null);
  assert.doesNotMatch(markup(payload), /current\.pdf|data-current-resource-kind|Versión 2/);
  assert.equal(model({ ...base, publishedAt: "2026-09-21T13:00:00-03:00" }).state, "published");
});

test("unknown payloads and wrong protocol, source or states never become a publication", () => {
  for (const value of [false, 1, "published", [], {}, { ...base, protocol: "other" }, { ...base, source: "query" }, { ...base, state: "new_state" }]) {
    assert.equal(model(value).state, "invalid");
    assert.equal(model(value).publication, null);
  }
});

test("published payload requires complete version and public document metadata", () => {
  for (const patch of [{ version: 0 }, { version: "2" }, { version: 1.5 }, { version: Number.MAX_SAFE_INTEGER + 1 },
    { contentDigest: "" }, { contentDigest: "g".repeat(64) }, { publishedAt: null }, { observedAt: undefined }, { document: null }]) {
    assert.equal(model({ ...base, ...patch }).state, "invalid", JSON.stringify(patch));
  }
  for (const patch of [{ schemaVersion: "old" }, { template: "unknown" }, { locale: "es" }, { identity: {} },
    { identity: [] }, { identity: { ...base.document.identity, product_name: { value: "untrusted" } } }, { agro_product_profile: null }]) {
    assert.equal(model(changedDocument(patch)).state, "invalid", JSON.stringify(patch));
  }
});

test("invalid or timezone-free dates never inherit current time or normalized calendar rollover", () => {
  for (const value of ["2026-09-20", "2026-09-20T17:15:00", "2026-02-30T12:00:00Z", "2026-09-20T24:00:00Z", "no-date"]) {
    assert.equal(model({ ...base, publishedAt: value }).state, "invalid", value);
    assert.equal(model({ ...base, observedAt: value }).state, "invalid", value);
  }
});

test("a removed document stays absent and general templates never restore historical links", () => {
  const withoutDocuments = changedDocument({ agro_product_profile: { technicalSheetUrl: null, safetySheetUrl: null } });
  const view = model({ ...withoutDocuments, technicalSheetHref: "https://old.example.test/revoked.pdf", product: { agro: base.document.agro_product_profile } });
  assert.equal(view.publication.resources.length, 0);
  assert.match(markup(withoutDocuments), /Esta versión no incluye enlaces/);
  assert.doesNotMatch(markup(withoutDocuments), /current\.pdf|revoked\.pdf/);
  const general = changedDocument({ template: "general", agro_product_profile: null });
  assert.equal(model(general).state, "published");
  assert.equal(model(general).publication.resources.length, 0);
  assert.equal(model(changedDocument({ template: "general" })).state, "invalid");
});

test("only public HTTPS document URLs are offered, never credentials or capability parameters", () => {
  const unsafe = ["http://docs.example.test/a.pdf", "//docs.example.test/a.pdf", "/api/private", "javascript:alert(1)", "data:text/html,test",
    "https://user:password@docs.example.test/a.pdf", "https://docs.example.test/\\bad.pdf", "https://docs.example.test/a\n.pdf"];
  for (const key of ["fresh", "freshToken", "fresh_token", "sun_fresh", "uid", "uidHex", "cmac", "picc_data", "enc", "share", "access", "snapshot_access", "apiKey", "X-Amz-Signature", "X-Goog-Credential"]) {
    unsafe.push(`https://docs.example.test/a.pdf?${key}=private`);
    unsafe.push(`https://docs.example.test/a.pdf#${key}=private`);
  }
  for (const technicalSheetUrl of unsafe) {
    const payload = changedDocument({ agro_product_profile: { technicalSheetUrl } });
    const view = model(payload);
    assert.equal(view.state, "published");
    assert.equal(view.publication.resources.length, 0, technicalSheetUrl);
    assert.equal(view.publication.omittedResource, true);
    assert.doesNotMatch(markup(payload), /href=|private|user:password/);
  }
});

test("both supplied document resources retain their own visible hosts", () => {
  const payload = changedDocument({ agro_product_profile: { technicalSheetUrl: "https://technical.example.test/a.pdf", safetySheetUrl: "https://safety.example.test/b.pdf#page=3" } });
  assert.deepEqual(model(payload).publication.resources.map(resource => [resource.kind, resource.host]), [["technical", "technical.example.test"], ["safety", "safety.example.test"]]);
  assert.match(markup(payload), /data-current-resource-kind="safety"/);
});

test("all interface locales preserve published text and identify the content language", () => {
  for (const [locale, title, contentLanguage] of [["es-AR", "Ficha editorial vigente", "Portugués"], ["en", "Current editorial passport", "Portuguese"], ["pt-BR", "Ficha editorial vigente", "Português"]]) {
    const html = markup(base, locale);
    assert.ok(html.includes(title));
    assert.ok(html.includes(contentLanguage));
    assert.match(html, /lang="pt-BR" translate="no">Sementes novas/);
    assert.match(html, /data-sun-server-evidence="true"/);
  }
});

test("rendered identity is escaped and only public allowlisted fields are shown", () => {
  const payload = changedDocument({ identity: { ...base.document.identity, product_name: "<img src=x onerror=alert(1)>", uid: "private-uid", secret: "private-secret" } });
  const html = markup(payload);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img|private-uid|private-secret|contentDigest/);
});

test("presentation performs no requests, mutations, current-time inference or automatic translation", () => {
  const source = ["current-editorial-resources.tsx", "current-editorial-resources-model.ts"].map(file => readFileSync(new URL(`../src/app/sun/${file}`, import.meta.url), "utf8")).join("\n");
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|localStorage|sessionStorage|Date\.now|new Date\(\)|create.*Token|onClick|<form|dangerouslySetInnerHTML/);
  const before = JSON.stringify(base);
  model(base);
  assert.equal(JSON.stringify(base), before);
});

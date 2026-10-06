import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as availability from "../src/app/sun/tenant-action-availability.ts";

const require = createRequire(import.meta.url);
const root = new URL("../src/app/me/", import.meta.url);
const source = readFileSync(new URL("taps/[eventId]/page.tsx", root), "utf8");
const css = readFileSync(new URL("taps/[eventId]/reading.module.css", root), "utf8");
function compile(source, overrides = {}) {
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", js)((name) => Object.hasOwn(overrides, name) ? overrides[name] : require(name), module, module.exports);
  return module.exports;
}
const taps = compile(readFileSync(new URL("_components/consumer-taps-model.ts", root), "utf8"));
const home = compile(readFileSync(new URL("_components/consumer-home-model.ts", root), "utf8"));
const styles = new Proxy({}, { get: (_, name) => String(name) });
const editorialModel = compile(readFileSync(new URL("../sun/current-editorial-resources-model.ts", root), "utf8"));
const editorial = compile(readFileSync(new URL("../sun/current-editorial-resources-view.tsx", root), "utf8"), {
  "./current-editorial-resources-model": editorialModel,
  "./current-editorial-resources.module.css": { __esModule: true, default: styles },
});
const publishedConfiguration = { version: availability.TENANT_ACTIONS_VERSION, status: "published", allowedActions: ["marketplace"], catalogAvailable: true, program: null, trivia: null };
function page(payload, denied = false, configuration = publishedConfiguration) {
  const calls = [];
  const Page = compile(source, {
    "../../_components/reading-current-notices":{ReadingCurrentNotices:()=>null},
    "../../../sun/current-editorial-resources-view": editorial,
    "../../../sun/tenant-action-availability": availability,
    "../../../../lib/public-tenant-configuration": { readPublicTenantConfiguration: async eventId => {
      if (!Number.isSafeInteger(Number(eventId))) return null;
      calls.push(["configuration", eventId]); return configuration;
    } },
    "next/link": { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) },
    "../../_components/consumer-api": { requireConsumerSession: async (next) => { calls.push(["auth", next]); if (denied) throw new Error("redirect-login"); }, fetchConsumerPath: async (path) => { calls.push(["fetch", path]); return payload; } },
    "../../_components/consumer-home-model": home,
    "../../_components/consumer-taps-model": taps,
    "../../_components/me-portal-interactive-client": { ConsumerDataRetryButton: () => React.createElement("button", null, "Reintentar carga") },
    "../../_components/portal-shell": { PortalShell: ({title, children}) => React.createElement("main", null, React.createElement("h1", null, title), children) },
    "./reading.module.css": {__esModule:true,default:styles},
  }).default;
  return { calls, render: async (id = "566") => renderToStaticMarkup(await Page({ params: Promise.resolve({ eventId: id }) })) };
}
const valid = {ok:true,item:{tap_event_id:"566",verdict:"VALID_CLOSED",risk_level:"low",created_at:"2026-09-08T13:30:00.000Z",tenant_slug:"qa-local",tenant_name:"Empresa de prueba",product_name:"Producto de prueba",bid:"LOTE-QA",city:"Mendoza",country:"AR"}};

test("private reading authenticates and validates its detail before reading public options", async () => {
  const subject = page(valid); await subject.render();
  assert.deepEqual(subject.calls, [["auth","/me/taps/566"],["fetch","taps/566"],["configuration","566"]]);
  const denied = page(valid,true); await assert.rejects(denied.render, /redirect-login/);
  assert.deepEqual(denied.calls, [["auth","/me/taps/566"]]);
});
test("invalid references never trigger arbitrary backend paths", async () => {
  for (const id of ["../me","0","-1","1.5","01","abc"," 566","566 ","+566","566\n","9223372036854775808","99999999999999999999"]) {
    const subject = page(valid); const html = await subject.render(id);
    assert.deepEqual(subject.calls, [["auth","/me/taps"]]);
    assert.match(html,/No pudimos abrir esta lectura/); assert.doesNotMatch(html,/Producto de prueba|Mendoza/);
  }
});
test("private detail accepts the exact API bigint string contract without losing precision", async () => {
  for (const id of ["9007199254740992", "9007199254740993", "9223372036854775807"]) {
    const subject = page({ ...valid, item: { ...valid.item, tap_event_id: id } });
    const html = await subject.render(id);
    assert.deepEqual(subject.calls, [["auth", `/me/taps/${id}`], ["fetch", `taps/${id}`]]);
    assert.match(html, /Producto de prueba/);
    assert.match(html, new RegExp(`Referencia #${id}`));
    assert.doesNotMatch(html, /No pudimos abrir esta lectura/);
  }
  const mismatched = page({ ...valid, item: { ...valid.item, tap_event_id: "9007199254740992" } });
  const html = await mismatched.render("9007199254740993");
  assert.match(html, /No pudimos abrir esta lectura/);
  assert.doesNotMatch(html, /Producto de prueba|Mendoza/);
});
test("failed, malformed, mismatched or unavailable reads never display private data or fake an empty history", async () => {
  for (const payload of [null,{ok:false,item:valid.item},{ok:true,item:null},{ok:true,item:[]},{ok:true,item:{...valid.item,tap_event_id:567}}]) {
    const html = await page(payload).render();
    assert.match(html,/No pudimos abrir esta lectura/); assert.match(html,/Reintentar carga/);
    assert.doesNotMatch(html,/Producto de prueba|Mendoza|Riesgo reportado:|certificado|No hay lecturas/);
  }
});
test("reported detail contains an actual result, categorical risk and UTC time with useful account actions", async () => {
  const html = await page(valid).render();
  assert.match(html,/Producto de prueba/); assert.match(html,/Empresa de prueba/); assert.match(html,/LOTE-QA/);
  assert.match(html,/Mendoza, AR/); assert.match(html,/13:30/); assert.match(html,/UTC/);
  assert.match(html,/Acceso privado/); assert.match(html,/href="\/me\/taps"/); assert.match(html,/href="\/me\/products"/);
  assert.match(html,/href="\/me\/marketplace\?tenant=qa-local"/); assert.match(html,/<details/);
  assert.doesNotMatch(html,/NaN|Risk Level|certificado|share=|authToken|Compartir públicamente/);
});
test("missing fields remain unreported and detail never injects a brand or catalog tenant", async () => {
  const html = await page({ok:true,item:{tap_event_id:566}}).render();
  assert.match(html,/Marca no informada/); assert.match(html,/Lectura #566/);
  assert.doesNotMatch(html,/Balmec|Mendoza|href="\/me\/marketplace|Riesgo reportado: 0|NaN/);
});
test("detail provides both themes, touch controls, mobile layout and reduced motion", () => {
  assert.match(css,/html\[data-theme="dark"\]/); assert.match(css,/:focus-visible/);
  assert.match(css,/min-height: 46px/); assert.match(css,/@media \(max-width: 520px\)/); assert.match(css,/prefers-reduced-motion/);
  assert.doesNotMatch(source,/setInterval|Math\.random|window\.location|public\/certificates|shareToken/);
});

const publication = { protocol: "nexid.current-editorial.v1", source: "passport_studio", state: "published", observedAt: "2026-10-05T15:00:00Z", version: 3,
  publishedAt: "2026-10-04T15:00:00Z", contentDigest: "a".repeat(64), document: { schemaVersion: "nexid.passport-editorial.v1", template: "agro", locale: "es-AR",
    identity: { product_name: "Producto actual publicado", public_lot_label: "PUBLICADO-3", sku: null, winery: "Empresa actual publicada", region: null, image_url: null },
    agro_product_profile: { technicalSheetUrl: "https://docs.example.test/current.pdf", safetySheetUrl: null } } };
test("the current tenant publication stays separate from the saved reading and options", async () => {
  const subject = page({ ...valid, currentEditorial: publication, item: { ...valid.item, product_name: "Producto actual publicado", brand_name: "Empresa actual publicada",
    historical_product_name: "Producto histórico", historical_brand_name: "Empresa histórica" } });
  const html = await subject.render();
  assert.deepEqual(subject.calls, [["auth", "/me/taps/566"], ["fetch", "taps/566"], ["configuration", "566"]]);
  assert.match(html, /<h2>Producto histórico<\/h2>/);
  assert.match(html, /Empresa histórica/);
  assert.match(html, /Ficha editorial vigente/);
  assert.match(html, /Producto actual publicado/);
  assert.match(html, /data-editorial-state="published"/);
  assert.match(html, /No modifica su resultado ni habilita acciones protegidas/);
  assert.match(html, /current\.pdf/);
  assert.doesNotMatch(html, /fresh_token|freshToken|Guardar puntos|canje/);
});
test("withdrawn or missing contextual catalog settings preserve account history without a brand CTA", async () => {
  for (const configuration of [null, { ...publishedConfiguration, status: "unpublished" }, { ...publishedConfiguration, catalogAvailable: false }, { ...publishedConfiguration, allowedActions: [] }]) {
    const html = await page(valid, false, configuration).render();
    assert.match(html, /Producto de prueba/); assert.match(html, /href="\/me\/products"/); assert.doesNotMatch(html, /Ver catálogo de la marca/);
  }
});
test("withdrawn, invalid and unavailable editorial content never fall back to historical documents", async () => {
  for (const state of ["withdrawn", "unpublished", "legacy", "invalid", "unavailable"]) {
    const html = await page({ ...valid, item: { ...valid.item, currentEditorial: { ...publication, state }, technicalSheetUrl: "https://docs.example.test/historical.pdf" } }).render();
    assert.match(html, new RegExp(`data-editorial-state="${state}"`));
    assert.match(html, /Producto de prueba/);
    assert.doesNotMatch(html, /Producto actual publicado|current\.pdf|historical\.pdf/);
  }
  const unavailable = await page(valid).render();
  assert.match(unavailable, /data-editorial-state="unavailable"/);
});
test("unauthorized or mismatched details never render a current publication", async () => {
  for (const payload of [{ ok: false, currentEditorial: publication, item: valid.item }, { ok: true, currentEditorial: publication, item: { ...valid.item, tap_event_id: "567" } }]) {
    const html = await page(payload).render();
    assert.doesNotMatch(html, /Producto actual publicado|current\.pdf|Ficha editorial vigente/);
  }
});

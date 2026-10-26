import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const dir = new URL("../src/app/me/", import.meta.url);
const css = { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
function compile(path, overrides) {
  const source = readFileSync(new URL(path, dir), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", js)(name => Object.hasOwn(overrides, name) ? overrides[name] : require(name), loaded, loaded.exports);
  return loaded.exports;
}
const payload = (consents = [], consumer = {}) => ({ ok: true, consumer, consents });
const ready = data => ({ status: "ready", data });
const brand = { tenant_id: "tenant-A", name: "Marca sintética A", slug: "brand-a" };
const consent = { tenant_id: "tenant-A", scope: "whatsapp", granted: true };
const homeModel = compile("_components/consumer-home-model.ts", {});
function setup(options = {}) {
  const calls = [];
  const Page = compile("privacy/page.tsx", {
    "next/link": { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) },
    "next/navigation": { redirect: path => { calls.push(["redirect", path]); throw Error("redirect-login"); } },
    "../_components/consumer-api": {
      buildConsumerNextPath: (path, params) => { const query = new URLSearchParams(); for (const [key, value] of Object.entries(params || {})) for (const entry of Array.isArray(value) ? value : [value]) if (entry) query.append(key, entry); return query.size ? path + "?" + query : path; },
      readConsumerSession: async next => { calls.push(["session", next]); if (options.sessionRedirect) throw Error("redirect-login"); return { status: options.session || "ready" }; },
      readConsumerPrivacyPath: async path => { calls.push(["private", path]); return Object.hasOwn(options, path) ? options[path] : ready(path === "privacy" ? payload([consent]) : { ok: true, items: [brand] }); },
    },
    "../_components/portal-shell": { PortalShell: ({ children, title, subtitle }) => React.createElement("main", null, React.createElement("h1", null, title), React.createElement("p", null, subtitle), children) },
    "../_components/consumer-portal-recovery": { ConsumerPortalUnavailable: () => React.createElement("h1", { "data-testid": "consumer-portal-unavailable" }, "Sesión no disponible") },
    "../_components/me-portal-interactive-client": { ConsumerDataRetryButton: () => React.createElement("button", { type: "button" }, "Reintentar carga") },
    "../_components/consumer-home-model": homeModel,
    "../_components/consumer-list-recovery.module.css": css, "../brands/brands.module.css": css,
  }).default;
  return { calls, render: async (params = {}) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params) })) };
}
function reader(result) {
  const calls = [];
  const api = compile("_components/consumer-api.ts", {
    "next/headers": { headers: async () => new Headers({ cookie: "synthetic_session=qa", "user-agent": "synthetic-privacy-qa" }) },
    "next/navigation": { redirect: () => { throw Error("unexpected-redirect"); } },
    "../../api/_lib/consumer-tap-handoff": { stripConsumerTapCapabilityCookies: value => value },
    "./consumer-bounded-fetch": { fetchConsumerJson: async (url, init, options) => { calls.push({ url, init, options }); return result; }, consumerSessionState: () => "authenticated" },
    "@product/config": { productUrls: { api: "https://api.nexid.lat" } },
    "../../api/_lib/server-api-transport": { fetchRuntimeApi: () => { throw Error("unexpected-network"); } },
  });
  return { api, calls };
}

test("privacy reader preserves 401 and 403 separately from unavailable reads", async () => {
  for (const [result, expected] of [[{ status: "http-error", httpStatus: 401 }, "unauthenticated"], [{ status: "http-error", httpStatus: 403 }, "forbidden"], [{ status: "http-error", httpStatus: 503 }, "unavailable"], [{ status: "unavailable", reason: "timeout" }, "unavailable"], [{ status: "unavailable", reason: "network" }, "unavailable"]]) {
    assert.deepEqual(await reader(result).api.readConsumerPrivacyPath("privacy"), { status: expected });
  }
});
test("privacy reader accepts only an explicit successful record and retains the bounded authenticated read", async () => {
  for (const data of [null, [], {}, { ok: false }, { ok: "true" }]) assert.deepEqual(await reader(ready(data)).api.readConsumerPrivacyPath("brands"), { status: "unavailable" });
  const data = payload(), subject = reader(ready(data));
  assert.deepEqual(await subject.api.readConsumerPrivacyPath("privacy"), ready(data));
  assert.equal(subject.calls.length, 1); assert.equal(subject.calls[0].url, "https://api.nexid.lat/consumer/privacy");
  assert.equal(subject.calls[0].init.cache, "no-store"); assert.equal(subject.calls[0].init.headers.cookie, "synthetic_session=qa");
  assert.equal(Object.hasOwn(subject.calls[0].init, "method"), false);
});
test("uncertain sessions recover before privacy or brand reads and retain the query", async () => {
  const subject = setup({ session: "unavailable" }), html = await subject.render({ fromTap: "1", filter: ["a", "b"] });
  assert.match(html, /consumer-portal-unavailable/); assert.deepEqual(subject.calls, [["session", "/me/privacy?fromTap=1&filter=a&filter=b"]]);
});
test("normal session login redirect stays before all permission reads", async () => {
  const subject = setup({ sessionRedirect: true }); await assert.rejects(subject.render(), /redirect-login/);
  assert.deepEqual(subject.calls, [["session", "/me/privacy"]]);
});
test("confirmed privacy denial is never shown as missing permissions", async () => {
  const html = await setup({ privacy: { status: "forbidden" } }).render();
  assert.match(html, /consumer-privacy-forbidden/); assert.match(html, /Acceso denegado/);
  assert.doesNotMatch(html, /consumer-privacy-empty|No hay permisos registrados|La información de tu cuenta/);
});
test("unavailable and malformed privacy envelopes recover instead of claiming an empty list", async () => {
  for (const privacy of [{ status: "unavailable" }, ready({ ok: true }), ready({ ok: false, consents: [] }), ready({ ok: true, consents: [null] }), ready({ ok: true, consents: [[]] })]) {
    const html = await setup({ privacy }).render(); assert.match(html, /consumer-privacy-unavailable/); assert.match(html, /Reintentar carga/); assert.doesNotMatch(html, /consumer-privacy-empty/);
  }
});
test("only validated empty permissions show the empty state without inventing account details", async () => {
  const html = await setup({ privacy: ready(payload()), brands: { status: "unavailable" } }).render();
  assert.match(html, /consumer-privacy-empty/); assert.match(html, /Nombre no informado/); assert.match(html, /Contacto no disponible en esta consulta/);
  assert.doesNotMatch(html, /consumer-privacy-brands-unavailable|Español/);
});
test("privacy presents the reported account contact without exposing a full phone or inventing email trouble", async () => {
  const phoneOnly = await setup({ privacy: ready(payload([], { phone: "+5491112345678", status: "registered" })) }).render();
  assert.match(phoneOnly, /Teléfono de tu cuenta/); assert.match(phoneOnly, /Terminado en 5678/);
  assert.doesNotMatch(phoneOnly, /5491112345678|Correo no informado|WhatsApp verificado/);
  const email = await setup({ privacy: ready(payload([], { email: "qa@example.test", phone: "+5491112345678" })) }).render();
  assert.match(email, /qa@example.test/); assert.doesNotMatch(email, /Terminado en/);
  const malformed = await setup({ privacy: ready(payload([], { phone: { invalid: true } })) }).render();
  assert.match(malformed, /Contacto no disponible en esta consulta/); assert.match(malformed, /consumer-privacy-empty/);
});
test("reported purposes and strict booleans have human labels and exact owned brand identity", async () => {
  const rows = ["whatsapp", "whatsapp_marketing", "promotions", "campaigns"].map((scope, index) => ({ ...consent, scope, granted: index % 2 === 0 }));
  const html = await setup({ privacy: ready(payload(rows, { display_name: "Persona sintética", preferred_locale: "es-AR" })) }).render();
  for (const text of ["Tus permisos con las marcas", "Marca sintética A", "Mensajes por WhatsApp", "Promociones por WhatsApp", "Promociones de la marca", "Campañas de la marca", "Autorizado", "No autorizado", "Persona sintética"]) assert.ok(html.includes(text));
  assert.doesNotMatch(html, /tenant-A|whatsapp_marketing|granted|revoked|por tenant|si existe en esquema/);
});
test("names and normalized or case-different IDs cannot borrow another brand's name", async () => {
  for (const candidate of [{ ...brand, tenant_id: "tenant-a" }, { ...brand, tenant_id: " tenant-A " }, { slug: "tenant-A", name: "Marca sintética A" }]) {
    const html = await setup({ brands: ready({ ok: true, items: [candidate] }) }).render();
    assert.match(html, /Marca sin nombre informado/); assert.doesNotMatch(html, /Marca sintética A/);
  }
});
test("ambiguous duplicate membership identities never supply a display name", async () => {
  const html = await setup({ brands: ready({ ok: true, items: [brand, { ...brand, name: "Otra marca sintética" }] }) }).render();
  assert.match(html, /Marca sin nombre informado/); assert.doesNotMatch(html, /Marca sintética A|Otra marca sintética/);
});
test("denied or malformed brand reads keep reported permissions without a fabricated brand name", async () => {
  for (const brands of [{ status: "forbidden" }, { status: "unavailable" }, ready({ ok: true, items: [null] }), ready({ ok: false, items: [] })]) {
    const html = await setup({ brands }).render(); assert.match(html, /consumer-privacy-brands-unavailable/); assert.match(html, /Mensajes por WhatsApp/); assert.match(html, /Autorizado/); assert.doesNotMatch(html, /consumer-privacy-empty/);
    if (brands.status === "forbidden") assert.match(html, /Acceso denegado a los nombres/);
  }
});
test("all returned permission rows are visible instead of silently truncating at eight", async () => {
  const html = await setup({ privacy: ready(payload(Array.from({ length: 9 }, () => ({ ...consent })))) }).render();
  assert.equal(html.split("<strong>Mensajes por WhatsApp</strong>").length - 1, 9);
});
test("unknown purpose and missing or nonboolean grants remain explicitly unconfirmed", async () => {
  for (const granted of [undefined, null, "false", 0]) {
    const html = await setup({ privacy: ready(payload([{ ...consent, scope: "future_permission", granted }])) }).render();
    assert.match(html, /Propósito no identificado/); assert.match(html, /Estado no informado/); assert.match(html, /Ver referencia del permiso/); assert.match(html, /future_permission/); assert.doesNotMatch(html, /No autorizado|>Autorizado</);
  }
});
test("unidentified tenant rows remain separate instead of assigning them to one company", async () => {
  const html = await setup({ privacy: ready(payload([{ scope: "whatsapp", granted: true }, { scope: "campaigns", granted: false }])) }).render();
  assert.equal((html.match(/<h2 id="privacy-brand-/g) || []).length, 2);
});
test("a confirmed 401 during either read returns to normal login with full next query", async () => {
  for (const path of ["privacy", "brands"]) {
    const subject = setup({ [path]: { status: "unauthenticated" } }); await assert.rejects(() => subject.render({ fromTap: "1" }), /redirect-login/);
    assert.deepEqual(subject.calls.at(-1), ["redirect", "/login?consumer=1&next=%2Fme%2Fprivacy%3FfromTap%3D1"]);
  }
});
test("reported text is escaped and the permission view exposes no consent write controls", async () => {
  const html = await setup({ privacy: ready(payload([{ ...consent, scope: "<script>scope</script>" }])), brands: ready({ ok: true, items: [{ ...brand, name: "<script>brand</script>" }] }) }).render();
  assert.ok(html.includes("&lt;script&gt;brand&lt;/script&gt;")); assert.ok(html.includes("&lt;script&gt;scope&lt;/script&gt;"));
  assert.doesNotMatch(html, /<script>|<form|<input|Revocar|Otorgar permiso|Aceptar permiso/);
});

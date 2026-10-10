import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as model from "../src/app/me/passport/passport-account-model.ts";

const require = createRequire(import.meta.url);
const directory = new URL("../src/app/me/passport/", import.meta.url);
function compile(file, overrides) {
  const source = readFileSync(new URL(file, directory), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", output)(name => Object.hasOwn(overrides, name) ? overrides[name] : require(name), module, module.exports);
  return module.exports;
}
const Link = ({ prefetch, ...props }) => React.createElement("a", props);
const presentation = compile("passport-account-panel.tsx", {
  "next/link": Link,
  "../_components/me-portal-interactive-client": { ConsumerDataRetryButton: () => React.createElement("button", { type: "button" }, "Reintentar carga") },
  "./passport.module.css": new Proxy({}, { get: (_, key) => String(key) }),
});
const payload = (consumer = {}, stats = {}) => ({ ok: true, consumer: { id: "synthetic-consumer", ...consumer }, stats });
const ready = (consumer, stats) => model.passportAccountModel(payload(consumer, stats));
const render = (account, tenant = null) => renderToStaticMarkup(React.createElement(presentation.PassportAccountPanel, { account, tenant }));

test("a failed, malformed or incomplete account read is unavailable, never an initial or pending identity", () => {
  for (const input of [null, undefined, [], { ok: false, consumer: { id: "synthetic-consumer" } }, { consumer: { id: "synthetic-consumer" } }, { ok: true, consumer: null }, { ok: true, consumer: [] }, { ok: true, consumer: {} }, payload({ id: " " })]) {
    assert.deepEqual(model.passportAccountModel(input), { state: "unavailable" });
  }
});

test("the deployed consumer status is used independently from unsupported passport_status", () => {
  const states = { registered: "Registrada", verified: "Verificada", anonymous: "De consulta" };
  for (const [state, label] of Object.entries(states)) {
    const account = ready({ status: state, passport_status: "pending" });
    assert.deepEqual(account.status, { state, label });
    assert.match(render(account), /Cada lectura muestra sus propias verificaciones/);
  }
  for (const value of [undefined, null, "pending", "NEW_STATUS", {}, 7]) {
    const account = ready({ status: value, passport_status: "verified" });
    assert.deepEqual(account.status, { state: "unknown", label: "No informado" });
    assert.doesNotMatch(render(account), /Cuenta inicial|PENDING|Cuenta validada|Identidad verificada/);
  }
});

test("email and WhatsApp account contacts remain distinct and neither channel is invented", () => {
  const email = ready({ email: " person@example.invalid ", display_name: "PERSON@EXAMPLE.INVALID" });
  assert.equal(email.name, null);
  assert.deepEqual(email.contacts, [{ channel: "email", label: "Correo electrónico", value: "person@example.invalid" }]);
  const phone = ready({ phone: "+541155551234", display_name: "Cliente de ejemplo" });
  assert.deepEqual(phone.contacts, [{ channel: "whatsapp", label: "WhatsApp", value: "+541155551234" }]);
  assert.equal(phone.name, "Cliente de ejemplo");
  assert.match(render(phone), /WhatsApp/);
  assert.doesNotMatch(render(phone), /email no validado|Correo electrónico/);
  assert.equal(ready({ email: "person@example.invalid", phone: "+541155551234" }).contacts.length, 2);
  assert.deepEqual(ready({ email: 1, phone: {}, display_name: " " }).contacts, []);
  assert.match(render(ready({})), /no informó un contacto/);
});

test("real zero counts stay zero while missing or invalid independent counts are not reported as zero", () => {
  assert.deepEqual(ready({}, { products: 0, taps: 4, memberships: 2 }).counts, { products: 0, taps: 4, memberships: 2 });
  assert.deepEqual(ready({}, { products: 7 }).counts, { products: 7, taps: null, memberships: null });
  for (const value of [null, "0", -1, 1.25, Number.MAX_SAFE_INTEGER + 1, Infinity, false]) {
    assert.deepEqual(ready({}, { products: value, taps: value, memberships: value }).counts, { products: null, taps: null, memberships: null });
  }
  const html = render(ready({}, { products: 0 }));
  assert.match(html, /Productos guardados: 0/);
  assert.match(html, /Lecturas guardadas: no informado/);
  assert.match(html, /Marcas registradas: no informado/);
});

test("only canonical single tenant queries scope consultation links and grant no tap action", () => {
  for (const value of ["syngenta", "valle-secreto", "a.b_1"]) assert.equal(model.passportTenant(value), value);
  for (const value of [null, [], ["syngenta"], "", " Syngenta ", "../other", "https://example.invalid", "valid&eventId=9", "a".repeat(121)]) assert.equal(model.passportTenant(value), null);
  const html = render(ready({}), "valle-secreto");
  for (const path of ["brands", "rewards", "wallet", "marketplace"]) assert.match(html, new RegExp(`href="/me/${path}\\?tenant=valle-secreto"`));
  assert.match(html, /href="\/me\/products"/);
  assert.match(html, /href="\/me\/taps"/);
  assert.doesNotMatch(html, /fromTap|eventId|action=|login|claim|purchase/);
  const generic = render(ready({}));
  assert.doesNotMatch(generic, /tenant=/);
});

test("account presentation escapes contacts and offers consultations without purchase, linking or identity claims", () => {
  const html = render(ready({ display_name: "<script>test</script>", email: "<img>@example.invalid" }));
  assert.match(html, /&lt;script&gt;test&lt;\/script&gt;/);
  assert.match(html, /&lt;img&gt;@example.invalid/);
  assert.doesNotMatch(html, /<script>|<img>|<form|<input|<button|NFT|Premium|DOCUMENTO DE IDENTIDAD|ownership|Memberships|Canjear|Comprar/);
  assert.match(html, /Revisar contactos/);
  assert.match(html, /Explorar catálogo/);
  assert.match(html, /Mis puntos y registros/);
});

function pageSetup({ session = { status: "ready" }, accountPayload = payload({ email: "person@example.invalid" }), params = {} } = {}) {
  const calls = [];
  const page = compile("page.tsx", {
    "../_components/consumer-api": {
      buildConsumerNextPath: (path, query) => `${path}${Object.keys(query).length ? `?${new URLSearchParams(query)}` : ""}`,
      readConsumerSession: async path => { calls.push(["session", path]); return session; },
      fetchConsumerMe: async () => { calls.push(["me"]); return accountPayload; },
    },
    "../_components/consumer-portal-recovery": { ConsumerPortalUnavailable: () => React.createElement("main", { "data-session-unavailable": true }, "No pudimos consultar tu sesión") },
    "../_components/portal-shell": { PortalShell: ({ title, subtitle, children }) => React.createElement("main", { "data-portal-shell": true }, React.createElement("h1", null, title), React.createElement("p", null, subtitle), children) },
    "./passport-account-model": model,
    "./passport-account-panel": presentation,
  }).default;
  return { render: async () => renderToStaticMarkup(await page({ searchParams: Promise.resolve(params) })), calls };
}

test("unavailable session cannot read or render private account data and preserves its consultation route", async () => {
  const setup = pageSetup({ session: { status: "unavailable" }, params: { tenant: "valle-secreto" } });
  const html = await setup.render();
  assert.match(html, /data-session-unavailable="true"/);
  assert.deepEqual(setup.calls, [["session", "/me/passport?tenant=valle-secreto"]]);
  assert.doesNotMatch(html, /person@example|Estado de la cuenta/);
});

test("failed account read retains the account shell and manual retry without false logout or empty account", async () => {
  for (const accountPayload of [null, { ok: false }, { ok: true, consumer: null }]) {
    const setup = pageSetup({ accountPayload });
    const html = await setup.render();
    assert.match(html, /data-portal-shell="true"/);
    assert.match(html, /No pudimos cargar los datos de tu cuenta/);
    assert.match(html, /role="status"/);
    assert.match(html, /Reintentar carga/);
    assert.match(html, /Tus productos y contactos no se modificaron/);
    assert.doesNotMatch(html, /Cuenta inicial|pending|email no validado|Estado de la cuenta|Productos guardados: 0|iniciá sesión|href="\/login/);
    assert.deepEqual(setup.calls, [["session", "/me/passport"], ["me"]]);
  }
});

test("ready page reflects its own phone and real counts, ignores caller identity and scopes only valid tenant", async () => {
  const setup = pageSetup({ accountPayload: payload({ phone: "+541155551234", status: "registered" }, { products: 3, taps: 5, memberships: 1 }), params: { tenant: "valle-secreto", email: "other@example.invalid", status: "verified", eventId: "999" } });
  const html = await setup.render();
  assert.match(html, /Mi cuenta y mis registros/);
  assert.match(html, /\+541155551234/);
  assert.match(html, /Productos guardados: 3/);
  assert.match(html, /data-account-state="registered"/);
  assert.doesNotMatch(html, /other@example|data-account-state="verified"|eventId=999|Reintentar carga/);
  assert.deepEqual(setup.calls.map(call => call[0]), ["session", "me"]);
  const invalidTenant = pageSetup({ params: { tenant: "../other" } });
  assert.doesNotMatch(await invalidTenant.render(), /href="[^\"]+tenant=/);
});

test("page and model cannot start writes, refresh a physical tap, associate accounts or fabricate unavailable identity", () => {
  const sources = ["page.tsx", "passport-account-model.ts", "passport-account-panel.tsx"].map(file => readFileSync(new URL(file, directory), "utf8")).join("\n");
  assert.doesNotMatch(sources, /fetch\(|method:\s*["'](?:POST|PATCH|DELETE)|associate\/(?:start|verify)|useEffect|setInterval|window\.location|\/sun\?/);
  assert.doesNotMatch(sources, /passport_status\s*\|\||Cuenta inicial|email no validado|Premium Passport|DOCUMENTO DE IDENTIDAD/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as policy from "../src/app/me/security/consumer-contact-security-policy.ts";

const require = createRequire(import.meta.url);
const directory = new URL("../src/app/me/security/", import.meta.url);
function compile(file, overrides) {
  const source = readFileSync(new URL(file, directory), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", output)(name => Object.hasOwn(overrides, name) ? overrides[name] : require(name), module, module.exports);
  return module.exports;
}
const Link = ({ prefetch, ...props }) => React.createElement("a", props);
const { SecurityPanel } = compile("security-panel.tsx", {
  "next/link": Link,
  "./consumer-contact-security-policy": policy,
  "./security-panel.module.css": new Proxy({}, { get: (_, key) => String(key) }),
});
const account = (contacts = {}) => ({ id: "synthetic-consumer", ...contacts });
const render = contacts => renderToStaticMarkup(React.createElement(SecurityPanel, { initialConsumer: account(contacts) }));

test("disabled 503 association contract has a truthful message and no format-error recovery", () => {
  assert.deepEqual({ available: policy.CONSUMER_CONTACT_LINKING.available, state: policy.CONSUMER_CONTACT_LINKING.state, httpStatus: policy.CONSUMER_CONTACT_LINKING.httpStatus, error: policy.CONSUMER_CONTACT_LINKING.error }, {
    available: false, state: "feature_disabled", httpStatus: 503, error: "contact_linking_temporarily_unavailable",
  });
  const html = render({ email: "person@example.invalid" });
  assert.match(html, /data-contact-linking-state="feature_disabled"/);
  assert.match(html, /temporalmente deshabilitada/);
  assert.match(html, /Tus contactos actuales se conservan/);
  assert.doesNotMatch(html, /Revisá el formato|Generando código|Código enviado|Enviar código|Verificar y vincular/);
});

test("one contact remains visible without offering an impossible association", () => {
  for (const contacts of [{ email: "person@example.invalid" }, { phone: "+541155551234" }]) {
    const model = policy.buildConsumerContactSecurityModel(account(contacts));
    assert.equal(model.contacts.length, 1);
    assert.equal(model.hasBothLinkedChannels, false);
    assert.equal(model.linking.available, false);
    const html = render(contacts);
    assert.match(html, /usá el mismo contacto con el que los guardaste/);
    assert.doesNotMatch(html, /<(?:form|input|button)\b|figuran en la misma cuenta/);
  }
});

test("existing linked contacts do not imply a new verification, MFA, loyalty bonus or account merge", () => {
  const contacts = { email: "person@example.invalid", phone: "+541155551234", status: "verified" };
  assert.equal(policy.buildConsumerContactSecurityModel(account(contacts)).hasBothLinkedChannels, true);
  const html = render(contacts);
  assert.match(html, /Tu email y tu WhatsApp figuran en la misma cuenta/);
  assert.match(html, /no agrega una segunda verificación al ingreso/);
  assert.doesNotMatch(html, /Doble factor activo|Bono|Beneficio de asociación|<button\b|<form\b/);
});

test("empty or malformed contact projections do not invent linked channels", () => {
  for (const contacts of [{}, { email: " ", phone: null }, { email: 3, phone: {} }]) {
    const model = policy.buildConsumerContactSecurityModel(account(contacts));
    assert.deepEqual(model.contacts, []);
    assert.equal(model.hasBothLinkedChannels, false);
    assert.match(render(contacts), /No pudimos mostrar tus contactos/);
  }
});

test("contact content is escaped and navigation preserves the current account without starting login or mutations", () => {
  const html = render({ email: "<script>bad</script>@example.invalid" });
  assert.match(html, /&lt;script&gt;bad&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>|href="\/login|<form|<button|<input/);
  assert.match(html, /href="\/me"/);
  const source = readFileSync(new URL("security-panel.tsx", directory), "utf8");
  assert.doesNotMatch(source, /fetch\(|associate\/(?:start|verify)|window\.location|useEffect|useState/);
});

function pageSetup({ session = { status: "ready" }, consumer = account({ email: "person@example.invalid" }) } = {}) {
  const calls = [];
  const page = compile("page.tsx", {
    "../_components/consumer-api": {
      buildConsumerNextPath: path => path,
      readConsumerSession: async path => { calls.push(["session", path]); return session; },
      fetchConsumerMe: async () => { calls.push(["me"]); return consumer ? { consumer, stats: {} } : null; },
    },
    "../_components/consumer-portal-recovery": { ConsumerPortalUnavailable: () => React.createElement("main", { "data-unavailable": true }, "Reintentar") },
    "../_components/portal-shell": { PortalShell: ({ title, subtitle, children }) => React.createElement("main", null, React.createElement("h1", null, title), React.createElement("p", null, subtitle), children) },
    "./security-panel": { SecurityPanel },
  }).default;
  return { page, calls };
}

test("unavailable session is recovered without reading or displaying contacts", async () => {
  const { page, calls } = pageSetup({ session: { status: "unavailable" } });
  const html = renderToStaticMarkup(await page({}));
  assert.match(html, /data-unavailable="true"/);
  assert.deepEqual(calls, [["session", "/me/security"]]);
  assert.doesNotMatch(html, /person@example|Vincular/);
});

test("failed account read gives retry instead of claiming logout or asking to enter again", async () => {
  const { page, calls } = pageSetup({ consumer: null });
  const html = renderToStaticMarkup(await page({}));
  assert.match(html, /Reintentar/);
  assert.doesNotMatch(html, /iniciá sesión|Login|Vincular/);
  assert.deepEqual(calls, [["session", "/me/security"], ["me"]]);
});

test("ready account renders honest availability after its session and own contact read", async () => {
  const { page, calls } = pageSetup();
  const html = renderToStaticMarkup(await page({}));
  assert.match(html, /Revisá los contactos de tu cuenta y las opciones disponibles/);
  assert.match(html, /Por ahora no disponible/);
  assert.match(html, /person@example.invalid/);
  assert.deepEqual(calls, [["session", "/me/security"], ["me"]]);
});

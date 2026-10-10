import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { setImmediate as nextTurn } from "node:timers/promises";
import React from "react";
import ts from "typescript";
import * as delivery from "../src/app/login/consumer-login-delivery.ts";

const require = createRequire(import.meta.url);
const compile = (text, filename) => ts.transpileModule(text, { fileName: filename, compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
} }).outputText;
const source = readFileSync(new URL("../src/app/me/security/security-panel.tsx", import.meta.url), "utf8");
const panelCode = compile(source, "security-panel.tsx");
const contactModule = { exports: {} };
new Function("require", "module", "exports", compile(readFileSync(new URL("../src/components/consumer-contact-input.tsx", import.meta.url), "utf8"), "consumer-contact-input.tsx"))(require, contactModule, contactModule.exports);
const contact = contactModule.exports;

function walk(element, predicate) {
  if (!React.isValidElement(element)) return [];
  return [...(predicate(element) ? [element] : []), ...React.Children.toArray(element.props.children).flatMap(child => walk(child, predicate))];
}

function textOf(value) {
  if (React.isValidElement(value)) return textOf(value.props.children);
  if (Array.isArray(value)) return value.map(textOf).join("");
  return value == null || typeof value === "boolean" ? "" : String(value);
}

// Exercise the actual component handlers, JSX, contact validation and delivery
// helpers with deterministic state. Only React hook storage and fetch are local
// fixtures; this suite never opens a browser or contacts an OTP provider.
function fixture({ initialConsumer = { id: "account-1", email: "linked@example.test" }, respond } = {}) {
  const calls = [], navigations = [], slots = [];
  let cursor = 0;
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!Object.hasOwn(slots, index)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }];
    },
    useMemo(factory) { return factory(); },
  };
  const loaded = { exports: {} };
  const overrides = {
    react: hooks,
    "next/link": { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) },
    "../../login/consumer-login-delivery": delivery,
    "../../../components/consumer-contact-input": contact,
  };
  new Function("require", "module", "exports", "fetch", "window", panelCode)(
    name => Object.hasOwn(overrides, name) ? overrides[name] : require(name), loaded, loaded.exports,
    async (url, options) => {
      calls.push({ url, method: options.method, body: JSON.parse(options.body), headers: options.headers });
      return respond(url, options, calls.length);
    },
    { location: { set href(value) { navigations.push(value); } } },
  );
  const render = () => { cursor = 0; return loaded.exports.SecurityPanel({ initialConsumer }); };
  const find = predicate => walk(render(), predicate);
  const input = () => find(element => element.type === contact.ConsumerContactInput)[0];
  const button = label => find(element => element.type === "button" && textOf(element).includes(label))[0];
  const codeInput = () => find(element => element.type === "input" && element.props.autoComplete === "one-time-code")[0];
  return {
    calls, navigations, render, find, input, button, codeInput,
    choose(value) { input().props.onChange(contact.consumerContactDraftFromValue(value)); render(); },
    enterCode(value) { codeInput().props.onChange({ target: { value } }); render(); },
    click(label) { const action = button(label); assert.ok(action, label); assert.equal(action.props.disabled, false, label); action.props.onClick(); render(); },
    async settle() { await nextTurn(); return render(); },
    status() { return textOf(find(element => element.props.id === "security-association-status")[0]); },
    error() { return textOf(find(element => element.props.id === "security-association-error")[0]); },
  };
}

function response(status, payload) {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

const phone = "+5492611234567";
const email = "new@example.test";

for (const [channel, label, destination, initialConsumer] of [
  ["whatsapp", "WhatsApp", phone, { id: "account-1", email: "linked@example.test" }],
  ["sms", "SMS", phone, { id: "account-1", email: "linked@example.test" }],
  ["email", "email", email, { id: "account-1", phone }],
]) {
  test(`security ${channel} reports provider acceptance and waits for receipt`, async () => {
    const panel = fixture({ initialConsumer, respond: () => response(200, { ok: true, contact: destination, delivery: { channel, status: "accepted" } }) });
    panel.choose(destination);
    panel.click("Enviar código");
    await panel.settle();
    assert.match(panel.status(), new RegExp(`aceptada por ${label}`));
    assert.match(panel.status(), /La entrega todavía no está confirmada/);
    assert.match(panel.status(), /Ingresalo cuando llegue/);
    assert.ok(panel.status().includes(destination));
    assert.doesNotMatch(panel.status(), /Código enviado|entrega confirmada|MFA activo/i);
    assert.equal(panel.error(), "");
    assert.ok(panel.codeInput());
    assert.deepEqual(panel.navigations, []);
    assert.deepEqual(panel.calls.map(call => [call.url, call.method, call.body]), [
      ["/api/consumer/associate/start", "POST", channel === "email" ? { email } : { phone }],
    ]);
    const status = panel.find(element => element.props.id === "security-association-status")[0];
    assert.equal(status.props.role, "status");
  });
}

for (const [deliveryPayload, expected, absent] of [
  [{ deliveryChannel: "sms" }, /aceptada por SMS/, /WhatsApp/],
  [{ deliveryChannel: "email" }, /aceptada por email/, /WhatsApp/],
  [{ deliveryChannel: "email", delivery: { channel: "sms", status: "accepted" } }, /aceptada por SMS/, /aceptada por email|WhatsApp/],
  [{}, /aceptada por el canal de acceso/, /WhatsApp|aceptada por SMS/],
]) {
  test(`security retains accurate channel labels for ${JSON.stringify(deliveryPayload)}`, async () => {
    const panel = fixture({ respond: () => response(200, { ok: true, ...deliveryPayload }) });
    panel.choose(phone);
    panel.click("Enviar código");
    await panel.settle();
    assert.match(panel.status(), expected);
    assert.doesNotMatch(panel.status(), absent);
    assert.match(panel.status(), /entrega todavía no está confirmada/);
    assert.ok(panel.status().includes(phone), "The entered contact survives older responses that omit contact");
  });
}

for (const demo of [{ mode: "demo" }, { mode: '"demo"' }, { deliveryChannel: "demo" }]) {
  test(`security does not expose a real-code verification step for simulation ${JSON.stringify(demo)}`, async () => {
    const panel = fixture({ respond: () => response(200, { ok: true, ...demo }) });
    panel.choose(phone);
    panel.click("Enviar código");
    await panel.settle();
    assert.match(panel.error(), /modo de prueba y no envió un código real/);
    assert.equal(panel.status(), "");
    assert.equal(panel.codeInput(), undefined);
    assert.deepEqual(contact.consumerContactPayload(panel.input().props.draft), { phone });
    assert.deepEqual(panel.navigations, []);
  });
}

for (const [httpStatus, error, expected] of [
  [503, "contact_linking_temporarily_unavailable", /vinculación de contactos no está disponible ahora/],
  [401, "unauthorized", /confirmar tu sesión.*iniciar sesión/],
  [429, "rate_limited", /Demasiados intentos/],
  [409, "contact_already_linked", /ya está vinculado a otra cuenta/],
  [503, "meta_authentication_failed", /No pudimos confirmar la solicitud del código/],
  [503, "meta_delivery_timeout", /No pudimos confirmar la solicitud del código/],
  [500, "provider-private-content OTP 654321", /No pudimos confirmar la solicitud del código/],
]) {
  test(`security preserves contact and session after ${error}`, async () => {
    const panel = fixture({ respond: () => response(httpStatus, { ok: false, error }) });
    panel.choose(phone);
    panel.click("Enviar código");
    await panel.settle();
    assert.match(panel.error(), expected);
    assert.doesNotMatch(panel.error(), /Revisá el formato|654321|meta_authentication_failed|meta_delivery_timeout/);
    assert.equal(panel.status(), "", "An error must replace the requesting-code message");
    assert.equal(panel.codeInput(), undefined);
    assert.deepEqual(contact.consumerContactPayload(panel.input().props.draft), { phone });
    assert.equal(panel.button("Enviar código").props.disabled, false, "The preserved contact can be retried");
    assert.deepEqual(panel.calls.map(call => call.url), ["/api/consumer/associate/start"]);
    assert.deepEqual(panel.navigations, []);
    assert.equal(panel.find(element => element.props.id === "security-association-error")[0].props.role, "alert");
  });
}

for (const [name, respond] of [
  ["a network failure", () => { throw new Error("network-private-detail"); }],
  ["an unreadable successful response", () => new Response("<html>private upstream error</html>", { status: 200 })],
  ["a truthy non-boolean ok value", () => response(200, { ok: "true", contact: phone })],
  ["a non-success HTTP response with ok true", () => response(503, { ok: true, deliveryChannel: "whatsapp" })],
]) {
  test(`security rejects ${name} without losing contact`, async () => {
    const panel = fixture({ respond });
    panel.choose(phone);
    panel.click("Enviar código");
    await panel.settle();
    assert.match(panel.error(), /No pudimos confirmar la solicitud/);
    assert.doesNotMatch(panel.error(), /private|Código enviado/);
    assert.equal(panel.status(), "");
    assert.equal(panel.codeInput(), undefined);
    assert.deepEqual(contact.consumerContactPayload(panel.input().props.draft), { phone });
    assert.deepEqual(panel.navigations, []);
  });
}

for (const [error, expected] of [
  ["invalid_code", /incorrecto o expiró/],
  ["contact_linking_temporarily_unavailable", /no se vinculó ningún canal/],
  ["unauthorized", /confirmar tu sesión/],
  ["provider-private-detail", /No pudimos confirmar la vinculación/],
]) {
  test(`security verification ${error} keeps the exact pending contact and code`, async () => {
    const canonicalContact = "+5492617654321";
    const panel = fixture({ respond: url => url.endsWith("/start")
      ? response(200, { ok: true, contact: canonicalContact, delivery: { channel: "sms", status: "accepted" } })
      : response(error === "invalid_code" ? 400 : 503, { ok: false, error }) });
    panel.choose(phone);
    panel.click("Enviar código");
    await panel.settle();
    panel.enterCode("123456");
    panel.click("Verificar y vincular");
    await panel.settle();
    assert.match(panel.error(), expected);
    assert.equal(panel.status(), "");
    assert.equal(panel.codeInput().props.value, "123456");
    assert.equal(panel.button("Verificar y vincular").props.disabled, false);
    assert.deepEqual(panel.calls[1].body, { contact: canonicalContact, code: "123456" });
    assert.deepEqual(panel.navigations, []);
  });
}

test("security navigates only after the API confirms the association and retains its consumer session", async () => {
  const canonicalContact = "+5492617654321";
  const panel = fixture({ respond: url => url.endsWith("/start")
    ? response(200, { ok: true, contact: canonicalContact, delivery: { channel: "whatsapp", status: "accepted" } })
    : response(200, { ok: true, consumer: { id: "account-1", email: "linked@example.test", phone: canonicalContact } }) });
  panel.choose(phone);
  panel.click("Enviar código");
  await panel.settle();
  panel.enterCode("123456");
  panel.click("Verificar y vincular");
  assert.deepEqual(panel.navigations, []);
  await panel.settle();
  assert.deepEqual(panel.navigations, ["/me"]);
  assert.deepEqual(panel.calls.map(call => [call.url, call.method]), [
    ["/api/consumer/associate/start", "POST"], ["/api/consumer/associate/verify", "POST"],
  ]);
  assert.deepEqual(panel.calls[1].body, { contact: canonicalContact, code: "123456" });
  assert.match(textOf(panel.render()), /Canales de contacto vinculados/);
});

test("security offers session recovery without attempting association when no consumer is loaded", () => {
  const panel = fixture({ initialConsumer: null, respond: () => assert.fail("Unexpected request") });
  assert.match(textOf(panel.render()), /No se pudo cargar la sesión/);
  assert.equal(panel.find(element => element.props.href === "/login").length, 1);
  assert.equal(panel.input(), undefined);
  assert.deepEqual(panel.calls, []);
});

test("linked email and phone describe available access without asserting WhatsApp delivery or active MFA", () => {
  const panel = fixture({ initialConsumer: { id: "account-1", email, phone }, respond: () => assert.fail("Unexpected request") });
  const text = textOf(panel.render());
  assert.match(text, /Tenés un correo y un teléfono vinculados/);
  assert.match(text, /Podés pedir un código por los medios de acceso disponibles/);
  assert.equal(panel.find(element => element.type === "span" && textOf(element).trim() === "Teléfono").length, 1);
  assert.doesNotMatch(text, /backend|WhatsApp|MFA|2FA|dos factores|entrega confirmada|código enviado/i);
  assert.equal(panel.input(), undefined);
  assert.deepEqual(panel.calls, []);
  assert.deepEqual(panel.navigations, []);
});

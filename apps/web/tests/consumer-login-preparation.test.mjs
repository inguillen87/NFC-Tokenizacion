import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { setImmediate as nextTurn } from "node:timers/promises";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as delivery from "../src/app/login/consumer-login-delivery.ts";
import * as continuation from "../src/app/login/consumer-login-continuation.ts";
import * as safeReturn from "../../../packages/config/src/safe-return-path.ts";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../src/app/login/consumer-login-panel.tsx", import.meta.url), "utf8");
const compile = (text, filename) => ts.transpileModule(text, { fileName: filename, compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
} }).outputText;
const panelCode = compile(source, "consumer-login-panel.tsx");
const requestCode = compile(readFileSync(new URL("../src/lib/consumer-request.ts", import.meta.url), "utf8"), "consumer-request.ts");
const contactModule = { exports: {} };
new Function("require", "module", "exports", compile(readFileSync(new URL("../src/components/consumer-contact-input.tsx", import.meta.url), "utf8"), "consumer-contact-input.tsx"))(require, contactModule, contactModule.exports);
const contact = contactModule.exports;
const PRIVATE_CONTEXT = "/me/products?fromTap=1&eventId=733&uid=private-tag&mac=private-signature&lat=-32.9&contact=private%40example.test";

function walk(element, predicate) {
  if (!React.isValidElement(element)) return [];
  return [...(predicate(element) ? [element] : []), ...React.Children.toArray(element.props.children).flatMap(child => walk(child, predicate))];
}

// Run the actual panel handlers and effects with deterministic hook state. JSX,
// contact validation, continuation rules and the bounded JSON transport stay real.
// No DOM, provider call or network is needed to verify the mutation order.
function fixture({ respond, online = true, query = "", deadline } = {}) {
  const calls = [], slots = [], effects = [];
  let cursor = 0, changed = false, tree;
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!Object.hasOwn(slots, index)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], value => {
        const next = typeof value === "function" ? value(slots[index]) : value;
        if (!Object.is(slots[index], next)) { slots[index] = next; changed = true; }
      }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!Object.hasOwn(slots, index)) slots[index] = { current: initial };
      return slots[index];
    },
    useEffect(effect, dependencies) {
      const index = cursor++, previous = slots[index];
      if (!previous || !dependencies || dependencies.some((value, offset) => !Object.is(value, previous.dependencies?.[offset]))) {
        slots[index] = { dependencies };
        effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = effect(); });
      }
    },
  };
  const transportModule = { exports: {} };
  new Function("module", "exports", "fetch", requestCode)(transportModule, transportModule.exports, async (url, options) => {
    calls.push({ url, method: options.method, credentials: options.credentials, body: options.body });
    return respond(url, options, calls.length);
  });
  const loaded = { exports: {} }, body = {};
  const overrides = {
    react: hooks,
    "next/navigation": { useSearchParams: () => new URLSearchParams(query) },
    "@product/config/safe-return-path": safeReturn,
    "../../lib/consumer-request": { requestConsumerJson: (url, options) => transportModule.exports.requestConsumerJson(url, options, deadline) },
    "./consumer-login-delivery": delivery,
    "./consumer-login-continuation": continuation,
    "../../components/consumer-contact-input": contact,
    "./consumer-login.module.css": { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) },
  };
  new Function("require", "module", "exports", "navigator", "document", "requestAnimationFrame", "window", panelCode)(
    name => Object.hasOwn(overrides, name) ? overrides[name] : require(name), loaded, loaded.exports,
    { onLine: online }, { body, activeElement: body, addEventListener() {}, removeEventListener() {} }, callback => callback(), { addEventListener() {}, removeEventListener() {}, location: { assign: () => assert.fail("Unexpected navigation") } },
  );
  function render() {
    for (let pass = 0; pass < 20; pass++) {
      cursor = 0; changed = false;
      tree = loaded.exports.ConsumerLoginPanel({ nextPath: PRIVATE_CONTEXT });
      while (effects.length) effects.shift()();
      if (!changed) return tree;
    }
    assert.fail("Hook fixture did not settle");
  }
  const find = predicate => walk(render(), predicate);
  const form = () => find(element => element.type === "form")[0];
  const input = () => find(element => element.type === contact.ConsumerContactInput)[0];
  return {
    calls, render, find, input,
    choose(value) { input().props.onChange(contact.consumerContactDraftFromValue(value)); render(); },
    submit() { form().props.onSubmit({ preventDefault() {} }); render(); },
    async settle() {
      for (let pass = 0; pass < 100; pass++) {
        await nextTurn();
        if (!form().props["aria-busy"]) return render();
      }
      assert.fail("Panel request did not settle");
    },
    feedback() { return find(element => element.props.id === "consumer-access-feedback")[0]; },
    markup() { return renderToStaticMarkup(render()); },
  };
}

function response(status, payload) { return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } }); }
function assertBlocked(panel, draft) {
  assert.deepEqual(panel.calls.map(call => [call.url, call.method, call.credentials]), [["/api/consumer/auth/logout", "POST", "include"]]);
  assert.equal(panel.calls[0].body, undefined, "logout does not transmit the contact or TAP context");
  assert.deepEqual(panel.input().props.draft, draft, "selected contact is preserved");
  const status = panel.feedback();
  assert.equal(status.props.role, "status"); assert.equal(status.props["aria-live"], "polite"); assert.equal(status.props["aria-atomic"], "true");
  assert.equal(status.props.hidden, false); assert.equal(status.props["data-tone"], "error");
  const markup = panel.markup();
  assert.match(markup, /Tu contacto se conserva; no solicitamos un código/);
  assert.doesNotMatch(markup, /Continuar con email|Continuar con WhatsApp|Ya tengo un código|Código de acceso/);
  assert.doesNotMatch(markup, /private-signature|private-tag|eventId=733|private-upstream-details/);
}

test("CSRF rejection blocks both channels before code creation and offers only a public official destination", async () => {
  for (const value of ["persona@example.test", "+5491155551234"]) {
    const panel = fixture({ respond: async () => response(403, { ok: false, error: "cross_site_request_blocked" }) });
    panel.choose(value); const draft = panel.input().props.draft;
    panel.submit(); await panel.settle(); assertBlocked(panel, draft);
    assert.match(panel.feedback().props.children, /Esta página no está habilitada/);
    assert.doesNotMatch(panel.feedback().props.children, /sin conexión|Revisá la conexión/);
    const official = panel.find(element => element.type === "a" && element.props.href.startsWith("https://"));
    assert.equal(official.length, 1);
    assert.equal(official[0].props.href, "https://nexid.lat/login?consumer=1&next=%2Fme");
    assert.equal(official[0].props.target, "_blank");
    assert.equal(official[0].props.rel, "noopener noreferrer");
    assert.match(official[0].props["aria-label"], /abre una pestaña nueva/);
    assert.equal(official[0].props.className, "primary");
    assert.equal(official[0].props["aria-describedby"], "consumer-access-feedback");
    assert.equal(official[0].props.children, "Abrir el acceso oficial de NexID");
    const retry = panel.find(element => element.type === "button" && element.props.type === "submit")[0];
    assert.equal(retry.props.className, "secondary");
    assert.equal(retry.props.children, "Reintentar acceso");
  }
});

test("other 401/403 access denials do not claim a known origin failure or disconnected device", async () => {
  for (const status of [401, 403]) {
    const panel = fixture({ respond: async () => response(status, { ok: true, error: "private-upstream-details" }) });
    panel.choose("persona@example.test"); const draft = panel.input().props.draft;
    panel.submit(); await panel.settle(); assertBlocked(panel, draft);
    assert.match(panel.feedback().props.children, /El servicio rechazó preparar tu acceso/);
    assert.doesNotMatch(panel.feedback().props.children, /página no está habilitada|sin conexión/);
  }
});

test("server and rate-limit errors are actionable without sending a code or promoting another channel", async () => {
  for (const [status, expected] of [[429, /Hay demasiados intentos/], [503, /servicio de acceso no está disponible ahora/]]) {
    const panel = fixture({ respond: async () => response(status, { ok: true, error: "private-upstream-details" }) });
    panel.choose("+5491155551234"); const draft = panel.input().props.draft;
    panel.submit(); await panel.settle(); assertBlocked(panel, draft);
    assert.match(panel.feedback().props.children, expected);
    assert.doesNotMatch(panel.feedback().props.children, /conexión|sitio oficial/);
    assert.equal(panel.find(element => element.type === "button" && element.props.type === "submit")[0].props.children, "Reintentar acceso");
    assert.equal(panel.find(element => element.type === "a" && element.props.href.startsWith("https://")).length, 0);
  }
});

test("an unconfirmed successful HTTP response never bypasses the required logout acknowledgement", async () => {
  for (const ack of [null, {}, { ok: false }]) {
    const panel = fixture({ respond: async () => response(200, ack) });
    panel.choose("persona@example.test"); const draft = panel.input().props.draft;
    panel.submit(); await panel.settle(); assertBlocked(panel, draft);
    assert.match(panel.feedback().props.children, /No pudimos confirmar la preparación/);
  }
});

test("a connection failure describes offline only when the browser reports it", async () => {
  for (const online of [true, false]) {
    const panel = fixture({ online, respond: async () => { throw Error("private-upstream-details"); } });
    panel.choose("+5491155551234"); const draft = panel.input().props.draft;
    panel.submit(); await panel.settle(); assertBlocked(panel, draft);
    assert.match(panel.feedback().props.children, online ? /No pudimos conectar con el servicio/ : /Estás sin conexión/);
    if (online) assert.doesNotMatch(panel.feedback().props.children, /Estás sin conexión/);
  }
});

test("the actual request deadline is presented as a slow service, preserving the selected contact", async () => {
  const panel = fixture({ deadline: 5, respond: (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(Error("private-upstream-details")), { once: true });
  }) });
  panel.choose("persona@example.test"); const draft = panel.input().props.draft;
  panel.submit(); await new Promise(resolve => setTimeout(resolve, 10)); await panel.settle(); assertBlocked(panel, draft);
  assert.match(panel.feedback().props.children, /El servicio tardó demasiado/);
  assert.doesNotMatch(panel.feedback().props.children, /sin conexión/);
});

test("forceOtp applies the same rejection feedback and still does not initiate code delivery", async () => {
  const panel = fixture({ query: "forceOtp=1", respond: async () => response(403, { ok: false, error: "cross_site_request_blocked" }) });
  panel.render(); panel.choose("+5491155551234"); const draft = panel.input().props.draft;
  await panel.settle(); assertBlocked(panel, draft);
  assert.match(panel.feedback().props.children, /Esta página no está habilitada/);
});

test("retry performs logout again and only creates the challenge after its explicit acknowledgement", async () => {
  let logouts = 0;
  const panel = fixture({ respond: async url => {
    if (url === "/api/consumer/auth/logout") return ++logouts === 1 ? response(403, { ok: false, error: "cross_site_request_blocked" }) : response(200, { ok: true });
    assert.equal(url, "/api/consumer/auth/start");
    return response(200, { ok: true, delivery: { channel: "whatsapp", status: "accepted" } });
  } });
  panel.choose("+5491155551234"); panel.submit(); await panel.settle();
  assert.equal(panel.calls.length, 1);
  panel.submit(); await panel.settle();
  assert.deepEqual(panel.calls.map(call => call.url), ["/api/consumer/auth/logout", "/api/consumer/auth/logout", "/api/consumer/auth/start"]);
  assert.deepEqual(JSON.parse(panel.calls[2].body), { phone: "+5491155551234" });
  assert.match(panel.markup(), /Código de acceso/);
  assert.match(panel.feedback().props.children, /Solicitud de código aceptada por WhatsApp/);
  assert.equal(panel.find(element => element.type === "a" && element.props.href.startsWith("https://")).length, 0);
});

test("provider-specific WhatsApp failure retains the existing email recovery after logout succeeds", async () => {
  const panel = fixture({ respond: async url => {
    if (url === "/api/consumer/auth/logout") return response(200, { ok: true });
    assert.equal(url, "/api/consumer/auth/start");
    return response(503, { ok: false, error: "meta_authentication_failed" });
  } });
  panel.choose("+5491155551234"); panel.submit(); await panel.settle();
  assert.equal(panel.calls.length, 2);
  const recovery = panel.find(element => element.type === "button" && element.props["data-consumer-email-recovery"] === "primary");
  assert.equal(recovery.length, 1); assert.equal(recovery[0].props.children, "Continuar con email");
  assert.match(panel.feedback().props.children, /WhatsApp no está disponible ahora/);
});

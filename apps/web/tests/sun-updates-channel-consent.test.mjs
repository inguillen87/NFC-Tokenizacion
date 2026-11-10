import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { setImmediate as nextTurn } from "node:timers/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const compile = (source, name) => ts.transpileModule(source, { fileName: name, compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
} }).outputText;
const collectorCode = compile(readFileSync(new URL("../src/app/sun/sun-updates-opt-in.tsx", import.meta.url), "utf8"), "sun-updates-opt-in.tsx");
function load(source, name) {
  const module = { exports: {} };
  new Function("require", "module", "exports", compile(source, name))(require, module, module.exports);
  return module.exports;
}
const contact = load(readFileSync(new URL("../src/components/consumer-contact-input.tsx", import.meta.url), "utf8"), "consumer-contact-input.tsx");
const policy = load(readFileSync(new URL("../src/app/sun/tenant-action-availability.ts", import.meta.url), "utf8"), "tenant-action-availability.ts");

function configuration(tenantSlug = "synthetic-a", extra = {}) {
  return { version: "nexid.tenant-actions.v1", status: "published", allowedActions: ["lead"],
    program: null, trivia: null, catalogAvailable: false, tenantSlug, ...extra };
}
const BASE = { brandName: "Marca sintética", productName: "Producto sintético", tenantSlug: "synthetic-a",
  eventId: "41", bid: "LOT-QA-001", configuration: configuration(), canEngage: true };
const event = () => ({ preventDefault() {} });
const response = (status = 200, payload = { ok: true, persisted: true }) => new Response(JSON.stringify(payload), {
  status, headers: { "content-type": "application/json" },
});
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
function walk(element, predicate) {
  if (!React.isValidElement(element)) return [];
  return [...(predicate(element) ? [element] : []), ...React.Children.toArray(element.props.children).flatMap(child => walk(child, predicate))];
}

// Actual collector handlers, JSX, contact model, lead validator and policy run.
// Deterministic hook state/props and fetch replace a browser/provider, not logic.
function noticeClock() {
  let now = 0, nextId = 0;
  const timers = new Map(), callbacks = [];
  return {
    setTimeout(callback, milliseconds) { const id = ++nextId; timers.set(id, { at: now + milliseconds, callback }); callbacks.push(callback); return id; },
    clearTimeout(id) { timers.delete(id); },
    advance(milliseconds) { now += milliseconds; for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.callback(); } },
    pending() { return timers.size; },
    lastCallback() { return callbacks.at(-1); },
  };
}
function fixture({ props = {}, respond = () => response(), locale: initialLocale = "es-AR", clock = noticeClock() } = {}) {
  const calls = [];
  const createScope = () => ({ slots: [], effects: [], cursor: 0 });
  const outer = createScope(); let child = null, childKey = null, current = outer;
  let changed = false, tree, locale = initialLocale, currentProps = { ...BASE, ...props };
  const clean = scope => { if (scope) for (const slot of scope.slots) slot?.cleanup?.(); };
  const hooks = {
    useState(initial) {
      const own = current, i = own.cursor++;
      if (!Object.hasOwn(own.slots, i)) own.slots[i] = typeof initial === "function" ? initial() : initial;
      return [own.slots[i], value => { const next = typeof value === "function" ? value(own.slots[i]) : value;
        if (!Object.is(next, own.slots[i])) { own.slots[i] = next; changed = true; } }];
    },
    useRef(initial) { const own = current, i = own.cursor++; if (!Object.hasOwn(own.slots, i)) own.slots[i] = { current: initial }; return own.slots[i]; },
    useEffect(effect, dependencies) {
      const own = current, i = own.cursor++, previous = own.slots[i];
      if (!previous || !dependencies || dependencies.some((value, j) => !Object.is(value, previous.dependencies?.[j]))) {
        own.slots[i] = { dependencies };
        own.effects.push(() => { previous?.cleanup?.(); own.slots[i].cleanup = effect(); });
      }
    },
  };
  const module = { exports: {} };
  const overrides = { react: hooks, "./sun-locale-provider": { useSunLocale: () => ({ locale }) },
    "./tenant-action-availability": policy, "../../components/consumer-contact-input": contact };
  new Function("require", "module", "exports", "fetch", "setTimeout", "clearTimeout", collectorCode)(
    name => Object.hasOwn(overrides, name) ? overrides[name] : require(name), module, module.exports,
    async (url, init) => { const call = { url, method: init.method, body: JSON.parse(init.body) }; calls.push(call); return respond(call, calls.length); },
    clock.setTimeout, clock.clearTimeout,
  );
  // This adapter commits a keyed child with deterministic hook slots. It does
  // not model speculative/abandoned React work: the CI browser covers that.
  function render() {
    for (let pass = 0; pass < 20; pass++) {
      changed = false; current = outer; outer.cursor = 0;
      const wrapper = module.exports.SunUpdatesOptIn(currentProps);
      if (typeof wrapper.type === "function") {
        if (!child || childKey !== wrapper.key) { clean(child); child = createScope(); childKey = wrapper.key; }
        current = child; child.cursor = 0; tree = wrapper.type(wrapper.props);
      } else { clean(child); child = null; childKey = null; tree = wrapper; }
      while (outer.effects.length) outer.effects.shift()();
      while (child?.effects.length) child.effects.shift()();
      if (!changed) return tree;
    }
    assert.fail("Hook fixture did not settle");
  }
  const find = predicate => walk(render(), predicate);
  const form = () => find(node => node.type === "form")[0];
  const input = () => find(node => node.type === contact.ConsumerContactInput)[0];
  const checkbox = () => find(node => node.type === "input" && node.props.type === "checkbox")[0];
  const submitButton = () => find(node => node.type === "button" && node.props.type === "submit")[0];
  const panel = {
    calls, clock, render, find, form, input, checkbox, submitButton,
    open() { const toggle = find(node => node.type === "button" && node.props["aria-controls"] === "sun-updates-form")[0];
      if (toggle && !toggle.props["aria-expanded"] && !toggle.props.disabled) toggle.props.onClick(); render(); },
    choose(value) { input().props.onChange(contact.consumerContactDraftFromValue(value)); render(); },
    grant(value = true) { checkbox().props.onChange({ target: { checked: value } }); render(); },
    update(next) { currentProps = { ...currentProps, ...next }; return render(); },
    language(value) { locale = value; return render(); },
    captureSubmit() { return form().props.onSubmit; },
    async submit() { const promise = form().props.onSubmit(event()); render(); await promise; return render(); },
    markup() { return renderToStaticMarkup(render()); },
    dispose() { clean(child); clean(outer); },
    async settle() { for (let i = 0; i < 100; i++) { await nextTurn(); if (!form()?.props["aria-busy"]) return render(); } assert.fail("Request did not settle"); },
  };
  panel.open();
  return panel;
}
test("opening, editing and switching channel do not send a lead or start authentication", () => {
  const panel = fixture();
  panel.choose("Reader@Example.Test");
  panel.choose("+15550001111");
  panel.grant();
  assert.deepEqual(panel.calls, []);
  assert.equal(panel.submitButton().props.disabled, false);
});

test("valid email boundaries use the legacy contact-only request without silently changing case", async () => {
  for (const value of [" Reader@Example.Test ", "a".repeat(120) + "@b.co", "a@" + "b".repeat(190) + ".co",
    "a@b." + "c".repeat(63), "a".repeat(120) + "@" + "b".repeat(135) + "." + "c".repeat(63)]) {
    const panel = fixture(); panel.choose(value); panel.grant();
    assert.equal(panel.submitButton().props.disabled, false);
    await panel.submit(); assert.equal(panel.calls.length, 1);
    const { url, method, body } = panel.calls[0];
    assert.equal(url, "/api/leads"); assert.equal(method, "POST"); assert.equal(body.contact, value.trim());
    assert.equal(Object.hasOwn(body, "email"), false); assert.equal(Object.hasOwn(body, "phone"), false);
    assert.equal(body.eventId, "41"); assert.equal(body.tenantSlug, "synthetic-a"); assert.equal(body.bid, "LOT-QA-001");
    assert.deepEqual(body.gps, { consent: false, precision: "none" });
    assert.deepEqual(body.engagement, { type: "sun_brand_opt_in", optIn: "brand_updates", consentTextVersion: "sun_updates_v1" });
  }
  const withoutBatch = fixture({ props: { bid: null } });
  assert.equal(withoutBatch.form(), undefined, "a missing batch cannot open a sendable form");
  assert.deepEqual(withoutBatch.calls, []);
  assert.match(withoutBatch.markup(), /No pudimos vincular esta solicitud con el producto/);
  assert.match(withoutBatch.markup(), /Volvé a abrir su pasaporte desde la etiqueta/);
  assert.doesNotMatch(withoutBatch.markup(), /falsificad|fraude|manipulad/i);
});

test("one-character final domain and oversized email portions or total are rejected without a POST", async () => {
  const invalid = ["a@b.c", "a".repeat(121) + "@b.co", "a@" + "b".repeat(191) + ".co", "a@b." + "c".repeat(64),
    "a".repeat(120) + "@" + "b".repeat(136) + "." + "c".repeat(63), "a b@example.test", "a@@example.test"];
  for (const value of invalid) {
    const panel = fixture(); panel.choose(value); panel.grant();
    assert.equal(panel.submitButton().props.disabled, true);
    await panel.submit(); assert.deepEqual(panel.calls, []);
    assert.equal(panel.input().props.draft.email, value, "invalid text is not truncated");
    assert.match(panel.markup(), /Revisá el correo/);
  }
});

test("the existing access normalizer keeps its current email semantics", () => {
  const draft = contact.consumerContactDraftFromValue("a@b.c");
  assert.deepEqual(contact.consumerContactPayload(draft), { email: "a@b.c" });
  const tree = contact.ConsumerContactInput({ draft, onChange() {} });
  const email = walk(tree, node => node.type === "input" && node.props.type === "email")[0];
  assert.equal(email.props.title, "Email donde recibis el codigo de acceso.");
});

test("email and phone use their real channel-specific input metadata and subscription titles", () => {
  const panel = fixture(); panel.choose("reader@example.test");
  let tree = contact.ConsumerContactInput(panel.input().props);
  const email = walk(tree, node => node.type === "input" && node.props.type === "email")[0];
  assert.equal(email.props.inputMode, "email"); assert.equal(email.props.autoComplete, "email");
  assert.doesNotMatch(email.props.title, /c[oó]digo|acceso/);
  panel.choose("+15550001111"); tree = contact.ConsumerContactInput(panel.input().props);
  const phone = walk(tree, node => node.type === "input" && node.props.type === "tel")[0];
  assert.equal(phone.props.inputMode, "tel"); assert.equal(phone.props.autoComplete, "tel-national");
  assert.equal(walk(tree, node => node.type === "select").length, 1);
});

test("valid phones keep only normalized legacy contact and reject short or oversized drafts", async () => {
  for (const value of ["+15550001111", "+1" + "5".repeat(14)]) {
    const panel = fixture(); panel.choose(value); panel.grant(); await panel.submit();
    assert.equal(panel.calls.length, 1); assert.equal(panel.calls[0].body.contact, value);
    assert.equal(Object.hasOwn(panel.calls[0].body, "phone"), false);
    assert.equal(Object.hasOwn(panel.calls[0].body, "email"), false);
  }
  for (const value of ["+155", "+1" + "5".repeat(15)]) {
    const panel = fixture(); panel.choose(value); panel.grant(); await panel.submit(); assert.deepEqual(panel.calls, []);
  }
});

test("contact, country and channel changes revoke consent and reject a captured old submit synchronously", async () => {
  for (const next of [draft => ({ ...draft, email: "other@example.test" }),
    draft => ({ ...draft, channel: "whatsapp", countryCode: "+1", localPhone: "5550001111" }),
    draft => ({ ...draft, countryCode: "+56" })]) {
    const panel = fixture(); panel.choose("reader@example.test"); panel.grant();
    const oldSubmit = panel.captureSubmit(), input = panel.input();
    input.props.onChange(next(input.props.draft));
    await oldSubmit(event());
    panel.render(); assert.deepEqual(panel.calls, []); assert.equal(panel.checkbox().props.checked, false);
  }
});

test("unchecking consent blocks an already captured submit before a rerender", async () => {
  const panel = fixture(); panel.choose("reader@example.test"); panel.grant();
  const oldSubmit = panel.captureSubmit(), checkbox = panel.checkbox();
  checkbox.props.onChange({ target: { checked: false } });
  await oldSubmit(event()); panel.render(); assert.deepEqual(panel.calls, []); assert.equal(panel.checkbox().props.checked, false);
});

test("same-turn name and contact edits preserve both drafts and revoke consent", async () => {
  const panel = fixture(); panel.choose("reader@example.test"); panel.grant();
  const oldSubmit = panel.captureSubmit(), input = panel.input();
  const name = panel.find(node => node.type === "input" && node.props.autoComplete === "name")[0];
  name.props.onChange({ target: { value: "Nombre sintético" } });
  input.props.onChange(contact.consumerContactDraftFromValue("other@example.test"));
  await oldSubmit(event()); panel.render();
  assert.equal(panel.input().props.draft.email, "other@example.test");
  assert.equal(panel.find(node => node.type === "input" && node.props.autoComplete === "name")[0].props.value, "Nombre sintético");
  assert.equal(panel.checkbox().props.checked, false); assert.deepEqual(panel.calls, []);
});

test("tenant, brand, product, event, batch and publication changes never reuse earlier consent", async () => {
  const changes = [{ brandName: "Otra marca" }, { productName: "Otro producto" }, { eventId: "42" }, { bid: "LOT-QA-002" },
    { tenantSlug: "synthetic-b", configuration: configuration("synthetic-b") }, { canEngage: false },
    { configuration: configuration("synthetic-a", { status: "unpublished" }) }, { configuration: configuration("synthetic-b") },
    { eventId: null }, { bid: null }, { tenantSlug: null }];
  for (const changedProps of changes) {
    const panel = fixture(); panel.choose("reader@example.test"); panel.grant(); const oldSubmit = panel.captureSubmit();
    panel.update(changedProps); await oldSubmit(event());
    assert.deepEqual(panel.calls, []); assert.equal(panel.checkbox()?.props.checked ?? false, false);
    panel.update(BASE); panel.open(); await oldSubmit(event());
    assert.equal(panel.checkbox().props.checked, false, "A→B→A does not restore the old authorization");
    assert.deepEqual(panel.calls, []);
  }
});

test("locale changes revoke the prior checkbox and stale callbacks cannot grant it again", async () => {
  const panel = fixture(); panel.choose("reader@example.test"); panel.grant();
  const oldSubmit = panel.captureSubmit(), oldCheckbox = panel.checkbox();
  panel.language("en"); oldCheckbox.props.onChange({ target: { checked: true } });
  await oldSubmit(event()); panel.open(); panel.render(); assert.equal(panel.checkbox().props.checked, false); assert.deepEqual(panel.calls, []);
});

test("two same-turn calls of the real handler reserve only one pending POST", async () => {
  const pending = deferred(); const panel = fixture({ respond: () => pending.promise });
  panel.choose("reader@example.test"); panel.grant(); const submit = panel.captureSubmit();
  const one = submit(event()), two = submit(event());
  assert.equal(panel.calls.length, 1); panel.render(); assert.equal(panel.form().props["aria-busy"], true);
  assert.equal(panel.input().props.disabled, true); assert.equal(panel.checkbox().props.disabled, true);
  pending.resolve(response()); await Promise.all([one, two]); panel.render();
  assert.match(panel.markup(), /Suscripción solicitada/);
  await submit(event()); assert.equal(panel.calls.length, 1, "an acknowledged result also rejects the old hidden handler");
});

test("a response for the previous product cannot confirm the new context or auto-submit it", async () => {
  const pending = deferred(); const panel = fixture({ respond: (_call, n) => n === 1 ? pending.promise : response() });
  panel.choose("reader@example.test"); panel.grant(); const first = panel.captureSubmit()(event());
  panel.update({ brandName: "Marca B", productName: "Producto B", tenantSlug: "synthetic-b", eventId: "42", bid: "LOT-QA-002", configuration: configuration("synthetic-b") });
  assert.equal(panel.checkbox()?.props.checked ?? false, false); assert.match(panel.markup(), /solicitud anterior/);
  pending.resolve(response()); await first; panel.render();
  assert.doesNotMatch(panel.markup(), /Suscripción solicitada/); assert.equal(panel.calls.length, 1);
  panel.open(); panel.choose("reader-b@example.test"); panel.grant(); await panel.submit(); assert.equal(panel.calls.length, 2);
  assert.equal(panel.calls[0].body.eventId, "41"); assert.equal(panel.calls[1].body.eventId, "42");
  assert.equal(panel.calls[1].body.tenantSlug, "synthetic-b");
});

test("HTTP, JSON and transport failures preserve the draft without an automatic retry or success", async () => {
  for (const respond of [() => response(400, { ok: false }), () => new Response("not json", { status: 200 }),
    () => { throw new Error("synthetic unavailable"); }]) {
    const panel = fixture({ respond }); panel.choose("reader@example.test"); panel.grant(); await panel.submit();
    assert.equal(panel.calls.length, 1); assert.equal(panel.input().props.draft.email, "reader@example.test");
    assert.match(panel.markup(), /No pudimos confirmar la solicitud/); assert.doesNotMatch(panel.markup(), /Suscripción solicitada/);
    await nextTurn(); assert.equal(panel.calls.length, 1);
  }
});

test("an optional oversized name is not silently truncated into a lead", async () => {
  const panel = fixture(); panel.choose("reader@example.test");
  panel.find(node => node.type === "input" && node.props.autoComplete === "name")[0].props.onChange({ target: { value: "n".repeat(121) } });
  panel.render(); panel.grant(); await panel.submit(); assert.deepEqual(panel.calls, []);
  assert.match(panel.markup(), /hasta 120 caracteres/);
});

test("unmounting invalidates captured consent and does not turn a late response into another request", async () => {
  const pending = deferred(); const panel = fixture({ respond: () => pending.promise });
  panel.choose("reader@example.test"); panel.grant(); const submit = panel.captureSubmit(), first = submit(event());
  panel.dispose(); pending.resolve(response()); await first; await submit(event()); assert.equal(panel.calls.length, 1);
});

// Current8e9 locator rules are gating only: a syntactically valid locator still
// requires the API's authoritative canonical event/published-policy checks.
test("missing or malformed tenant, event and batch never send or reuse a captured valid consent", async () => {
  const invalid = [
    { tenantSlug: null }, { tenantSlug: "" }, { tenantSlug: "a", configuration: configuration("a") },
    { tenantSlug: "-tenant" }, { tenantSlug: "tenant/other" }, { tenantSlug: "a".repeat(121) },
    { eventId: null }, { eventId: "" }, { eventId: "0" }, { eventId: "01" }, { eventId: "-1" },
    { eventId: "1.5" }, { eventId: "9".repeat(21) }, { eventId: "41suffix" },
    { bid: null }, { bid: "" }, { bid: "ab" }, { bid: "LOT/QA" }, { bid: "x".repeat(121) },
  ];
  for (const props of invalid) {
    const absent = fixture({ props });
    assert.equal(absent.form(), undefined);
    assert.deepEqual(absent.calls, []);
    assert.match(absent.markup(), /Volvé a abrir su pasaporte desde la etiqueta/);
    const panel = fixture(); panel.choose("reader@example.test"); panel.grant();
    const stale = panel.captureSubmit(); panel.update(props); await stale(event());
    assert.deepEqual(panel.calls, []);
    assert.equal(panel.form(), undefined);
  }
});

test("API-compatible trimmed locators and tenant lowercase pass without silently truncating legacy body fields", async () => {
  for (const props of [
    { tenantSlug: " SyNtHeTiC-A ", eventId: " 41 ", bid: " LOT-QA-001 " },
    { tenantSlug: "ab", configuration: configuration("ab"), eventId: "1", bid: "A:1" },
    { tenantSlug: "a".repeat(120), configuration: configuration("a".repeat(120)), eventId: "9".repeat(20), bid: "B".repeat(120) },
  ]) {
    const panel = fixture({ props }); panel.choose("reader@example.test"); panel.grant(); await panel.submit();
    assert.equal(panel.calls.length, 1);
    assert.equal(panel.calls[0].body.tenantSlug, props.tenantSlug);
    assert.equal(panel.calls[0].body.eventId, props.eventId);
    assert.equal(panel.calls[0].body.bid, props.bid);
    assert.equal(Object.hasOwn(panel.calls[0].body, "email"), false);
    assert.equal(Object.hasOwn(panel.calls[0].body, "phone"), false);
  }
});

test("only ok true and persisted true acknowledge a saved request; incomplete ACK preserves draft without automatic POST", async () => {
  for (const payload of [{ ok: true }, { ok: true, persisted: false }, { ok: true, persisted: null },
    { ok: true, persisted: "true" }, { ok: true, persisted: 1 }, { ok: false, persisted: true }, { persisted: true }]) {
    const panel = fixture({ respond: () => response(200, payload) });
    panel.choose("reader@example.test"); panel.grant(); await panel.submit();
    assert.equal(panel.calls.length, 1);
    assert.equal(panel.input().props.draft.email, "reader@example.test");
    assert.equal(panel.checkbox().props.checked, true);
    assert.match(panel.markup(), /No pudimos confirmar la solicitud/);
    assert.doesNotMatch(panel.markup(), /Suscripción solicitada/);
    await nextTurn(); assert.equal(panel.calls.length, 1);
  }
  const confirmed = fixture(); confirmed.choose("reader@example.test"); confirmed.grant(); await confirmed.submit();
  assert.equal(confirmed.calls.length, 1); assert.match(confirmed.markup(), /Suscripción solicitada/);
});

test("an eight-second notice is accessible feedback and keeps the same pending POST until its ACK", async () => {
  const pending = deferred(), panel = fixture({ respond: () => pending.promise });
  panel.choose("reader@example.test"); panel.grant();
  const first = panel.captureSubmit()(event()); panel.render();
  const status = panel.find(node => node.props.id === "sun-updates-request-status")[0];
  assert.equal(status.props.role, "status"); assert.equal(status.props["aria-live"], "polite"); assert.equal(status.props["aria-atomic"], "true");
  assert.equal(walk(panel.form(), node => node.props.id === "sun-updates-request-status").length, 0, "feedback is outside the busy form");
  assert.equal(panel.clock.pending(), 1);
  panel.clock.advance(7_999); assert.doesNotMatch(panel.markup(), /Seguimos esperando la confirmación/);
  const lateNotice = panel.clock.lastCallback();
  panel.clock.advance(1); panel.render();
  assert.match(panel.markup(), /Seguimos esperando la confirmación de tu solicitud/); assert.match(panel.markup(), /Podría haberse guardado/);
  assert.equal(panel.find(node => node.type === "a" && node.props.href === "#sun-summary").length, 1);
  assert.equal(panel.form().props["aria-busy"], true); assert.equal(panel.submitButton().props.disabled, true);
  assert.equal(panel.input().props.draft.email, "reader@example.test"); assert.equal(panel.checkbox().props.checked, true); assert.equal(panel.calls.length, 1);
  pending.resolve(response()); await first; panel.render();
  assert.equal(panel.clock.pending(), 0); assert.match(panel.markup(), /Suscripción solicitada/); assert.doesNotMatch(panel.markup(), /Seguimos esperando la confirmación/);
  lateNotice(); panel.render();
  assert.doesNotMatch(panel.markup(), /Seguimos esperando la confirmación/); assert.equal(panel.calls.length, 1);
});

test("a pending JSON body can show delay without claiming failure or renewing an unconfirmed request", async () => {
  const body = deferred(), panel = fixture({ respond: () => ({ ok: true, json: () => body.promise }) });
  panel.choose("reader@example.test"); panel.grant();
  const first = panel.captureSubmit()(event()); panel.render(); await nextTurn();
  panel.clock.advance(8_000); panel.render();
  assert.match(panel.markup(), /Seguimos esperando la confirmación de tu solicitud/); assert.doesNotMatch(panel.markup(), /No pudimos confirmar la solicitud|Suscripción solicitada/);
  assert.equal(panel.form().props["aria-busy"], true); assert.equal(panel.calls.length, 1);
  body.resolve({ ok: true }); await first; panel.render();
  assert.match(panel.markup(), /No pudimos confirmar la solicitud/); assert.doesNotMatch(panel.markup(), /Suscripción solicitada|Seguimos esperando la confirmación/);
  assert.equal(panel.input().props.draft.email, "reader@example.test"); assert.equal(panel.clock.pending(), 0);
  await nextTurn(); assert.equal(panel.calls.length, 1);
});

test("delay belongs to the older flight across context changes and cannot authorize or submit the new product", async () => {
  const pending = deferred(), panel = fixture({ respond: (_call, n) => n === 1 ? pending.promise : response() });
  panel.choose("a@example.test"); panel.grant();
  const first = panel.captureSubmit()(event()); panel.render(); panel.clock.advance(4_000);
  panel.update({ brandName: "Otra marca", productName: "Otro producto", tenantSlug: "synthetic-b", eventId: "42", bid: "LOT-QA-002", configuration: configuration("synthetic-b") });
  panel.clock.advance(4_000); panel.render();
  assert.match(panel.markup(), /Seguimos esperando la confirmación de una solicitud anterior/); assert.match(panel.markup(), /todavía necesita una nueva autorización/);
  assert.doesNotMatch(panel.markup(), /a@example.test|Suscripción solicitada/);
  assert.equal(panel.find(node => node.type === "button" && node.props["aria-controls"] === "sun-updates-form")[0].props.disabled, true); assert.equal(panel.calls.length, 1);
  const staleNotice = panel.clock.lastCallback();
  pending.resolve(response()); await first; panel.render();
  assert.doesNotMatch(panel.markup(), /Suscripción solicitada|Seguimos esperando la confirmación/); assert.equal(panel.calls.length, 1); assert.equal(panel.clock.pending(), 0);
  panel.open(); assert.equal(panel.checkbox().props.checked, false); assert.equal(panel.input().props.draft.email, "");
  panel.choose("b@example.test"); panel.grant();
  const second = panel.captureSubmit()(event()); panel.render(); staleNotice(); panel.render();
  assert.doesNotMatch(panel.markup(), /Seguimos esperando la confirmación/);
  await second; panel.render(); assert.equal(panel.calls.length, 2); assert.equal(panel.calls[1].body.tenantSlug, "synthetic-b"); assert.equal(panel.calls[1].body.contact, "b@example.test");
});

test("unmount clears the notice timer and a queued callback cannot renew the request or captured consent", async () => {
  const pending = deferred(), panel = fixture({ respond: () => pending.promise });
  panel.choose("reader@example.test"); panel.grant();
  const submit = panel.captureSubmit(), first = submit(event()); panel.render();
  const queuedNotice = panel.clock.lastCallback();
  assert.equal(panel.clock.pending(), 1); panel.dispose(); assert.equal(panel.clock.pending(), 0);
  queuedNotice(); panel.clock.advance(8_000); await submit(event()); assert.equal(panel.calls.length, 1);
  pending.resolve(response()); await first; assert.equal(panel.calls.length, 1); assert.equal(panel.clock.pending(), 0);
});
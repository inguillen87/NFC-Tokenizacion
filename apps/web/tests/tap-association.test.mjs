import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as model from "../src/app/me/_components/tap-association-model.ts";

const require = createRequire(import.meta.url);
const directory = new URL("../src/app/me/_components/", import.meta.url);
const source = readFileSync(new URL("tap-association-banner.tsx", directory), "utf8");
const copySource = readFileSync(new URL("tap-association-copy.ts", directory), "utf8");
const context = (query = "action=products", event = "715") => model.tapAssociationContext(new URLSearchParams(`fromTap=1&eventId=${event}&tenant=demobodega&bid=DEMO-2026-02&${query}`));
const titleScope = "nexid_off_chain_digital_title";
const successPayloads = {
  save: { ok: true, saved: true, eventId: 715 },
  join: { ok: true, membership: { id: "membership-1", status: "active" } },
  claim: { ok: true, eventId: 715, ownership_scope: titleScope, ownership: { status: "claimed" } },
  rewards: { ok: true, enrollment_status: "enrolled", member: { id: "member-1", status: "enrolled", pointsBalance: 0 } },
};
const outcome = { save: "saved", join: "linked", claim: "claimed", rewards: "enrolled" };

function compile(code, name, loader = require) {
  const { outputText } = ts.transpileModule(code, {
    fileName: name,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", outputText)(loader, module, module.exports);
  return module.exports;
}
const copy = compile(copySource, "tap-association-copy.ts");
function render(query) {
  const dependencies = request => {
    if (request === "next/navigation") return { useSearchParams: () => new URLSearchParams(query) };
    if (request === "next/link") return { __esModule: true, default: ({ children, prefetch, ...props }) => React.createElement("a", props, children) };
    if (request === "./tap-association-model") return model;
    if (request === "./tap-association-copy") return copy;
    if (request.endsWith(".module.css")) return { __esModule: true, default: new Proxy({}, { get: (_, name) => String(name) }) };
    return require(request);
  };
  const { TapAssociationBanner } = compile(source, "tap-association-banner.tsx", dependencies);
  return renderToStaticMarkup(React.createElement(TapAssociationBanner));
}

test("products selects only save; unknown and portal require an explicit choice", () => {
  assert.equal(context().preferred, "save");
  for (const action of model.TAP_ASSOCIATION_ACTIONS) assert.equal(context(`action=${action}`).preferred, action);
  for (const action of ["", "portal", "unknown", "claim,rewards"]) assert.equal(context(`action=${action}`).preferred, null);
  const runner = model.createTapAssociationRunner(context(), () => { throw new Error("must not execute before confirmation"); });
  assert.deepEqual(runner.state(), { pending: null, results: {} });
  runner.dispose();
});

test("context rejects ambiguous or invalid references and retains large event identifiers exactly", () => {
  for (const event of ["", "0", "-1", "01", "1.2", "1e3", "NaN", "9223372036854775808", "../claim"]) assert.equal(context("", event), null, event);
  assert.equal(context("", "9223372036854775807").eventId, "9223372036854775807");
  for (const key of ["fromTap", "eventId", "tenant", "bid", "action"]) assert.equal(context(`action=products&${key}=other`), null, key);
  assert.equal(model.tapAssociationContext(new URLSearchParams("eventId=715")), null);
  assert.equal(context(`tenant=${"a".repeat(121)}`), null);
  assert.equal(model.tapAssociationContext(new URLSearchParams("fromTap=1&eventId=715&tenant=a%00b")), null);
  assert.notEqual(context().key, context("action=products", "716").key);
  assert.notEqual(context().key, context("action=claim").key);
});

test("login preserves only clean reference and selected action, without session reset or capability forwarding", () => {
  const ctx = context("action=claim&fresh_token=secret&sun_fresh=secret2&uid=PRIVATE&forceOtp=1&next=https://untrusted.invalid");
  const href = new URL(model.tapAssociationLoginHref(ctx), "https://nexid.example");
  assert.equal(href.pathname, "/login");
  assert.equal(href.searchParams.get("consumer"), "1");
  const next = new URL(href.searchParams.get("next"), href.origin);
  assert.equal(next.pathname, "/me");
  assert.deepEqual(Object.fromEntries(next.searchParams), { fromTap: "1", eventId: "715", tenant: "demobodega", bid: "DEMO-2026-02", action: "claim" });
  assert.doesNotMatch(href.href, /secret|fresh|forceOtp|PRIVATE|untrusted/);
});

test("session distinguishes active, signed-out 200 and 401, and unavailable responses", () => {
  assert.equal(model.tapAssociationSession(200, { ok: true, authenticated: true }), "active");
  assert.equal(model.tapAssociationSession(200, { ok: true, authenticated: false }), "none");
  assert.equal(model.tapAssociationSession(401, null), "none");
  for (const [status, payload] of [[200, null], [200, { ok: true }], [200, { authenticated: true }], [200, { ok: true, authenticated: "true" }], [500, { ok: true, authenticated: true }], [503, { authenticated: false }]]) {
    assert.equal(model.tapAssociationSession(status, payload), "unavailable");
  }
});

test("each confirmation builds only the selected endpoint and excludes identity, points and capability claims", () => {
  const ctx = context("action=products&fresh_token=secret&email=other@example.com&points=1000");
  const paths = { save: "consumer/save-product", join: "consumer/join-tenant", claim: "consumer/claim", rewards: "loyalty/enroll" };
  for (const action of model.TAP_ASSOCIATION_ACTIONS) {
    const request = model.tapAssociationRequest(ctx, action, "en");
    assert.equal(request.path, `/api/mobile/passport/715/${paths[action]}`);
    assert.deepEqual(request.body, { tenantSlug: "demobodega", bid: "DEMO-2026-02", ...(action === "rewards" ? { locale: "en" } : {}) });
  }
  assert.equal(model.tapAssociationRequest(ctx, "rewards", "invalid").body.locale, "es-AR");
  assert.throws(() => model.tapAssociationRequest(ctx, "portal", "en"), /action_invalid/);
});

test("authoritative action-specific response fields are necessary before reporting a completed action", () => {
  for (const action of model.TAP_ASSOCIATION_ACTIONS) {
    assert.deepEqual(model.tapAssociationResult(action, "715", 200, successPayloads[action]), { outcome: outcome[action], retryable: false });
    for (const payload of [null, [], { ok: true }, { ...successPayloads[action], ok: false }]) {
      assert.deepEqual(model.tapAssociationResult(action, "715", 200, payload), { outcome: "unconfirmed", retryable: true }, `${action}: ${JSON.stringify(payload)}`);
    }
    assert.equal(model.tapAssociationResult(action, "715", 500, successPayloads[action]).outcome, "unconfirmed");
  }
  for (const action of ["save", "claim"]) assert.equal(model.tapAssociationResult(action, "716", 200, successPayloads[action]).outcome, "unconfirmed");
  assert.equal(model.tapAssociationResult("claim", "715", 200, { ok: true, eventId: 715, ownership: { status: "claimed" } }).outcome, "unconfirmed");
  assert.equal(model.tapAssociationResult("join", "715", 200, { ok: true, membership: { status: "active" } }).outcome, "unconfirmed");
  assert.equal(model.tapAssociationResult("rewards", "715", 200, { ok: true, enrollment_status: "enrolled", member: { id: "m", status: "inactive" } }).outcome, "unconfirmed");
  assert.equal(model.tapAssociationResult("rewards", "715", 200, { ok: true, enrollment_status: "enrolled", member: { id: "m", status: "active" } }).outcome, "unconfirmed");
});

test("committed 503 records title as incomplete without enabling retries or inventing successful enrollment", () => {
  const payload = { ok: false, operation_committed: true, ownership: { status: "claimed", record_scope: titleScope } };
  assert.deepEqual(model.tapAssociationResult("claim", "715", 503, payload), { outcome: "recorded_pending", retryable: false });
  assert.deepEqual(model.tapAssociationResult("claim", "715", 503, { operation_committed: true }), { outcome: "committed_unknown", retryable: false });
  assert.deepEqual(model.tapAssociationResult("rewards", "715", 503, payload), { outcome: "committed_unknown", retryable: false });
});

test("denied and review-required responses never become pending applications or ownership grants", () => {
  for (const error of ["fresh_tap_capability_required", "fresh_physical_tap_required_for_ownership", "snapshot_blocked", "pin_required", "invalid_pin", "claim_pin_locked"]) {
    assert.deepEqual(model.tapAssociationResult("claim", "715", 403, { error }), { outcome: "fresh_required", retryable: false });
  }
  assert.deepEqual(model.tapAssociationResult("claim", "715", 403, { review_required: true }), { outcome: "review_required", retryable: false });
  assert.deepEqual(model.tapAssociationResult("rewards", "715", 404, { error: "no_active_program" }), { outcome: "no_program", retryable: false });
  assert.deepEqual(model.tapAssociationResult("claim", "715", 409, { error: "ownership_already_claimed" }), { outcome: "blocked", retryable: false });
  assert.deepEqual(model.tapAssociationResult("save", "715", 401, { error: "unauthorized" }), { outcome: "session_required", retryable: true });
});

test("runner makes one selected request, serializes rapid clicks and never repeats a completed action", async () => {
  let resolveResponse;
  const calls = [];
  const runner = model.createTapAssociationRunner(context(), (path, body) => {
    calls.push({ path, body });
    return new Promise(resolve => { resolveResponse = resolve; });
  });
  assert.equal(calls.length, 0);
  const first = runner.run("save");
  assert.equal(runner.state().pending, "save");
  assert.equal(await runner.run("save"), null);
  assert.equal(await runner.run("claim"), null);
  assert.equal(calls.length, 1);
  assert.match(calls[0].path, /consumer\/save-product$/);
  resolveResponse({ status: 200, payload: successPayloads.save });
  assert.deepEqual(await first, { outcome: "saved", retryable: false });
  assert.equal(await runner.run("save"), null);
  assert.equal(calls.length, 1);
  assert.deepEqual(runner.state(), { pending: null, results: { save: { outcome: "saved", retryable: false } } });
  runner.dispose();
});

test("separate result summary survives a failed action and manual retry sends only that action", async () => {
  const calls = [];
  let rewardAttempts = 0;
  const runner = model.createTapAssociationRunner(context(), async path => {
    calls.push(path);
    if (path.endsWith("save-product")) return { status: 200, payload: successPayloads.save };
    if (++rewardAttempts === 1) throw new Error("response lost");
    return { status: 200, payload: successPayloads.rewards };
  });
  await runner.run("save");
  assert.deepEqual(await runner.run("rewards"), { outcome: "unconfirmed", retryable: true });
  assert.equal(runner.state().results.save.outcome, "saved");
  await runner.run("rewards");
  assert.deepEqual(calls.map(path => path.split("/").at(-1)), ["save-product", "enroll", "enroll"]);
  assert.deepEqual(runner.state(), { pending: null, results: { save: { outcome: "saved", retryable: false }, rewards: { outcome: "enrolled", retryable: false } } });
  runner.dispose();
});

test("committed claim remains terminal even when another action is subsequently confirmed", async () => {
  const calls = [];
  const runner = model.createTapAssociationRunner(context("action=claim"), async path => {
    calls.push(path);
    return path.endsWith("claim")
      ? { status: 503, payload: { operation_committed: true, ownership: { status: "claimed", record_scope: titleScope } } }
      : { status: 200, payload: successPayloads.rewards };
  });
  await runner.run("claim");
  assert.equal(await runner.run("claim"), null);
  await runner.run("rewards");
  assert.equal(await runner.run("claim"), null);
  assert.equal(calls.length, 2);
  assert.equal(runner.state().results.claim.outcome, "recorded_pending");
  runner.dispose();
});

test("context disposal aborts work and suppresses a late response; new event starts without stale outcomes", async () => {
  let finish, signal;
  const emitted = [];
  const old = model.createTapAssociationRunner(context(), async (_path, _body, currentSignal) => {
    signal = currentSignal;
    return new Promise(resolve => { finish = resolve; });
  });
  old.subscribe(value => emitted.push(value));
  const inFlight = old.run("save");
  old.dispose();
  assert.equal(signal.aborted, true);
  const current = model.createTapAssociationRunner(context("action=products", "716"), async () => ({ status: 200, payload: { ok: true, saved: true, eventId: 716 } }));
  assert.deepEqual(current.state(), { pending: null, results: {} });
  finish({ status: 200, payload: successPayloads.save });
  assert.equal(await inFlight, null);
  assert.equal(emitted.length, 1);
  assert.equal(await old.run("claim"), null);
  await current.run("save");
  assert.equal(current.state().results.save.outcome, "saved");
  current.dispose();
});

test("actual banner SSR exposes labeled single-choice controls and waits for session without granting trust", () => {
  const html = render("fromTap=1&eventId=715&action=products");
  assert.equal((html.match(/type="radio"/g) || []).length, 4);
  assert.match(html, /<fieldset[^>]*>[\s\S]*<legend>Una acción por vez<\/legend>/);
  const checked = [...html.matchAll(/<input\b([^>]*\bchecked=""[^>]*)>/g)];
  assert.equal(checked.length, 1);
  assert.match(checked[0][1], /value="save"/);
  assert.match(html, /La referencia del enlace no confirma autenticidad ni permisos/);
  assert.match(html, /Comprobando tu sesión/);
  assert.doesNotMatch(html, /data-testid="tap-association-confirm"|Mensaje NFC validado|href="[^\"]*logout/);
  assert.doesNotMatch(render("fromTap=1&eventId=715&action=portal"), /checked=""/);
  assert.equal(render("eventId=715&action=products"), "");
});

test("all supported locales contain every action and result with truthful membership and ownership limits", () => {
  assert.equal(copy.associationLocale("en-US"), "en");
  assert.equal(copy.associationLocale("pt-PT"), "pt-BR");
  assert.equal(copy.associationLocale("es-AR"), "es-AR");
  for (const locale of ["es-AR", "en", "pt-BR"]) {
    const strings = copy.associationCopy[locale];
    for (const action of model.TAP_ASSOCIATION_ACTIONS) for (const text of Object.values(strings.actions[action])) assert.ok(text.trim());
    assert.deepEqual(Object.keys(strings.outcomes).sort(), Object.keys(copy.associationCopy["es-AR"].outcomes).sort());
    for (const text of Object.values(strings.outcomes)) assert.ok(text.trim());
    assert.match(strings.actions.claim.detail, /NFT/);
    assert.match(strings.outcomes.claimed, /NFT/);
  }
  assert.match(copy.associationCopy["es-AR"].actions.save.detail, /vincula.*empresa/);
  assert.match(copy.associationCopy["es-AR"].actions.join.detail, /guarda el producto/);
  assert.match(copy.associationCopy["es-AR"].outcomes.review_required, /no creó una solicitud/);
});

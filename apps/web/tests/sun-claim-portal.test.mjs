import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as postTapPolicy from "../src/app/sun/post-tap-policy.ts";
import * as sunTruthCopy from "../src/app/sun/sun-truth-copy.ts";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../src/app/sun/sun-claim-portal.tsx", import.meta.url), "utf8");
function load(locale = "es-AR") {
  const seen = [], module = { exports: {} };
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const bindings = {
    "./sun-locale-provider": { useSunLocale: () => ({ locale }) },
    "./consumer-passport-link": { ConsumerTapLink: props => {
      seen.push(props);
      return React.createElement("button", { type: "button", "data-qa-handoff": "true" }, props.children);
    } },
  };
  new Function("require", "module", "exports", js)(name => name in bindings ? bindings[name] : require(name), module, module.exports);
  return { ...module.exports, seen };
}
const eventId = "9007199254740993";
const href = `/me?fromTap=1&eventId=${eventId}&tenant=qa-brand&action=claim`;
const freshToken = "qa-only-private-capability";
const base = { href, eventId, freshToken, availability: "ready" };
function render(props = {}, locale = "es-AR") {
  const module = load(locale), originalFetch = globalThis.fetch;
  globalThis.fetch = () => assert.fail("render cannot request access, send a code or mutate ownership");
  try { return { html: renderToStaticMarkup(React.createElement(module.SunClaimPortal, { ...base, ...props })), seen: module.seen }; }
  finally { globalThis.fetch = originalFetch; }
}

test("ownership destination retains the exact event reference and explicit intent", () => {
  const { sunClaimPortalDestination } = load();
  const accepted = sunClaimPortalDestination(href, eventId);
  assert.ok(accepted);
  const url = new URL(accepted, "https://nexid.example");
  assert.equal(url.pathname, "/me");
  assert.equal(url.searchParams.get("eventId"), eventId);
  assert.equal(url.searchParams.get("action"), "claim");
  assert.equal(url.searchParams.get("tenant"), "qa-brand");
});

test("destinations cannot replace the event, duplicate context, leave the portal or expose secrets", () => {
  const { sunClaimPortalDestination: destination } = load();
  const invalid = [null, undefined, "", "/me", "/me/products", "/merchant", "//evil.example/me", `https://evil.example${href}`,
    href.replace(eventId, "99"), href.replace("action=claim", "action=save"), href + "#other",
    href + "&eventId=" + eventId, href + "&action=claim", href + "&fromTap=1",
    href + "&tenant=another", href + "&bid=a&bid=b",
    href.replace("qa-brand", "%0aother"), href.replace("qa-brand", "a".repeat(121)),
    href + "&bid=%00", href + "&bid=" + "a".repeat(201),
    ...["fresh", "freshToken", "fresh_token", "token", "pin", "share", "cmac", "capability", "next"].map(key => href + `&${key}=secret`),
  ];
  for (const value of invalid) assert.equal(destination(value, eventId), null, String(value));
  for (const invalidEvent of ["0", "01", "-1", "event-1", "9223372036854775808", ""]) {
    assert.equal(destination(href.replace(eventId, invalidEvent), invalidEvent), null, invalidEvent);
  }
});

test("a permitted request uses the existing handoff without rendering the capability", () => {
  const { html, seen } = render();
  assert.equal(seen.length, 1);
  assert.equal(seen[0].href, href);
  assert.equal(seen[0].eventId, eventId);
  assert.equal(seen[0].freshToken, freshToken);
  assert.doesNotMatch(html, /qa-only-private-capability|type="file"|type="password"|<form/);
});

test("blocked, stale, manual, pending and malformed destinations cannot prepare ownership access", () => {
  for (const availability of ["fresh_required", "manual_opened", "not_enabled", "busy"]) {
    const { html, seen } = render({ availability });
    assert.equal(seen.length, 0, availability);
    assert.doesNotMatch(html, /data-qa-handoff/);
  }
  for (const props of [{ href: null }, { href: href + "&pin=secret" }, { freshToken: "" }]) {
    assert.equal(render(props).seen.length, 0);
  }
});

test("help links only to the available report on the same passport", () => {
  assert.doesNotMatch(render().html, /href="#report-problem"/);
  for (const availability of ["ready", "not_enabled", "manual_opened", "fresh_required"]) {
    const { html } = render({ supportAvailable: true, availability });
    assert.match(html, /href="#report-problem"/);
    assert.doesNotMatch(html, /href="\/sun|support_token=|receiptFileData/);
  }
});

test("the active language changes the entry while retaining the same protected context", () => {
  const texts = [];
  for (const locale of ["es-AR", "en", "pt-BR"]) {
    const { html, seen } = render({ supportAvailable: true }, locale);
    assert.equal(seen[0].href, href);
    assert.match(html, /data-testid="sun-claim-portal"/);
    assert.doesNotMatch(html, /<input|<form|qa-only-private-capability/);
    texts.push(html);
  }
  assert.equal(new Set(texts).size, 3);
});

test("the actual CTA keeps legitimate opened reads and fails closed for demo, manual and contradictory blocked props", () => {
  const ctaSource = readFileSync(new URL("../src/app/sun/cta-actions.tsx", import.meta.url), "utf8");
  const js = ts.transpileModule(ctaSource, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const seen = [], module = { exports: {} };
  const bindings = {
    "./post-tap-policy": postTapPolicy,
    "./sun-truth-copy": sunTruthCopy,
    "./sun-claim-portal": { SunClaimPortal: props => {
      seen.push(props);
      return React.createElement("section", { "data-qa-availability": props.availability });
    } },
  };
  new Function("require", "module", "exports", js)(name => name in bindings ? bindings[name] : require(name), module, module.exports);
  const cases = [
    [{}, "ready"],
    [{ tapState: "opened" }, "ready"],
    [{ tapState: "manual_opened" }, "manual_opened"],
    [{ tapState: "blocked" }, "fresh_required"],
    [{ isDemoPreview: true }, "fresh_required"],
    [{ canExecute: false }, "fresh_required"],
    [{ allowedActions: [] }, "ready"], // Existing legacy deny-list contract.
    [{ allowedActions: ["provenance"] }, "not_enabled"],
    [{ blockedActions: ["claim"] }, "not_enabled"],
  ];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => assert.fail("server rendering an action never prepares or executes it");
  try {
    for (const [props, expected] of cases) {
      renderToStaticMarkup(React.createElement(module.exports.CtaActions, {
        bid: "QA-ONLY", eventId, freshToken, canExecute: true, tapState: "valid",
        allowedActions: ["claim"], blockedActions: [], claimHref: href, supportAvailable: true, ...props,
      }));
      const actual = seen.at(-1);
      assert.equal(actual.availability, expected, JSON.stringify(props));
      assert.equal(actual.supportAvailable, props.isDemoPreview !== true);
    }
  } finally { globalThis.fetch = originalFetch; }
});

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const Link = ({ prefetch, children, ...props }) => React.createElement("a", { ...props, "data-prefetch": String(prefetch) }, children);
const locale = { useSunLocale: () => ({ locale: "es-AR", text: value => value }) };
function load(file, bindings = {}) {
  const source = readFileSync(new URL(`../src/app/sun/${file}`, import.meta.url), "utf8");
  const module = { exports: {} };
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  new Function("require", "module", "exports", js)(name => name in bindings ? bindings[name] : require(name), module, module.exports);
  return module.exports;
}
const consumerLink = load("consumer-passport-link.tsx", {
  "next/link": { __esModule: true, default: Link },
  "next/navigation": { useRouter: () => ({ push: () => assert.fail("render cannot navigate") }) },
  "./sun-locale-provider": locale,
}).ConsumerTapLink;
function render(componentFile, componentName, props) {
  const seen = [];
  const component = load(componentFile, {
    "next/link": { __esModule: true, default: Link },
    "./sun-locale-provider": locale,
    "./post-tap-policy": load("post-tap-policy.ts"),
    "./sun-services-hub-model": load("sun-services-hub-model.ts"),
    "./consumer-passport-link": { ConsumerTapLink: (props) => { seen.push(props); return React.createElement(consumerLink, props); } },
  })[componentName];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => assert.fail("render cannot prepare a handoff or mutate an action");
  try { return { html: renderToStaticMarkup(React.createElement(component, props)), seen }; }
  finally { globalThis.fetch = originalFetch; }
}
const eventId = "9007199254740993", freshToken = "private-fixture-capability";
const base = {
  vertical: "wine", productName: "Vino", isFreshTap: true, isSnapshotView: false,
  protectedTitle: "Consulta", protectedCopy: "Nuevo tap requerido", primaryActionHref: "#protected-actions",
  rewardsHref: "/me/rewards?fromTap=1", marketplaceHref: "/me/marketplace?fromTap=1", walletHref: "/me/wallet?fromTap=1",
  certificateHref: "/certificado/713?share=read_only_fixture", reportProblemHref: "/contacto?event=713",
  eventId, freshToken,
};
const nextStep = (props = {}) => render("post-tap-next-step.tsx", "PostTapNextStep", { ...base, ...props });
const serviceBase = {
  purchaseHref: "/me/marketplace?fromTap=1", subscribeHref: "#subscribe", claimOrManageHref: "#protected-actions",
  warrantyHref: "https://brand.example/warranty", riskState: "clear", freshnessState: "fresh", locale: "es-AR",
  policyAvailability: { promotion: true, purchase: true, subscribe: true, claimOrManage: true, warranty: true },
  eventId, freshToken,
};
const services = (props = {}) => render("sun-services-hub.tsx", "SunServicesHub", { ...serviceBase, ...props });

test("secondary consumer links prepare the same event only on click and preserve ordinary destinations", () => {
  const { html, seen } = nextStep({ sealState: "opened" });
  assert.deepEqual(seen.map(link => link.href), [base.rewardsHref, base.marketplaceHref, base.walletHref]);
  assert.ok(seen.every(link => link.eventId === eventId && link.freshToken === freshToken));
  assert.equal((html.match(/data-testid="consumer-passport-handoff"/g) || []).length, 3);
  assert.match(html, /href="#protected-actions"/);
  assert.match(html, /href="#geo-trace"/);
  assert.match(html, /href="\/certificado\/713\?share=read_only_fixture"/);
  assert.match(html, /href="\/contacto\?event=713"[^>]*data-sun-experience-event="PROBLEM_REPORTED"/);
  assert.match(html, /data-sun-experience-event="LOYALTY_OFFER_VIEWED" data-sun-experience-placement="post_tap_options" data-sun-experience-interaction="rewards_opened"/);
  assert.doesNotMatch(html, /private-fixture-capability/);
});

test("primary consumer destinations reuse the bridge and similarly named or external routes do not", () => {
  const { seen } = nextStep({ primaryActionHref: "/me?fromTap=1", rewardsHref: "/merchant/club", marketplaceHref: "https://brand.example/shop", walletHref: "/membership" });
  assert.deepEqual(seen.map(link => link.href), ["/me?fromTap=1"]);
  assert.equal(seen[0].eventId, eventId);
});

test("historical and contradictory snapshot states cannot pass a fresh capability", () => {
  assert.equal(nextStep({ isFreshTap: false, isSnapshotView: true }).seen.length, 0);
  const snapshot = nextStep({ isSnapshotView: true });
  assert.ok(snapshot.seen.every(link => link.freshToken === ""));
  assert.doesNotMatch(snapshot.html, /consumer-passport-handoff|<button/);
  assert.match(snapshot.html, /href="\/me\/rewards\?fromTap=1"[^>]*data-prefetch="false"/);
});

test("services marketplace navigation uses the bridge while in-page and external resources stay links", () => {
  const { html, seen } = services();
  assert.deepEqual(seen.map(link => link.href), [serviceBase.purchaseHref]);
  assert.equal(seen[0].eventId, eventId);
  assert.equal(seen[0].freshToken, freshToken);
  assert.match(html, /href="#subscribe"/);
  assert.match(html, /href="#protected-actions"/);
  assert.match(html, /href="https:\/\/brand\.example\/warranty"/);
  assert.doesNotMatch(html, /private-fixture-capability/);
});

test("services stale, blocked and demo states never prepare navigation with a fresh capability", () => {
  for (const state of ["snapshot", "stale", "unknown"]) {
    const view = services({ freshnessState: state });
    assert.ok(view.seen.every(link => link.freshToken === ""));
    assert.doesNotMatch(view.html, /consumer-passport-handoff|<button/);
  }
  const blocked = services({ riskState: "blocked" });
  assert.ok(blocked.seen.every(link => link.freshToken === ""));
  assert.equal(services({ freshnessState: "demo" }).seen.length, 0);
});

test("without a capability, secondary consumer links remain unprefetched read-only navigation", () => {
  const view = nextStep({ freshToken: "" });
  assert.equal(view.seen.length, 3);
  assert.ok(view.seen.every(link => link.freshToken === ""));
  assert.equal((view.html.match(/data-prefetch="false"/g) || []).length, 3);
  assert.doesNotMatch(view.html, /consumer-passport-handoff|<button/);
});

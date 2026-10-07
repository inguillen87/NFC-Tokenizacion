import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as availability from "../src/app/sun/tenant-action-availability.ts";

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
function render(componentFile, componentName, props, activeLocale = "es-AR") {
  const seen = [];
  const component = load(componentFile, {
    "next/link": { __esModule: true, default: Link },
    "./sun-locale-provider": { useSunLocale: () => ({ locale: activeLocale, text: value => value }) },
    "./post-tap-policy": load("post-tap-policy.ts", { "./tenant-action-availability": availability }),
    "./tenant-action-availability": availability,
    "./sun-services-hub-model": load("sun-services-hub-model.ts"),
    "./sun-services-hub.module.css": { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) },
    "./consumer-passport-link": { ConsumerTapLink: (props) => { seen.push(props); return React.createElement(consumerLink, props); } },
  })[componentName];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => assert.fail("render cannot prepare a handoff or mutate an action");
  try { return { html: renderToStaticMarkup(React.createElement(component, props)), seen }; }
  finally { globalThis.fetch = originalFetch; }
}
const eventId = "9007199254740993", freshToken = "private-fixture-capability";
const configuration = { version: availability.TENANT_ACTIONS_VERSION, status: "published", allowedActions: ["marketplace", "lead"], catalogAvailable: true,
  program: { id: "program-a", name: "Programa", pointsName: "Puntos", pointsPerValidTap: 0 }, trivia: null };
const base = {
  configuration, verifiedTenant: true, allowedActions: ["claim", "tokenization", "provenance", "rewards", "marketplace"],
  vertical: "wine", productName: "Vino", isFreshTap: true, isSnapshotView: false,
  protectedTitle: "Consulta", protectedCopy: "Nuevo tap requerido", primaryActionHref: "#protected-actions",
  rewardsHref: "/me/rewards?fromTap=1", marketplaceHref: "/me/marketplace?fromTap=1", walletHref: "/me/wallet?fromTap=1",
  certificateHref: "/certificado/713?share=read_only_fixture", reportProblemHref: "/contacto?event=713",
  eventId, freshToken,
};
const nextStep = (props = {}) => render("post-tap-next-step.tsx", "PostTapNextStep", { ...base, ...props });
const serviceBase = {
  configuration, verifiedTenant: true,
  purchaseHref: "/me/marketplace?fromTap=1", subscribeHref: "#subscribe", claimOrManageHref: "#protected-actions",
  warrantyHref: "https://brand.example/warranty", riskState: "clear", freshnessState: "fresh", locale: "es-AR",
  policyAvailability: { promotion: true, purchase: true, subscribe: true, claimOrManage: true, warranty: true },
  eventId, freshToken,
};
const services = (props = {}, activeLocale = "es-AR") => render("sun-services-hub.tsx", "SunServicesHub", { ...serviceBase, ...props }, activeLocale);

test("server-rendered handoff buttons wait for hydration before accepting a click", () => {
  const html = renderToStaticMarkup(React.createElement(consumerLink, { href: "/me/products", eventId, freshToken }, "Mis productos"));
  assert.match(html, /<button[^>]*disabled=""[^>]*aria-busy="true"/);
  assert.doesNotMatch(html, /private-fixture-capability/);
});

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
  assert.doesNotMatch(snapshot.html, /href="\/me\/rewards\?fromTap=1"|href="\/me\/marketplace/);
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

test("unavailable company options remain visible as a partial notice beside independent services", () => {
  for (const configuration of [null, {}, { ...serviceBase.configuration, status: "unavailable" }]) {
    const { html, seen } = services({ configuration });
    assert.match(html, /data-testid="sun-services-unavailable"/);
    assert.match(html, /No pudimos cargar algunas opciones de la marca/);
    assert.match(html, /href="#protected-actions"/);
    assert.match(html, /href="https:\/\/brand\.example\/warranty"/);
    assert.doesNotMatch(html, /Solicitar compra|Suscribirme a novedades/);
    assert.equal(seen.length, 0, "an unavailable projection cannot prepare marketplace access");
    assert.equal((html.match(/data-testid="sun-services-unavailable"/g) || []).length, 1);
  }
});

test("unavailable notices distinguish no services, legitimate empty publication and demo", () => {
  const policyAvailability = { promotion: false, purchase: false, subscribe: false, claimOrManage: false, warranty: false };
  const unavailable = services({ configuration: null, policyAvailability }).html;
  assert.match(unavailable, /data-testid="sun-services-unavailable"/);
  assert.equal((unavailable.match(/No pudimos cargar las opciones de la marca/g) || []).length, 1);
  assert.doesNotMatch(unavailable, /No pudimos cargar algunas opciones|href="#protected-actions"|href="https:\/\/brand\.example\/warranty"/);
  for (const status of ["published", "unpublished"]) {
    const html = services({ configuration: { ...serviceBase.configuration, status, allowedActions: [], catalogAvailable: false }, policyAvailability }).html;
    assert.doesNotMatch(html, /data-testid="sun-services-unavailable"|No pudimos cargar/);
    assert.match(html, status === "unpublished" ? /todavía no habilitó experiencias/ : /No hay experiencias habilitadas/);
  }
  assert.doesNotMatch(services({ configuration: null, freshnessState: "demo" }).html, /data-testid="sun-services-unavailable"|No pudimos cargar/);
  const blocked = services({ configuration: null, riskState: "blocked" }).html;
  assert.doesNotMatch(blocked, /href="#protected-actions"|href="https:\/\/brand\.example\/warranty"|Solicitar compra/);
});

test("partial configuration feedback follows the active language without changing independent rights", () => {
  for (const [activeLocale, expected] of [["es-AR", /No pudimos cargar algunas opciones/], ["en", /We could not load some of the brand&#x27;s options/], ["pt-BR", /Não foi possível carregar algumas opções/]]) {
    const { html } = services({ configuration: null, freshnessState: "snapshot" }, activeLocale);
    assert.match(html, expected);
    assert.match(html, /href="#protected-actions"/);
    assert.match(html, /href="https:\/\/brand\.example\/warranty"/);
    assert.doesNotMatch(html, /Solicitar compra|consumer-passport-handoff|private-fixture-capability/);
  }
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

test("read-only collection remains an ordinary link without hydration or a capability", () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => assert.fail("a read-only render cannot prepare access");
  try {
    const html = renderToStaticMarkup(React.createElement(consumerLink, { href: "/me/products", eventId, freshToken: "" }, "Productos guardados"));
    assert.match(html, /<a[^>]*href="\/me\/products"[^>]*data-prefetch="false"/);
    assert.match(html, />Productos guardados<\/a>/);
    assert.doesNotMatch(html, /<button|role="alert"|freshToken|private-fixture-capability/);
  } finally { globalThis.fetch = originalFetch; }
});

test("server render never labels a handoff as failed before a deliberate request", () => {
  const html = renderToStaticMarkup(React.createElement(consumerLink, { href: "/me/products?fromTap=1", eventId, freshToken }, "Abrir colección"));
  assert.match(html, />Abrir colección<\/button>/);
  assert.doesNotMatch(html, /role="alert"|data-handoff-failure|Reintentar acceso|Nueva lectura necesaria/);
  assert.doesNotMatch(html, /href="\/me\/products\?fromTap=1"/);
});

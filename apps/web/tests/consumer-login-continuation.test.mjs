import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { consumerAuthStartPayload, normalizeConsumerAuthReturnPath } from "../src/app/login/consumer-login-continuation.ts";

test("consumer login disables its automatic return and access-choice prefetch while BackLink preserves other callers", async () => {
  const require = createRequire(import.meta.url), observed = [];
  const link = { __esModule: true, default: ({ children, prefetch, ...props }) => {
    observed.push({ href: props.href, prefetch });
    return React.createElement("a", props, children);
  } };
  const compile = (path, overrides) => {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    const { outputText } = ts.transpileModule(source, { fileName: path, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } });
    const loaded = { exports: {} };
    new Function("require", "module", "exports", outputText)(name => Object.hasOwn(overrides, name) ? overrides[name] : require(name), loaded, loaded.exports);
    return loaded.exports;
  };
  const { BackLink } = compile("../src/components/back-link.tsx", { "next/link": link });
  for (const props of [{}, { href: "/docs", prefetch: false }, { href: "/docs", prefetch: true }]) {
    observed.length = 0;
    renderToStaticMarkup(React.createElement(BackLink, props));
    assert.deepEqual(observed, [{ href: props.href ?? "/", prefetch: props.prefetch }]);
  }
  const Page = compile("../src/app/login/page.tsx", {
    "next/link": link,
    "next/headers": { cookies: async () => ({ get: () => undefined }) },
    "@product/config": { productUrls: { app: "https://dashboard.example.test" } },
    "@product/config/safe-return-path": { normalizeSafeReturnPath: value => value === "/me" ? value : "/me" },
    "@product/ui": { Card: ({ children }) => React.createElement("div", null, children), ThemeToggle: () => null },
    "@product/ui/theme-preference": { THEME_PREFERENCE_VERSION_COOKIE: "theme-version", resolveThemePreference: () => "light" },
    "../../components/back-link": { BackLink },
    "../../components/brand-home-link": { BrandHomeLink: () => null },
    "../../lib/locale": { getWebI18n: async () => ({ locale: "es-AR" }) },
    "./consumer-login-panel": { ConsumerLoginPanel: () => null },
    "./consumer-login.module.css": { __esModule: true, default: new Proxy({}, { get: (_, name) => String(name) }) },
  }).default;
  for (const params of [{ consumer: "1", next: "/me" }, {}]) {
    observed.length = 0;
    renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params) }));
    const controlled = observed.filter(link => link.href === "/" || link.href === "/login" || link.href === "/login?consumer=1&next=%2Fme");
    assert.equal(controlled.length, 2);
    assert.ok(controlled.every(link => link.prefetch === false));
    assert.deepEqual(controlled.map(link => link.href), ["/", params.consumer ? "/login" : "/login?consumer=1&next=%2Fme"]);
    if (!params.consumer) assert.ok(observed.find(link => link.href === "/docs").prefetch === undefined, "unrelated access choices preserve their existing default");
  }
});

test("email continuation preserves product selection without transmitting TAP or device credentials", () => {
  const next = "/me/products?tenant=balmec&bid=RA-2407&eventId=9007199254740993&fromTap=1&action=products&focus=9007199254740993&freshToken=private-capability&uid=tag-secret&mac=nfc-signature&ctr=000001&picc_data=private&lat=-32.9&lng=-68.8&contact=private%40example.test#history";
  const sanitized = "/me/products?fromTap=1&eventId=9007199254740993&focus=9007199254740993&bid=RA-2407&tenant=balmec&action=products";
  assert.equal(normalizeConsumerAuthReturnPath(next), sanitized);
  assert.deepEqual(consumerAuthStartPayload({ email: "persona@example.test" }, next), { email: "persona@example.test", next: sanitized });
  assert.deepEqual(consumerAuthStartPayload({ phone: "+5491155551234" }, next), { phone: "+5491155551234" });
});

test("normal consumer and legacy nonconsumer destinations do not change the OTP start contract", () => {
  for (const next of [undefined, null, "/me", "/docs", "/sun?uid=secret&mac=signature", "/login?t=private", "https://evil.example", "//evil.example", "/\\evil.example", "/%2e%2e//evil.example"]) {
    assert.equal(normalizeConsumerAuthReturnPath(next), "/me");
    assert.deepEqual(consumerAuthStartPayload({ email: "persona@example.test" }, next), { email: "persona@example.test" });
  }
});

test("only existing consumer routes can be sent in the email link", () => {
  for (const route of ["/me", "/me/products", "/me/passport", "/me/brands", "/me/wallet", "/me/marketplace", "/me/rewards", "/me/experiences", "/me/sommelier", "/me/taps", "/me/privacy", "/me/security", "/me/cork-analyzer", "/me/taps/9223372036854775807"]) {
    assert.equal(normalizeConsumerAuthReturnPath(route), route, route);
  }
  for (const route of ["/me/unknown", "/me/products/", "/me/taps/0", "/me/taps/01", "/me/taps/9223372036854775808", "/me/taps/9007199254740993/claim", "/me/taps/demo-sun-preview"]) {
    assert.equal(normalizeConsumerAuthReturnPath(route), "/me", route);
  }
});

test("ambiguous or invalid continuation fields fall back rather than select a partial TAP", () => {
  for (const query of [
    "fromTap=1&fromTap=1", "eventId=1&event%49d=2", "tenant=balmec&tenant=other", "bid=A&bid=B", "focus=1&focus=2", "action=save&action=claim",
    "eventId=0", "eventId=01", "eventId=9223372036854775808", "eventId=1e3", "eventId=", "fromTap=true", "fromTap=0",
    "tenant=bad%2Fslug", "tenant=", `tenant=${"a".repeat(121)}`, "bid=private%40example.test", `bid=${"a".repeat(201)}`, "action=delete", "action=SAVE", "focus=not-an-id",
  ]) assert.equal(normalizeConsumerAuthReturnPath(`/me/products?${query}`), "/me", query);
  assert.equal(normalizeConsumerAuthReturnPath("/me/products?eventId=1&next=https%3A%2F%2Fevil.example&token=private#private"), "/me/products?eventId=1");
});

test("browser-normalized and nested encoded unsafe forms never become email destinations", () => {
  for (const next of ["\\\\evil.example", "%2F%2Fevil.example", "%252F%252Fevil.example", "/%5C%5Cevil.example", "/me?eventId=1%00", "/me?tenant=%E0%A4%A", "/me?tenant=%252525252561", "/me/taps/1%2F..%2F..%2Funknown", "javascript%3Aalert(1)", `/${"x".repeat(2048)}`]) {
    assert.equal(normalizeConsumerAuthReturnPath(next), "/me", next);
  }
});

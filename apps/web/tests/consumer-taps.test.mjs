import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const dir = new URL("../src/app/me/", import.meta.url);
const modelSource = readFileSync(new URL("_components/consumer-taps-model.ts", dir), "utf8");
const pageSource = readFileSync(new URL("taps/page.tsx", dir), "utf8");
const css = readFileSync(new URL("taps/taps.module.css", dir), "utf8");

function compile(source, overrides = {}) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const loaded = { exports: {} };
  const localRequire = (name) => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  new Function("require", "module", "exports", compiled)(localRequire, loaded, loaded.exports);
  return loaded.exports;
}

const model = compile(modelSource);
const sharedApi = compile(readFileSync(new URL("_components/consumer-api.ts", dir), "utf8"), {
  "next/headers": { headers: () => { throw new Error("unexpected-headers-read"); } },
  "next/navigation": { redirect: () => { throw new Error("unexpected-redirect"); } },
  "./consumer-portal-model": { shouldRedirectToConsumerAuth: () => false },
});
const styles = new Proxy({}, { get: (_, name) => String(name) });
const list = (items = []) => ({ ok: true, items });
const record = (overrides = {}) => ({
  tap_event_id: 703, verdict: "VALID_CLOSED", risk_level: "low", city: "Mendoza", country: "AR",
  created_at: "2026-09-06T01:22:29Z", tenant_slug: "demobodega", tenant_name: "Bodega Balmec", ...overrides,
});
const renderedText = (html) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

function loadPage(payload, { authorize = async () => {} } = {}) {
  const calls = [];
  const links = [];
  const page = compile(pageSource, {
    "../_components/consumer-api": {
      buildConsumerNextPath: sharedApi.buildConsumerNextPath,
      requireConsumerSession: async (path) => { calls.push(["session", path]); await authorize(); },
      fetchConsumerPath: async (path) => { calls.push(["fetch", path]); return payload; },
    },
    "../_components/consumer-taps-model": model,
    "../_components/me-portal-interactive-client": { ConsumerDataRetryButton: () => React.createElement("button", { type: "button" }, "Reintentar carga") },
    "../_components/portal-shell": { PortalShell: ({ title, subtitle, children }) => React.createElement("main", null, React.createElement("h1", null, title), React.createElement("p", null, subtitle), children) },
    "./taps.module.css": { __esModule: true, default: styles },
    "next/link": { __esModule: true, default: ({ children, prefetch, ...props }) => { links.push({ prefetch, ...props }); return React.createElement("a", props, children); } },
  }).default;
  return { page, calls, links };
}

test("a source requires a successful typed envelope; an unavailable response is never an empty history", () => {
  for (const invalid of [null, undefined, [], {}, { items: [] }, { ok: false, items: [] }, { ok: "true", items: [] }, { ok: true, items: {} }, { ok: true, items: [null] }, { ok: true, items: ["wrong"] }, { ok: true, items: [[]] }]) {
    assert.deepEqual(model.buildConsumerTapsSource(invalid), { status: "unavailable", data: null });
  }
  assert.deepEqual(model.buildConsumerTapsSource(list()), { status: "ready", data: [] });
  for (const value of [null, undefined, 1, "event", []]) assert.equal(model.parseConsumerTap(value), null);
});

test("display fields are allowlisted and a missing record field remains unknown", () => {
  const tap = model.parseConsumerTap(record({ product_name: "Filtro industrial", brand_name: "Agua", bid: "LOTE-7", consumer_id: "private-consumer", uid: "private-uid", token: "private-token", share: "private-share", phone: "private-phone" }));
  assert.equal(tap.productName, "Filtro industrial");
  assert.equal(tap.brandName, "Agua");
  assert.equal(tap.tenantName, "Bodega Balmec");
  assert.equal(tap.batch, "LOTE-7");
  assert.equal(tap.location, "Mendoza, AR");
  assert.doesNotMatch(JSON.stringify(tap), /private-|consumer_id|phone|token|share/);
  const missing = model.parseConsumerTap({});
  assert.equal(missing.status, "unknown");
  assert.equal(missing.id, null);
  assert.equal(missing.href, null);
  assert.equal(missing.location, null);
  assert.equal(missing.tenantName, null);
  assert.equal(missing.risk.kind, "unreported");
});

test("all five reported risk categories are translated without NaN or unknown-to-none coercion", () => {
  for (const [raw, category, label] of [["none", "none", "Sin señal de riesgo"], ["low", "low", "Riesgo bajo"], [" MEDIUM ", "medium", "Riesgo medio"], ["HIGH", "high", "Riesgo alto"], [" CRITICAL ", "critical", "Riesgo crítico"]]) {
    assert.deepEqual(model.parseConsumerTap({ risk_level: raw }).risk, { kind: "category", category, label });
  }
});

test("only explicit finite risk scores in range are shown; null and unknown do not become zero", () => {
  for (const value of [0, 42.5, 100, "0", "23.5", "100"]) {
    assert.deepEqual(model.parseConsumerTap({ risk_level: value }).risk, { kind: "score", score: Number(value), label: `Puntaje de riesgo: ${Number(value)}` });
  }
  for (const value of [null, undefined, "", " ", true, false, NaN, Infinity, -1, 101, "-1", "101", "unknown", "NaN", "1e2", "0x10", "12px", {}, []]) {
    assert.deepEqual(model.parseConsumerTap({ risk_level: value }).risk, { kind: "unreported", label: "Riesgo no informado" });
  }
});

test("message classifications match exact positive and explicit attention codes, never substring guesses", () => {
  const positive = ["VALID", "TAP_VALID", "AUTH_OK", "VALID_AUTHENTIC", "VALID_CLOSED", "VALID_UNKNOWN_TAMPER", "OPENED", "OPENED_PREVIOUSLY", "MANUAL_OPENED", "VALID_OPENED", "VALID_OPENED_PREVIOUSLY", "VALID_MANUAL_OPENED"];
  const attention = ["REPLAY", "REPLAY_SUSPECT", "DUPLICATE", "INVALID", "TAP_INVALID", "SUN_PROFILE_MISMATCH", "SUN_BATCH_DUPLICATE_CONFIG", "UNKNOWN_BATCH", "NOT_REGISTERED", "NOT_ACTIVE", "REVOKED", "BROKEN", "TAMPER", "TAMPERED", "TAMPER_RISK", "TAMPER_UNVERIFIED", "MALFORMED_URL"];
  for (const verdict of positive) assert.equal(model.parseConsumerTap({ verdict }).status, "validated", verdict);
  for (const verdict of attention) assert.equal(model.parseConsumerTap({ verdict }).status, "attention", verdict);
  for (const verdict of [undefined, null, "", "UNKNOWN", "NOT_VALID", "INVALID_FUTURE_RESULT", "VENDOR_TAMPER", "NOT_BLOCKED", "__proto__", "constructor"]) {
    assert.equal(model.parseConsumerTap({ verdict }).status, "unknown", verdict);
    assert.equal(model.parseConsumerTap({ verdict }).statusLabel, "Resultado no confirmado", verdict);
  }
  assert.equal(model.parseConsumerTap({ verdict: " valid_closed " }).status, "validated");
  assert.equal(model.parseConsumerTap({ verdict: "VALID_UNKNOWN_TAMPER" }).statusLabel, "Mensaje validado · sello no confirmado");
});

test("a validated message and a high reported risk remain independent facts", () => {
  const tap = model.parseConsumerTap(record({ verdict: "VALID_OPENED", risk_level: "high" }));
  assert.equal(tap.status, "validated");
  assert.equal(tap.statusLabel, "Sello abierto reportado");
  assert.equal(tap.risk.category, "high");
  assert.doesNotMatch(JSON.stringify(tap), /claimable|canRedeem|ownership|consent/);
});

test("private detail links preserve canonical PostgreSQL bigint strings while legacy numbers must be safe", () => {
  for (const value of [1, "703", "900001", Number.MAX_SAFE_INTEGER, "9007199254740992", "9007199254740993", "9223372036854775807"]) {
    const tap = model.parseConsumerTap({ tap_event_id: value });
    assert.equal(tap.id, String(value));
    assert.equal(tap.href, `/me/taps/${String(value)}`);
  }
  for (const value of [0, "0", -1, "-1", "01", "+1", " 900001 ", "900001\n", "1\t", 1.5, "1.5", "1e2", "9223372036854775808", "99999999999999999999", Number.MAX_SAFE_INTEGER + 1, null, undefined, "", "demo-sun-preview", "3/../account", "1?token=private", {}, []]) {
    const tap = model.parseConsumerTap({ tap_event_id: value });
    assert.equal(tap.id, null, String(value));
    assert.equal(tap.href, null, String(value));
  }
});

test("dates normalize explicit ISO and PostgreSQL offsets to UTC, including seconds", () => {
  for (const created_at of ["2026-09-06T01:22:29Z", "2026-09-05T22:22:29-03:00", "2026-09-06 01:22:29.000000+00", "2026-09-05 22:22:29-0300"]) {
    const tap = model.parseConsumerTap({ created_at });
    assert.equal(tap.dateTime, "2026-09-06T01:22:29.000Z");
    assert.match(tap.date, /01:22:29 UTC$/);
  }
  for (const created_at of [null, undefined, "", "bad", "2026-09-06", "2026-09-06T01:22:29", "2026-09-06 01:22:29", "2026-02-31T01:22:29Z", "2026-02-29T01:22:29Z", "2026-09-06T24:00:00Z", "2026-09-06T01:22:60Z", "2026-13-01T01:22:29Z"]) {
    const tap = model.parseConsumerTap({ created_at });
    assert.equal(tap.date, "Fecha no informada", String(created_at));
    assert.equal(tap.dateTime, null, String(created_at));
  }
  assert.equal(model.parseConsumerTap({ created_at: "2024-02-29T01:22:29Z" }).dateTime, "2024-02-29T01:22:29.000Z");
});

test("the list preserves the server order and is bounded at 200 without inventing a lifetime total", () => {
  const items = Array.from({ length: 205 }, (_, index) => record({ tap_event_id: 1000 - index }));
  const payload = list(items);
  const source = model.buildConsumerTapsSource(payload);
  assert.equal(model.CONSUMER_TAPS_LIMIT, 200);
  assert.equal(source.data.length, 200);
  assert.equal(source.data[0].id, "1000");
  assert.equal(source.data[199].id, "801");
  assert.deepEqual(Object.keys(source), ["status", "data"]);
  assert.equal(payload.items.length, 205);
});

test("history authenticates before its single read and preserves the continuation query", async () => {
  let allow;
  const pendingAuthorization = new Promise((resolve) => { allow = resolve; });
  const { page, calls } = loadPage(list(), { authorize: () => pendingAuthorization });
  const pending = page({ searchParams: Promise.resolve({ fromTap: "1", tenant: "real-tenant", eventId: "703", action: ["portal", "history"] }) });
  await new Promise(setImmediate);
  assert.deepEqual(calls, [["session", "/me/taps?fromTap=1&tenant=real-tenant&eventId=703&action=portal&action=history"]]);
  allow();
  await pending;
  assert.deepEqual(calls[1], ["fetch", "taps"]);
  assert.equal(calls.length, 2);
});

test("a denied session prevents all history source reads", async () => {
  const { page, calls } = loadPage(list(), { authorize: async () => { throw new Error("redirect-login"); } });
  await assert.rejects(() => page({}), /redirect-login/);
  assert.deepEqual(calls, [["session", "/me/taps"]]);
});

test("an unavailable history renders a manual retry instead of empty or zero counters", async () => {
  for (const payload of [null, { ok: false, items: [] }, { ok: true, items: [null] }]) {
    const html = renderToStaticMarkup(await loadPage(payload).page({}));
    assert.match(html, /role="status"/);
    assert.match(html, /No pudimos cargar tus lecturas/);
    assert.match(html, /Reintentar carga/);
    assert.doesNotMatch(html, /Todavía no hay lecturas|0 lecturas|en esta lista|Risk Level|NaN/);
  }
});

test("a valid empty history has a physical tap instruction, not demo data or a bare SUN preview link", async () => {
  const html = renderToStaticMarkup(await loadPage(list()).page({}));
  const text = renderedText(html);
  assert.match(text, /Todavía no hay lecturas asociadas/);
  assert.match(text, /Acercá el teléfono a una etiqueta NFC/);
  assert.match(html, /href="\/me\/products"/);
  assert.doesNotMatch(html, /No pudimos cargar|Reintentar carga|href="\/sun|0 lecturas|Bodega|Balmec|Gran Reserva/);
});

test("real readings have private detail actions and disclose technical data without pervasive warnings", async () => {
  const { page, links } = loadPage(list([record({ product_name: "Filtro industrial", brand_name: "Empresa Agua", bid: "LOTE-7" }), record({ tap_event_id: 704, verdict: "VALID_OPENED", risk_level: "high" })]));
  const html = renderToStaticMarkup(await page({}));
  assert.match(html, /Filtro industrial/);
  assert.match(html, /Empresa Agua/);
  assert.match(html, /Bodega Balmec/);
  assert.match(html, /2 lecturas en esta lista/);
  assert.match(html, /Zona reportada: Mendoza, AR/);
  assert.match(html, /datetime="2026-09-06T01:22:29.000Z"/i);
  assert.match(html, /01:22:29 UTC/);
  assert.match(html, /Riesgo bajo/);
  assert.match(html, /data-status="validated"/);
  assert.match(html, /data-risk="high"/);
  assert.match(html, /Sello abierto reportado/);
  assert.equal((html.match(/<summary>Datos del registro/g) || []).length, 2);
  assert.equal((html.match(/<summary>Cómo leer los resultados/g) || []).length, 1);
  assert.doesNotMatch(html, /NaN|Risk Level|Autenticación física|href="\/certificado|GPS consentido/);
  const details = links.filter((link) => /^\/me\/taps\/\d+$/.test(link.href));
  assert.deepEqual(details.map((link) => link.href), ["/me/taps/703", "/me/taps/704"]);
  assert.ok(details.every((link) => link.prefetch === false));
});

test("unknown results and missing risk or IDs stay neutral without fake links, scores or alarms", async () => {
  const { page, links } = loadPage(list([{ verdict: "UNKNOWN_VENDOR_RESULT", tenant_slug: "another-brand", risk_level: null }]));
  const html = renderToStaticMarkup(await page({}));
  assert.match(html, /data-status="unknown"/);
  assert.match(html, /Resultado no confirmado/);
  assert.match(html, /Riesgo no informado/);
  assert.match(html, /Fecha no informada/);
  assert.match(html, /Zona no reportada/);
  assert.match(html, /Detalle no disponible: falta la referencia/);
  assert.doesNotMatch(html, /data-status="attention"|data-status="validated"|Riesgo bajo|Puntaje de riesgo: 0|Alerta TT|Escaneo Replay Bloqueado/);
  assert.ok(!links.some((link) => link.href.startsWith("/me/taps/")));
});

test("SSR preserves bigint reading links and exposes none/critical risk without rounding or invented safety", async () => {
  const { page, links } = loadPage(list([
    record({ tap_event_id: "9007199254740993", risk_level: "none" }),
    record({ tap_event_id: "9223372036854775807", verdict: "REPLAY", risk_level: "critical" }),
  ]));
  const html = renderToStaticMarkup(await page({}));
  const detailLinks = links.filter((link) => link.href.startsWith("/me/taps/"));
  assert.deepEqual(detailLinks.map((link) => link.href), ["/me/taps/9007199254740993", "/me/taps/9223372036854775807"]);
  assert.match(html, /data-risk="none"/);
  assert.match(html, /Sin señal de riesgo/);
  assert.match(html, /data-risk="critical"/);
  assert.match(html, /Riesgo crítico/);
  assert.match(html, /data-status="attention"/);
  assert.match(html, /Lectura repetida por revisar/);
  assert.doesNotMatch(html, /Riesgo no informado|Producto seguro|Replay Bloqueado|NaN/);
});

test("rendered history states its 200-row sample limit and never labels that sample as a total", async () => {
  const html = renderToStaticMarkup(await loadPage(list(Array.from({ length: 205 }, (_, index) => record({ tap_event_id: index + 1 })))).page({}));
  assert.match(html, /Hasta 200 lecturas asociadas/);
  assert.match(html, /200 lecturas en esta lista/);
  assert.match(html, /no es un total histórico/);
  assert.equal((html.match(/aria-label="Abrir lectura /g) || []).length, 200);
  assert.doesNotMatch(html, /href="\/me\/taps\/201"|Lecturas Totales|Alertas \/ Bloqueos|205 lecturas/);
});

function contrast(a, b) {
  const luminance = (hex) => {
    const values = hex.match(/[a-f\d]{2}/gi).map((value) => parseInt(value, 16) / 255).map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
  };
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}

test("history inherits the portal light/dark palette, has readable attention pairs and touch/focus treatment", () => {
  assert.match(css, /var\(--portal-text\)/);
  assert.match(css, /var\(--portal-surface\)/);
  assert.match(css, /html\[data-theme="dark"\]/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /min-height: 46px/);
  assert.match(css, /@media \(max-width: 520px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /\.risk\[data-risk="critical"\]/);
  for (const pair of [["#86500f", "#fff6e7"], ["#f8d197", "#3d2d1d"], ["#08755d", "#ffffff"], ["#85e8c1", "#102737"]]) assert.ok(contrast(...pair) >= 4.5, pair.join("/"));
  assert.doesNotMatch(css, /animation:|@keyframes|infinite/);
  assert.doesNotMatch(pageSource, /animate-pulse|setInterval|setTimeout|Math\.random|Date\.now|asArray|\.includes\("VALID"\)|method="post"/);
});

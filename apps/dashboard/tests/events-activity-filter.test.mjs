import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "esbuild";
import { normalizeTenantTapRealtimeEvent } from "@product/core";
import { eventsFilterHref, filterEventsActivitySample, normalizeEventsActivityFilter } from "../src/lib/events-activity-filter.ts";

const sourceUrl = new URL("../src/app/(app)/events/page.tsx", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const css = await readFile(new URL("../src/app/(app)/events/events.module.css", import.meta.url), "utf8");
const row = (id, result, reason = "", extras = {}) => ({
  id, result, reason, verdict: "valid", source: "real", tenantSlug: "fixture-tenant", uidHex: `TEST-${id}`, bid: "LOT-01",
  createdAt: "2026-09-06T01:22:18Z", eventType: "TAP_VALID", cmacOk: true, allowlisted: true, tagId: `tag-${id}`,
  location: { city: "Mendoza", country: "AR", lat: null, lng: null },
  device: { os: "Android", browser: "Chrome", deviceType: "mobile", timezone: "" },
  ...extras,
});
const sample = [
  row(1, "VALID_CLOSED"),
  row(2, "VALID_OPENED", "tagtamper_opened:4F4F"),
  row(3, "UNKNOWN_BATCH", "", { verdict: "unknown_batch", eventType: "UNKNOWN" }),
  row(4, "IDENTIFIED_UNVERIFIED", "", { verdict: "identified_unverified", eventType: "PROVENANCE_VIEWED" }),
  row(5, "VALID", "BLOCKED_REPLAY"),
  row(6, "VALID_UNKNOWN_TAMPER"),
];

test("activity filter follows canonical security signals, not every unverified or opened product", () => {
  const classified = sample.map((raw) => ({ raw, event: normalizeTenantTapRealtimeEvent(raw) }));
  const before = structuredClone(classified);
  assert.deepEqual(filterEventsActivitySample(classified, "risk").map(({ raw }) => raw.id), [2, 5]);
  assert.deepEqual(filterEventsActivitySample(classified, "all").map(({ raw }) => raw.id), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(classified, before);
  assert.deepEqual(filterEventsActivitySample([], "risk"), []);
  assert.equal(normalizeEventsActivityFilter("risk"), "risk");
  for (const unknown of [undefined, null, "all", "invalid", "RISK", {}]) assert.equal(normalizeEventsActivityFilter(unknown), "all");
});

test("retry query preserves all resolved filters without reusing the API limit or mutating input", () => {
  const params = new URLSearchParams({ tenant: "fixture-tenant", source: "real", range: "7d", uid: "TAG-01", bid: "LOT / 02", result: "VALID_OPENED", limit: "250" });
  const before = params.toString();
  const url = new URL(eventsFilterHref(params, "risk"), "https://example.invalid");
  for (const key of ["tenant", "source", "range", "uid", "bid", "result"]) assert.equal(url.searchParams.get(key), params.get(key));
  assert.equal(url.searchParams.get("filter"), "risk");
  assert.equal(url.searchParams.has("limit"), false);
  assert.equal(params.toString(), before);
  assert.equal(new URL(eventsFilterHref(params, "all"), url).searchParams.has("filter"), false);
});

// Render the actual async page offline. Authentication policy, canonical event
// semantics, scope query construction and all form controls remain production
// code; only sessions, transport, navigation and child table mechanics are inert.
const fixtureKey = "__nexidEventsPageFixture";
const stubs = {
  "./events.module.css": "export default {}",
  "next/link": 'import {createElement} from "react";export default function Link(props){return createElement("a",props)}',
  "@product/ui": 'import {createElement} from "react";export function SectionHeading({title}){return createElement("h1",null,title)}',
  "../../../components/data-table": `import {createElement} from "react";export function DataTable({title,rows,emptyLabel}){globalThis.${fixtureKey}.renderedRows=rows;return createElement("section",{"data-testid":"events-fixture-table"},createElement("h2",null,title),rows.length?JSON.stringify(rows):emptyLabel)}`,
  "../../../components/enterprise-ops-state": 'import {createElement} from "react";export function EnterpriseOpsState({title,description,action,testId}){return createElement("section",{"data-testid":testId},createElement("h2",null,title),createElement("p",null,description),action)}',
  "../../../lib/locale": "export async function getDashboardI18n(){return {locale:'es-AR'}}",
  "../../../lib/session": `export async function requireDashboardSession(){return globalThis.${fixtureKey}.session}`,
  "../../../lib/admin-page-access": `export async function createAdminPageContext(session,tenant){const bound=session.role!=='super_admin';return {tenantSlug:bound?session.tenantSlug:tenant||'',canSelectTenant:!bound}};export async function fetchAdminPage(context,path){const fixture=globalThis.${fixtureKey};fixture.calls.push({context,path});return {ok:fixture.ok,json:async()=>fixture.payload}}`,
};
const bundle = await build({
  entryPoints: [fileURLToPath(sourceUrl)], bundle: true, write: false,
  format: "cjs", platform: "node", jsx: "automatic", logLevel: "silent",
  external: ["react", "react/jsx-runtime", "lucide-react"],
  plugins: [{ name: "offline-events-page-render", setup(builder) {
    builder.onResolve({ filter: /.*/ }, (args) => Object.hasOwn(stubs, args.path) ? { path: args.path, namespace: "fixture" } : undefined);
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({ contents: stubs[args.path], loader: "js" }));
  } }],
});
const loaded = { exports: {} };
new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
const EventsPage = loaded.exports.default;
async function render(query = {}, options = {}) {
  const fixture = {
    session: { role: "tenant_admin", permissions: ["events.read_sensitive"], deniedPermissions: [], tenantSlug: "fixture-tenant", isDemo: false },
    calls: [], renderedRows: [], ok: true, payload: { rows: sample }, ...options,
  };
  globalThis[fixtureKey] = fixture;
  try {
    const html = renderToStaticMarkup(await EventsPage({ searchParams: Promise.resolve(query) }));
    return { html, ...fixture };
  } finally { delete globalThis[fixtureKey]; }
}

test("risk URL renders only the bounded risk sample and keeps authentication independent", async () => {
  const result = await render({ filter: "risk", source: "demo", tenant: "other-company", range: "7d", uid: "test-2", bid: "LOT-01" });
  assert.equal(result.calls.length, 1);
  const apiQuery = new URL(result.calls[0].path, "https://example.invalid").searchParams;
  assert.equal(apiQuery.get("limit"), "250");
  assert.equal(apiQuery.get("tenant"), "fixture-tenant");
  assert.equal(apiQuery.get("source"), "real");
  assert.equal(apiQuery.get("range"), "7d");
  assert.equal(apiQuery.get("uid"), "TEST-2");
  assert.equal(apiQuery.get("bid"), "LOT-01");
  assert.equal(apiQuery.has("filter"), false, "risk is an explicit refinement of the received sample, not a made-up API parameter");
  assert.deepEqual(result.renderedRows.map((item) => item.uid), ["TEST-2", "TEST-5"]);
  assert.equal(result.renderedRows[0].status, "Riesgo explícito");
  assert.equal(result.renderedRows[0].authentication, "Verificada");
  assert.equal(result.renderedRows[0].time, new Date("2026-09-06T01:22:18Z").toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }));
  assert.match(result.html, /hora de Argentina \(UTC−03:00\)/);
  assert.match(result.html, /2 de 6 eventos de la muestra/);
  assert.match(result.html, /no al historial completo/);
  assert.match(result.html, /<option value="risk" selected="">Riesgo explícito/);
  assert.match(result.html, /type="hidden" name="source" value="real"/);
  assert.match(result.html, /href="\/\?tenant=fixture-tenant&amp;view=physical-taps"/);
});

test("denied sensitive permission stops before context or events fetch", async () => {
  const denied = await render({ filter: "risk" }, { session: { role: "tenant_admin", permissions: ["events.read_sensitive"], deniedPermissions: ["events.read_sensitive"], tenantSlug: "fixture-tenant" } });
  assert.equal(denied.calls.length, 0);
  assert.match(denied.html, /events-access-denied/);
  assert.doesNotMatch(denied.html, /events-fixture-table|events-sample-summary/);
});

test("failure preserves retry criteria and does not display a false zero or table", async () => {
  const result = await render({ filter: "risk", uid: "test-2", bid: "LOT-01", result: "VALID_OPENED", range: "7d" }, { ok: false });
  assert.match(result.html, /events-source-unavailable/);
  assert.doesNotMatch(result.html, /events-sample-summary|events-fixture-table|0 de 0/);
  const retryMatch = result.html.match(/href="([^"]+)"[^>]*>Reintentar con estos filtros/);
  assert.ok(retryMatch);
  const retry = new URL(retryMatch[1].replaceAll("&amp;", "&"), "https://example.invalid");
  for (const [key, value] of Object.entries({ filter: "risk", tenant: "fixture-tenant", source: "real", uid: "TEST-2", bid: "LOT-01", result: "VALID_OPENED", range: "7d" })) assert.equal(retry.searchParams.get(key), value);
});

test("confirmed empty and unknown classifications are not failures; demo stays demo", async () => {
  const empty = await render({ filter: "risk" }, { payload: { rows: sample.filter((item) => [1, 3, 4, 6].includes(item.id)) } });
  assert.match(empty.html, /No hay señales de riesgo explícito en esta muestra/);
  assert.match(empty.html, /0 de 4 eventos de la muestra/);
  assert.doesNotMatch(empty.html, /events-source-unavailable/);
  const demo = await render({ source: "real" }, { session: { role: "tenant_admin", permissions: ["events.read_sensitive"], tenantSlug: "fixture-tenant", isDemo: true } });
  assert.equal(new URL(demo.calls[0].path, "https://example.invalid").searchParams.get("source"), "demo");
  assert.match(demo.html, /Demo · datos ilustrativos/);
});

test("events controls are labeled, keyboard-visible, touch-sized and retain query context", () => {
  assert.doesNotMatch(source, /ModuleAudienceHero|CEO \/ Investor|Buyer \/ Client/);
  assert.match(source, /<label>Tipo de actividad<select[^>]+name="filter"/);
  assert.match(source, /<label>Período<select[^>]+name="range"/);
  for (const field of ["uid", "bid", "result", "tenant"]) assert.match(source, new RegExp(`<label>[^<]+<input[^>]+name="${field}"`));
  assert.match(source, /type="hidden" name="source" value=\{source\}/);
  assert.match(source, /<form action="\/events" method="get"/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /min-height: 2\.75rem/);
  assert.match(css, /html\.theme-light/);
  assert.match(css, /max-width: 480px/);
  assert.match(css, /\.workspace \{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /\.workspace > \* \{[^}]*min-width: 0;[^}]*max-width: 100%/);
});

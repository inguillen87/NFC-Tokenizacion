import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "esbuild";
import { OPS_DESTINATION_KEYS, resolveOpsDestinationAccess } from "../src/lib/ops-destination-access.ts";
import { DASHBOARD_DESTINATIONS, dashboardCanOpenDestination } from "../src/lib/dashboard-destination-policy.ts";

const sourceUrl = new URL("../src/components/ops-command-center.tsx", import.meta.url);
// Render the actual component offline. Only CSS and navigation mechanics are
// inert; chart markers preserve their input so incompatible units cannot hide
// behind an empty chart stub. Permission decisions and copy are production code.
const stubs = {
  "./ops-command-center.module.css": "export default {}",
  "next/link": 'import {createElement} from "react"; export default function Link(props){return createElement("a",props)}',
  recharts: [
    'import {createElement, Fragment} from "react"',
    'export function ResponsiveContainer({children}){return createElement(Fragment,null,children)}',
    ...["AreaChart", "BarChart"].map((name) => `export function ${name}({data,children}){return createElement("div",{"data-ops-chart":"${name}","data-ops-series":JSON.stringify(data)},children)}`),
    ...["Area", "Bar", "CartesianGrid", "Tooltip", "XAxis", "YAxis"].map((name) => `export function ${name}(){return null}`),
  ].join(";"),
};
const bundle = await build({
  entryPoints: [fileURLToPath(sourceUrl)], bundle: true, write: false,
  format: "cjs", platform: "node", jsx: "automatic", logLevel: "silent",
  external: ["react", "react/jsx-runtime", "lucide-react"],
  plugins: [{ name: "offline-ops-render", setup(builder) {
    builder.onResolve({ filter: /.*/ }, (args) => Object.hasOwn(stubs, args.path)
      ? { path: args.path, namespace: "fixture" } : undefined);
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({ contents: stubs[args.path], loader: "js" }));
  } }],
});
const loaded = { exports: {} };
new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
const { OpsCommandCenter } = loaded.exports;

const fixture = {
  mode: "tenant", metrics: [{ label: "Lecturas", value: "3", detail: "Fixture local" }],
  steps: [], funnel: [{ stage: "Tap", value: 3 }], readiness: [],
  tenants: [{ name: "Empresa de prueba", slug: "local-fixture", scans: 3, riskScore: 0, batches: 1, tags: 10, status: "healthy" }],
};
function render(access, overrides = {}) {
  return renderToStaticMarkup(React.createElement(OpsCommandCenter, {
    ...fixture, allowedDestinations: access === undefined ? undefined : resolveOpsDestinationAccess(access), ...overrides,
  }));
}
const hrefs = (html) => [...html.matchAll(/<a\b[^>]* href="([^"]+)"/g)].map((match) => match[1]);
const baseHref = (href) => href.split("?")[0];
const hasDestination = (html, destination) => hrefs(html).some((href) => baseHref(href) === DASHBOARD_DESTINATIONS[destination].href);
function disclosure(html, testId) {
  const match = html.match(new RegExp(`<details\\b([^>]*data-testid="${testId}"[^>]*)>([\\s\\S]*?)<\\/details>`));
  assert.ok(match, `${testId} must be a native disclosure`);
  assert.doesNotMatch(match[1], /\bopen(?:\s|=|$)/, `${testId} starts collapsed`);
  assert.match(match[2], /<summary\b/, `${testId} has a keyboard-operable summary`);
  return { html: match[0], content: match[2], index: match.index };
}

test("Ops resolves only the existing sidebar and destination policy, including explicit denies", () => {
  for (const access of [
    { role: "tenant_admin", permissions: ["events.read_sensitive", "crm:read", "analytics:read"] },
    { role: "tenant-admin", permissions: ["tags:read", "batches:read"] },
    { role: "operations-manager", permissions: ["tags:*", "batches:*", "api_keys.read"] },
    { role: "marketing-manager", permissions: ["crm:read", "rewards:read", "campaigns:read"] },
    { role: "super-admin", permissions: ["*"] },
    { role: "super-admin", permissions: ["*"], deniedPermissions: ["tags:*", "api_keys.read", "campaigns:read"] },
    { role: "unknown", permissions: ["*"] },
  ]) {
    const resolved = resolveOpsDestinationAccess(access);
    assert.deepEqual(Object.keys(resolved), OPS_DESTINATION_KEYS);
    assert.deepEqual(JSON.parse(JSON.stringify(resolved)), resolved, "only serializable booleans cross into Ops");
    for (const destination of OPS_DESTINATION_KEYS) {
      assert.equal(resolved[destination], dashboardCanOpenDestination(destination, access), `${access.role}: ${destination}`);
    }
  }
});

test("limited tenant keeps events usable without links or prefetches to unavailable modules", () => {
  const access = { role: "tenant_admin", permissions: ["events.read_sensitive", "crm:read", "analytics:read"] };
  const html = render(access);
  const links = hrefs(html);
  assert.ok(links.includes("/events"));
  assert.ok(hasDestination(html, "sdkVision"));
  for (const destination of ["tags", "batches", "supplierBatches", "tokenization", "apiKeys", "rewards", "campaigns"]) {
    assert.ok(!links.some((href) => baseHref(href) === DASHBOARD_DESTINATIONS[destination].href), destination);
  }
  assert.doesNotMatch(html.match(/<table\b[^>]*>[\s\S]*?<\/table>/)?.[0] || "", /Sin acceso a:/);
});

test("permitted operational actions precede collapsed restrictions, whose cards cannot receive focus or navigate", () => {
  const html = render({ role: "tenant_admin", permissions: ["events.read_sensitive", "rewards:read"] });
  const restricted = disclosure(html, "ops-restricted-destinations");
  const technical = disclosure(html, "ops-technical-resources");
  const operationalContent = html.slice(0, Math.min(restricted.index, technical.index));
  assert.ok(hasDestination(operationalContent, "events"));
  assert.ok(hasDestination(operationalContent, "rewards"));
  assert.doesNotMatch(operationalContent, /data-unavailable-destination=/);

  const unavailableArticles = [...html.matchAll(/<article\b[^>]*data-unavailable-destination="([^"]+)"[^>]*>[\s\S]*?<\/article>/g)];
  assert.ok(unavailableArticles.length > 0, "the restricted destinations remain discoverable");
  for (const article of unavailableArticles) {
    assert.doesNotMatch(article[0], /<a\b|\bhref=|\btabindex=/i, article[1]);
    assert.match(article[0], /No habilitado para tu cuenta/, article[1]);
    assert.ok(restricted.html.includes(article[0]), `${article[1]} stays in the restricted disclosure`);
  }
  assert.doesNotMatch(restricted.html, /<a\b|\bhref=/i);
});

test("SDK and API resources stay inside a collapsed technical disclosure and retain explicit denies", () => {
  for (const access of [
    { role: "tenant_admin", permissions: ["events.read_sensitive", "crm:read", "analytics:read"] },
    { role: "super-admin", permissions: ["*"] },
    { role: "super-admin", permissions: ["*"], deniedPermissions: ["api_keys.read"] },
  ]) {
    const html = render(access);
    const technical = disclosure(html, "ops-technical-resources");
    const outside = html.replace(technical.html, "");
    for (const destination of ["sdkVision", "apiKeys"]) {
      assert.equal(hasDestination(technical.html, destination), dashboardCanOpenDestination(destination, access), destination);
      assert.equal(hasDestination(outside, destination), false, `${destination} must not compete with operational actions`);
    }
  }
});

test("tenant source rows preserve granted links and omit denied destinations even when source counts exist", () => {
  const html = render({
    role: "tenant-admin", permissions: ["batches:*", "tags:*", "events.read_sensitive"],
    deniedPermissions: ["tags:read", "events.read_sensitive"],
  });
  const table = html.match(/<table\b[^>]*>[\s\S]*?<\/table>/)?.[0];
  assert.ok(table, "source-backed tenant rows remain available");
  assert.match(table, /Empresa de prueba/);
  assert.deepEqual(hrefs(table), [DASHBOARD_DESTINATIONS.batches.href]);
  assert.doesNotMatch(table, /href="\/(?:tags|events)(?:[?"/])/);
  for (const value of [3, 1, 10]) assert.match(table, new RegExp(`<td\\b[^>]*>${value}<\\/td>`));
});

test("batch read does not imply supplier access and CRM read does not imply rewards access", () => {
  const links = hrefs(render({ role: "tenant-admin", permissions: ["batches:read", "tags:read", "crm:read"] }));
  assert.ok(links.includes("/batches"));
  assert.ok(links.includes("/tags"));
  assert.ok(!links.includes("/batches/supplier"));
  assert.ok(!links.includes("/loyalty/rewards"));
  assert.ok(!links.includes("/events"));
});

test("global mode never grants access; valid super admin grants preserve global navigation", () => {
  assert.deepEqual(hrefs(render(undefined, { mode: "global" })), []);
  assert.deepEqual(hrefs(render({ role: "unknown", permissions: ["*"] }, { mode: "global" })), []);
  const links = hrefs(render({ role: "super-admin", permissions: ["*"] }, { mode: "global" }));
  for (const destination of OPS_DESTINATION_KEYS.filter((key) => key !== "batches")) {
    assert.ok(links.some((href) => baseHref(href) === DASHBOARD_DESTINATIONS[destination].href), destination);
  }
  assert.ok(links.includes("/?tenant=local-fixture"));
  const denied = hrefs(render({ role: "super-admin", permissions: ["*"], deniedPermissions: ["tags:*", "tokenization:*", "api_keys.read"] }, { mode: "global" }));
  for (const href of ["/tags", "/tokenization", "/api-keys"]) assert.ok(!denied.includes(href));
});

test("missing or non-boolean presentation flags fail closed without changing source-backed metrics", () => {
  for (const allowedDestinations of [undefined, {}, { tags: "true", events: 1, overview: false }]) {
    const html = render(undefined, { allowedDestinations });
    assert.deepEqual(hrefs(html), []);
    assert.match(html, /Empresa de prueba/);
    assert.match(html, />3<\/(?:p|strong|b|span)>/);
  }
});

test("empty sources never synthesize zero metrics, setup prerequisites or readiness totals", () => {
  const html = render({ role: "super-admin", permissions: ["*"] }, {
    metrics: [], steps: [], tenants: [], funnel: [], readiness: [],
  });
  assert.doesNotMatch(html, /<p\b[^>]*>0<\/p>|Sin lotes en el scope actual|Importar manifest para activar|Completar tenant y assets/);
  assert.doesNotMatch(html, /\b0\s*\/\s*0\s*listo|>\s*0%\s*<|role="progressbar"/);
  assert.doesNotMatch(html, /data-ops-chart=/);
  assert.doesNotMatch(html, /data-testid="ops-readiness-details"/);
  assert.match(html, /No hay indicadores informados para esta vista/);
});

test("a source-reported zero remains visible with its own label and evidence", () => {
  const html = render({ role: "tenant_admin", permissions: ["events.read_sensitive"] }, {
    metrics: [{ label: "Lecturas confirmadas", value: "0", detail: "Fuente local: ningún evento en la ventana consultada" }],
  });
  assert.match(html, /Lecturas confirmadas/);
  assert.match(html, />0<\/(?:p|strong|b|span)>/);
  assert.match(html, /Fuente local: ningún evento en la ventana consultada/);
  assert.doesNotMatch(html, /No hay indicadores informados para esta vista/);
});

test("global mode does not turn three ready steps into a 75 percent operational completion claim", () => {
  const html = render({ role: "super-admin", permissions: ["*"] }, {
    mode: "global",
    steps: [
      { label: "Registro recibido", body: "Dato de prueba A", status: "ready", owner: "Operaciones" },
      { label: "Manifest disponible", body: "Dato de prueba B", status: "ready", owner: "Operaciones" },
      { label: "Lectura recibida", body: "Dato de prueba C", status: "ready", owner: "Operaciones" },
      { label: "QA pendiente", body: "Dato de prueba D", status: "blocked", owner: "Seguridad" },
    ],
  });
  assert.doesNotMatch(html, /75%|\b3\s*\/\s*4\s*listo|role="progressbar"|Estado orientativo de etapas/);
  assert.match(html, /Empresa de prueba/);
});

test("counts of companies, batches, tags and readings do not become a shared conversion chart", () => {
  const html = render({ role: "super-admin", permissions: ["*"] }, {
    mode: "global",
    funnel: [{ stage: "Empresas", value: 1 }, { stage: "Lotes", value: 2 }, { stage: "Tags", value: 120 }, { stage: "Lecturas", value: 900 }],
    readiness: [{ label: "Manifest", ready: 2, pending: 1 }, { label: "Tags", ready: 120, pending: 3 }],
  });
  assert.doesNotMatch(html, /data-ops-chart=/, "different units have no common denominator or conversion meaning");
  assert.doesNotMatch(html, /Volúmenes por etapa/);
  assert.match(html, /Fixture local/);
});

test("reported readiness stays collapsed and each native progress uses its own source denominator", () => {
  const readiness = [{ label: "Manifest", ready: 2, pending: 1 }, { label: "Tags", ready: 120, pending: 3 }];
  const html = render({ role: "super-admin", permissions: ["*"] }, { mode: "global", readiness });
  const details = disclosure(html, "ops-readiness-details");
  const progress = [...details.html.matchAll(/<progress\b([^>]*)>/g)];
  assert.equal(progress.length, readiness.length);
  assert.doesNotMatch(html.replace(details.html, ""), /<progress\b/);
  readiness.forEach((row, index) => {
    assert.ok(details.html.includes(row.label));
    const value = Number(progress[index][1].match(/\bvalue="([^"]+)"/)?.[1]);
    const max = Number(progress[index][1].match(/\bmax="([^"]+)"/)?.[1]);
    assert.ok(Number.isFinite(value) && Number.isFinite(max) && max > 0, row.label);
    assert.ok(Math.abs(value / max - row.ready / (row.ready + row.pending)) < 0.0051, `${row.label} must not share another row's denominator`);
  });
  assert.doesNotMatch(details.html, /data-ops-chart=/);
});

test("zero or invalid readiness bases have explanatory text and no invented percentage or bar", () => {
  for (const counts of [
    { ready: 0, pending: 0 },
    { ready: Number.NaN, pending: 1 },
    { ready: 1, pending: Number.POSITIVE_INFINITY },
    { ready: -1, pending: 2 },
    { ready: 2, pending: -1 },
  ]) {
    const html = render({ role: "super-admin", permissions: ["*"] }, {
      readiness: [{ label: "Fuente sin base válida", ...counts }],
    });
    const details = disclosure(html, "ops-readiness-details");
    assert.match(details.html, /Sin base para calcular/);
    assert.doesNotMatch(details.html, /<progress\b|role="progressbar"|\d+(?:[.,]\d+)?%|\bNaN\b|\bInfinity\b/);
  }
});

test("every Ops caller forwards the validated server decisions with no role-based bypass or new request", async () => {
  const paths = ["../src/app/(app)/page.tsx", "../src/app/(app)/batches/page.tsx", "../src/app/(app)/superadmin-network/page.tsx"];
  for (const path of paths) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /const session = await requireDashboardSession\(/, path);
    assert.match(source, /(?:opsDestinationAccess|allowedDestinations)=\{resolveOpsDestinationAccess\(session\)\}/, path);
  }
  const home = await readFile(new URL("../src/components/dashboard-home-client.tsx", import.meta.url), "utf8");
  assert.match(home, /allowedDestinations=\{opsDestinationAccess\}/);
  const source = await readFile(sourceUrl, "utf8");
  assert.match(source, /allowedDestinations\?\.\[destination\] === true/);
  assert.doesNotMatch(source, /\bfetch\(|setInterval\(|localStorage|permissions:|role === "super-admin"/);
});

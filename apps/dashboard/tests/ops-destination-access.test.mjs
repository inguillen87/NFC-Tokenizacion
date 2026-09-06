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
// Render the actual component offline. Only CSS, navigation mechanics and charts
// are inert; permission decisions, cards, row links and copy are production code.
const stubs = {
  "./ops-command-center.module.css": "export default {}",
  "next/link": 'import {createElement} from "react"; export default function Link(props){return createElement("a",props)}',
  recharts: ["Area", "AreaChart", "Bar", "BarChart", "CartesianGrid", "ResponsiveContainer", "Tooltip", "XAxis", "YAxis"]
    .map((name) => `export function ${name}(){return null}`).join(";"),
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
  assert.ok(links.includes("/sdk-vision?vertical=agro"));
  for (const destination of ["tags", "batches", "supplierBatches", "tokenization", "apiKeys", "rewards", "campaigns"]) {
    assert.ok(!links.some((href) => baseHref(href) === DASHBOARD_DESTINATIONS[destination].href), destination);
  }
  for (const article of html.matchAll(/<article\b[^>]*data-unavailable-destination="([^"]+)"[^>]*>([\s\S]*?)<\/article>/g)) {
    assert.doesNotMatch(article[2], /<a\b|href=|tabindex=/, article[1]);
    assert.match(article[2], /No habilitado para tu cuenta/);
  }
  assert.match(html.replaceAll("<!-- -->", ""), /Sin acceso a: Lotes, Tags/);
  assert.match(html, /solicitá su habilitación al administrador de tu empresa/);
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
    assert.match(html, />3<\/p>/);
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

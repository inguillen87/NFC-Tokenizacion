import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

import { canDemoSandboxAccess } from "../src/lib/admin-proxy-policy.ts";
import { customerRecordQuantity } from "../src/lib/customer-inbox-state.ts";
import { resolveDashboardTenantScope } from "../src/lib/dashboard-tenant-scope-policy.ts";
import { readDemoDataMetaFromResponse } from "../src/lib/demo-data-mode.ts";
import { requiredPermissionForAdminResource } from "../src/lib/permission-policy.ts";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [rewardsPage, rewardsClient, loyaltyPage, overviewPage, campaignsPage, offersPage] = await Promise.all([
  read("../src/app/(app)/loyalty/rewards/page.tsx"),
  read("../src/app/(app)/loyalty/rewards/rewards-client.tsx"),
  read("../src/app/(app)/loyalty/page.tsx"),
  read("../src/app/(app)/loyalty/overview/page.tsx"),
  read("../src/app/(app)/loyalty/campaigns/page.tsx"),
  read("../src/app/(app)/consumer-network/offers/page.tsx"),
]);

test("admin BFF maps commercial reads and writes to their existing capabilities", () => {
  assert.equal(requiredPermissionForAdminResource("GET", "loyalty/overview"), "crm:read");
  assert.equal(requiredPermissionForAdminResource("GET", "loyalty/rewards"), "rewards:read");
  assert.equal(requiredPermissionForAdminResource("POST", "loyalty/rewards"), "rewards:write");
  assert.equal(requiredPermissionForAdminResource("GET", "loyalty/trivia/overview"), "campaigns:read");
  assert.equal(requiredPermissionForAdminResource("POST", "campaigns/test-whatsapp"), "campaigns:test_whatsapp");
  assert.equal(requiredPermissionForAdminResource("POST", "rewards/redemptions/validate"), "rewards:validate");
  assert.equal(requiredPermissionForAdminResource("GET", "consumer-network/overview"), "crm:read");
  assert.equal(requiredPermissionForAdminResource("GET", "consumer-network/offers"), "marketplace:read");
  assert.equal(requiredPermissionForAdminResource("PATCH", "consumer-network/offers"), "marketplace:write");
});

test("demo policy permits declared commercial reads but rejects reward mutations", () => {
  assert.equal(canDemoSandboxAccess("GET", "loyalty/overview"), true);
  assert.equal(canDemoSandboxAccess("GET", "loyalty/rewards"), true);
  assert.equal(canDemoSandboxAccess("GET", "loyalty/trivia/overview"), true);
  assert.equal(canDemoSandboxAccess("POST", "loyalty/rewards"), false);
  assert.equal(canDemoSandboxAccess("POST", "campaigns/test-whatsapp"), false);
});

test("commercial pages enforce the same read permissions exposed by navigation", () => {
  assert.match(rewardsPage, /requireDashboardSession\("rewards:read"\)/);
  assert.match(campaignsPage, /requireDashboardSession\("campaigns:read"\)/);
  assert.match(overviewPage, /requireDashboardSession\("crm:read"\)/);
  assert.match(offersPage, /requireDashboardSession\("marketplace:read"\)/);
});

test("rewards requires explicit global intent and separates confirmed empty, forbidden and upstream failure", () => {
  assert.match(rewardsPage, /loyalty\/rewards\?scope=global/);
  assert.match(rewardsPage, /const canWrite = Boolean\(tenantScope\) && !session\.isDemo/);
  assert.match(rewardsPage, /"ready_empty" \| "forbidden" \| "upstream_error"/);
  assert.match(rewardsPage, /response\.status === 403/);
  assert.match(rewardsPage, /meta\.demoMode/);
  assert.match(rewardsPage, /reason: "illustrative_presets"/);
  assert.match(overviewPage, /loyalty\/rewards\?scope=global/);
});

test("RewardsClient is explicitly source-aware and cannot expose mutations in demo or read-only sessions", () => {
  for (const prop of ["isDemo", "canWrite", "dataSource"]) {
    assert.match(rewardsClient, new RegExp(`${prop}:`));
  }
  assert.match(rewardsClient, /!latestSource\.current\.canWrite/);
  assert.match(rewardsClient, /!mounted\.current \|\| !canWrite \|\| !tenantScope\.trim\(\)/);
  assert.match(rewardsClient, /\{canWrite \? \([\s\S]*Nuevo Beneficio/);
  assert.match(rewardsClient, /isModalOpen && canWrite/);
  assert.match(rewardsClient, /Datos ilustrativos · sin persistencia/);
  assert.match(rewardsClient, /fuente respondió correctamente y confirmó que todavía no hay beneficios/);
  assert.match(rewardsClient, /No se pudo confirmar la fuente de recompensas/);
});

// Real hub Page with synthetic session and BFF transport. Child UI is represented by native markup.
const require = createRequire(import.meta.url);
const compiledHub = ts.transpileModule(loyaltyPage, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
} }).outputText;
const tenant = "qa-loyalty-hub";
const tenantActor = { role: "tenant-admin", tenantSlug: tenant, permissions: ["crm:read", "rewards:read"] };
const hubCopy = { nav: { loyalty: "Fidelización" }, pages: { loyalty: { title: "Fidelización" } }, tableFeedback: {}, shell: {} };
const SectionHeading = ({ title }) => React.createElement("h1", null, title);
const Link = ({ href, children }) => React.createElement("a", { href }, children);
const Table = ({ title }) => React.createElement("h2", null, title);
const bff = (body, status = 200, mode = "production") => Response.json(body, {
  status, headers: mode ? { "x-nexid-data-mode": mode } : {},
});
const catalog = (rewards, slug = tenant) => ({ ok: true, tenant: slug, scope: slug ? "tenant" : "global", rewards });
const reward = (status, tenant_slug = tenant) => ({ code: status, title: "Beneficio " + status, points: 0, status, tenant_slug });
const nodes = value => Array.isArray(value) ? value.flatMap(nodes)
  : value && typeof value === "object" && value.props ? [value, ...nodes(value.props.children)] : [];

async function renderHub({ overview, rewards, session = tenantActor, query = { tenant: "different-company" } }) {
  const requests = [];
  const permissions = [];
  const overrides = new Map([
    ["@product/ui", { SectionHeading }],
    ["next/link", Link],
    ["../../../components/data-table", { DataTable: Table }],
    ["../../../lib/dashboard-content", { dashboardContent: { "es-AR": hubCopy } }],
    ["../../../lib/locale", { getDashboardI18n: async () => ({ locale: "es-AR" }) }],
    ["../../../lib/session", { requireDashboardSession: async capability => { permissions.push(capability); return session; } }],
    ["../../../lib/admin-page-access", {
      createAdminPageContext: async (actor, requestedTenant) => resolveDashboardTenantScope(actor, requestedTenant),
      fetchAdminPage: async (scope, path) => {
        requests.push({ tenant: scope.tenantSlug, path });
        if (path === "/admin/loyalty/overview") return overview;
        if (path === "/admin/loyalty/rewards" || path === "/admin/loyalty/rewards?scope=global") return rewards;
        assert.equal(path, "/superadmin/loyalty/portfolio");
        return bff({ portfolio: [] });
      },
    }],
    ["../../../lib/customer-inbox-state", { customerRecordQuantity }],
    ["../../../lib/demo-data-mode", { readDemoDataMetaFromResponse }],
  ]);
  const module = { exports: {} };
  new Function("module", "exports", "require", compiledHub)(module, module.exports, name => {
    if (overrides.has(name)) return overrides.get(name);
    assert.equal(name, "react/jsx-runtime");
    return require(name);
  });
  const page = await module.exports.default({ searchParams: Promise.resolve(query) });
  assert.deepEqual(permissions, ["rewards:read"]);
  return { page, requests, html: renderToStaticMarkup(page), table: nodes(page).find(node => node.type === Table) };
}

function indicator(page, label) {
  const cards = nodes(page).filter(node => node.type === "article" && node.props.children[0].props.children === label);
  assert.equal(cards.length, 1, label);
  const [, value, detail, demo] = cards[0].props.children;
  return { value: value.props.children, detail: detail.props.children, demo: Boolean(demo) };
}

test("loyalty hub keeps explicit zero, marks its missing sibling and counts every configured reward status", async () => {
  const result = await renderHub({ overview: bff({ points_issued: 0 }), rewards: bff(catalog([reward("active"), reward("paused"), reward("archived")])) });
  assert.equal(indicator(result.page, "Puntos acreditados").value, "0");
  assert.deepEqual(indicator(result.page, "Inscripciones en programas"), { value: "—", detail: "No informado por la fuente", demo: false });
  assert.equal(indicator(result.page, "Recompensas configuradas").value, "3");
  assert.deepEqual(result.table.props.rows.map(row => row.status), ["active", "paused", "archived"]);
  assert.match(result.html, /href="\/loyalty\/configuration\?tenant=qa-loyalty-hub"/);
  assert.doesNotMatch(result.html, /Recompensas activas|Loyalty Engine Activo/);
  assert.deepEqual(result.requests, [{ tenant, path: "/admin/loyalty/rewards" }, { tenant, path: "/admin/loyalty/overview" }]);
});

test("loyalty hub withholds only malformed totals and refuses an unidentified BFF source", async () => {
  for (const points_issued of [null, "0", -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const result = await renderHub({ overview: bff({ points_issued, total_members: 7 }), rewards: bff(catalog([])) });
    assert.deepEqual(indicator(result.page, "Puntos acreditados"), { value: "—", detail: "No se pudo confirmar este dato", demo: false });
    assert.equal(indicator(result.page, "Inscripciones en programas").value, "7");
    assert.equal(indicator(result.page, "Recompensas configuradas").value, "0");
  }
  const ambiguous = await renderHub({ overview: bff({ points_issued: 0, total_members: 0 }, 200, null), rewards: bff(catalog([])) });
  assert.equal(indicator(ambiguous.page, "Puntos acreditados").value, "—");
  assert.equal(indicator(ambiguous.page, "Inscripciones en programas").value, "—");
  assert.equal(indicator(ambiguous.page, "Recompensas configuradas").value, "0");
});

test("loyalty hub keeps catalog availability independent and identifies demo even alongside a denied source", async () => {
  const demo = await renderHub({ overview: bff({}, 403), rewards: bff(catalog([reward("draft")]), 200, "demo") });
  assert.deepEqual(indicator(demo.page, "Puntos acreditados"), { value: "—", detail: "No disponible con tus permisos", demo: false });
  assert.equal(indicator(demo.page, "Recompensas configuradas").demo, true);
  assert.match(demo.html, /Los indicadores marcados como Demo/);
  const fallback = await renderHub({ overview: bff({ points_issued: 0, total_members: 0 }), rewards: bff({ ok: true, demo: true, path: "loyalty/rewards" }, 200, "demo") });
  assert.deepEqual(indicator(fallback.page, "Recompensas configuradas"), { value: "—", detail: "Fuente no disponible", demo: false });
  assert.equal(fallback.table, undefined);
  assert.doesNotMatch(fallback.html, /Los indicadores marcados como Demo/);
  const missingTenant = { code: "missing-tenant", title: "Beneficio de control", points: 0, status: "active" };
  for (const rewards of [catalog([], "different-company"), catalog([null]), catalog([missingTenant]), catalog([reward("active", "  ")]), catalog([reward("active", "different-company")]), catalog([reward("active", ` ${tenant}`)])]) {
    const rejected = await renderHub({ overview: bff({ points_issued: 0, total_members: 0 }), rewards: bff(rewards) });
    assert.equal(indicator(rejected.page, "Puntos acreditados").value, "0");
    assert.equal(indicator(rejected.page, "Inscripciones en programas").value, "0");
    assert.equal(indicator(rejected.page, "Recompensas configuradas").value, "—");
    assert.equal(rejected.table, undefined);
  }
});

test("loyalty hub retains the explicit global rewards path and super-admin portfolio read", async () => {
  const longTenantSlug = "global-company-" + "x".repeat(129);
  const result = await renderHub({ session: { ...tenantActor, role: "super-admin", tenantSlug: null }, query: {}, overview: bff({ points_issued: 0, total_members: 0 }), rewards: bff(catalog([reward("active"), reward("paused", longTenantSlug)], null)) });
  assert.deepEqual(result.requests, [
    { tenant: "", path: "/superadmin/loyalty/portfolio" },
    { tenant: "", path: "/admin/loyalty/rewards?scope=global" },
    { tenant: "", path: "/admin/loyalty/overview" },
  ]);
  assert.equal(indicator(result.page, "Recompensas configuradas").value, "2");
});

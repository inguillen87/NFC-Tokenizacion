import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as permissions from "../src/lib/permission-policy.ts";
import * as consumerTruth from "../src/lib/consumer-network-overview-truth.ts";
import { loyaltyOverviewReadinessPriorHash, LOYALTY_OVERVIEW_READINESS_REVIEWED_SOURCES, LOYALTY_OVERVIEW_METRIC_COPY_SOURCE, LOYALTY_OVERVIEW_COVERAGE_SOURCE } from "./helpers/loyalty-overview-readiness-reviewed-sources.mjs";
import { resolveDashboardTenantScope } from "../src/lib/dashboard-tenant-scope-policy.ts";
import { LOYALTY_OVERVIEW_RECOVERY_SOURCE_BASE, LOYALTY_OVERVIEW_RECOVERY_REVIEWED_SOURCES, loyaltyOverviewRecoveryPriorHash } from "./helpers/loyalty-overview-recovery-reviewed-sources.mjs";
import { REWARD_PROGRAM_CONTEXT_REVIEWED_SOURCES } from "./helpers/reward-program-context-reviewed-sources.mjs";

// The full server Page, including adminGet, is compiled from its real source.
// Sessions/context are synthetic request-boundary adapters; real permission and
// tenant-scope functions run. fetchAdminPage is the sole transport substitute.
// Link/panel markers permit server-element rendering without mounting Next or
// the independent client panel. No session, browser, tenant or DB acceptance.
const require = createRequire(import.meta.url);
const pageSource = readFileSync(new URL("../src/app/(app)/loyalty/overview/page.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(pageSource, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
  },
}).outputText;

const paths = Object.freeze({
  loyalty: "/admin/loyalty/overview",
  consumer: "/admin/consumer-network/overview",
  rewards: "/admin/loyalty/rewards",
});
const tenant = "qa-company";
const principal = Object.freeze({
  id: "synthetic-overview-session",
  role: "tenant-admin",
  tenantSlug: tenant,
  permissions: ["crm:read"],
  deniedPermissions: [],
  isDemo: false,
});
const loyalty = Object.freeze({ active_programs: 2, total_members: 123, points_issued: 456, points_redeemed: 78 });
const consumer = Object.freeze({
  ok: true, tenant,
  overview: {
    totalActivity: 90, totalTaps: 60, customerActions: 30,
    activityWithKnownActor: 45, activityWithoutActor: 45, actorLinkedActivityRate: 50,
    recognizedUnits: 15, knownActors: 20, verifiedIdentityActors: 10, activeTenantMembers: 20,
    consentPurpose: "marketing", consentedActorsByChannel: { email: 4, whatsapp: 3, phone: 2 },
    savedProducts: 8, riskBlockedClaims: 7,
  },
  provenance: {
    contractVersion: "consumer-network-event-provenance/v1", state: "classified", primaryScope: "operational_tap",
    timezone: "UTC", physicalPresenceClaim: "not_asserted",
    counts: { operationalTap: 60, declaredDemo: 2, imported: 0, legacyUnclassified: 0, mixed: 0 },
    hasIsolatedRecords: true, latestOperationalAt: "2026-11-01T11:00:00.000Z", observedAt: "2026-11-01T12:00:00.000Z",
    evidenceBasis: { operationalTap: "Synthetic classified fixture", declaredDemo: "Isolated synthetic demo rows", legacyUnclassified: "No legacy fixture rows" },
  },
  identityBoundary: "Synthetic activity, never a real customer or physical-presence claim.", topProductsByClaims: [],
});
const reward = Object.freeze({ code: "BENEFIT-QA", title: "Beneficio de control QA", points: 0, status: "paused", tenant_slug: tenant });
const catalog = rewards => ({ ok: true, tenant, scope: "tenant", rewards });
const bodyFor = path => path === paths.loyalty ? loyalty : path === paths.consumer ? consumer : catalog([reward]);
const apiResponse = (payload, status = 200, mode = "production") => Response.json(payload, { status, headers: { "x-nexid-data-mode": mode } });
const nodes = node => Array.isArray(node) ? node.flatMap(nodes)
  : node && typeof node === "object" && node.props ? [node, ...nodes(node.props.children)] : [];
const text = node => Array.isArray(node) ? node.map(text).join(" ")
  : typeof node === "string" || typeof node === "number" ? String(node)
    : node?.props ? text(node.props.children) : "";
const Link = ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children);
const Panel = () => React.createElement("aside", { "data-synthetic-panel-boundary": "true" });

function mount({ session = principal, query = {}, sessionError = null, responseFor = path => apiResponse(bodyFor(path)) } = {}) {
  const calls = [], contextCalls = [], permissionRequests = [];
  const substitutes = {
    "../../../../lib/session": { requireDashboardSession: async permission => {
      permissionRequests.push(permission);
      if (sessionError) throw sessionError;
      return session;
    } },
    "../../../../lib/admin-page-access": {
      createAdminPageContext: async (current, requested) => {
        contextCalls.push({ session: current, requested });
        return { ...resolveDashboardTenantScope(current, requested), origin: "https://dashboard.qa.invalid", cookie: "" };
      },
      fetchAdminPage: async (context, path, init) => {
        calls.push({ context, path, init });
        return responseFor(path);
      },
    },
    "../../../../lib/permission-policy": permissions,
    "../../../../lib/consumer-network-overview-truth": consumerTruth,
    "../../../../components/tenant-engagement-panel": { TenantEngagementPanel: Panel },
    "next/link": { __esModule: true, default: Link },
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    id => Object.hasOwn(substitutes, id) ? substitutes[id] : require(id), module, module.exports,
  );
  return {
    calls, contextCalls, permissionRequests,
    async run() {
      const node = await module.exports.default({ searchParams: Promise.resolve(query) });
      return { node, html: renderToStaticMarkup(node), calls, contextCalls, permissionRequests };
    },
  };
}

function assertBoundReads(result, expected = Object.values(paths), expectedTenant = tenant) {
  assert.deepEqual(result.permissionRequests, ["crm:read"]);
  assert.equal(result.contextCalls.length, 1);
  assert.deepEqual(result.calls.map(call => call.path), expected);
  assert.equal(new Set(result.calls.map(call => call.path)).size, expected.length);
  for (const call of result.calls) {
    assert.equal(call.context.tenantSlug, expectedTenant);
    assert.equal(call.init, undefined, "Page retains the existing GET interface");
  }
}
function article(result, label) {
  const matches = nodes(result.node).filter(node => node.type === "article" && text(node).includes(label));
  assert.equal(matches.length, 1, label);
  return text(matches[0]);
}

test("compiled Page retains valid module values, real zero points and company-bound links", async () => {
  const result = await mount().run();
  assertBoundReads(result);
  assert.match(article(result, "Inscripciones en programas"), /123/);
  assert.match(article(result, "Puntos acreditados"), /456/);
  assert.match(article(result, "Puntos debitados"), /78/);
  assert.match(article(result, "Titularidad con restricciones"), /7/);
  assert.match(result.html, /Beneficio de control QA/);
  assert.match(result.html, /0 pts/);
  assert.doesNotMatch(result.html, /Fuentes parciales|Fuente de recompensas no disponible/);
  assert.match(result.html, /href="\/loyalty\/rewards\?tenant=qa-company"/);
  assert.match(result.html, /href="\/loyalty\/configuration\?tenant=qa-company"/);
});

for (const failed of Object.keys(paths)) {
  for (const failure of ["invalid-json-200", "http-503", "transport-rejection"]) {
    test(`compiled Page keeps other modules when ${failed} has ${failure}, without a retry or zero fallback`, async () => {
      const result = await mount({ responseFor: path => {
        if (path !== paths[failed]) return apiResponse(bodyFor(path));
        if (failure === "transport-rejection") throw new Error("PRIVATE_SOURCE_FAILURE");
        if (failure === "http-503") return new Response("PRIVATE_SOURCE_FAILURE", { status: 503 });
        return new Response("{PRIVATE_INVALID_JSON", { status: 200, headers: { "content-type": "application/json", "x-nexid-data-mode": "production" } });
      } }).run();
      assertBoundReads(result);
      assert.match(result.html, /Fuentes parciales/);
      assert.doesNotMatch(result.html, /PRIVATE_SOURCE_FAILURE|PRIVATE_INVALID_JSON|NaN|Infinity/);
      const members = article(result, "Inscripciones en programas");
      const claims = article(result, "Titularidad con restricciones");
      if (failed === "loyalty") {
        for (const label of ["Inscripciones en programas", "Puntos acreditados", "Puntos debitados"]) {
          assert.match(article(result, label), /—/);
          assert.match(article(result, label), /Fuente no disponible/);
        }
        assert.doesNotMatch(members, /123|Una persona puede figurar/);
      } else assert.match(members, /123/);
      if (failed === "consumer") {
        assert.match(claims, /—/);
        assert.match(claims, /Fuente no disponible/);
        assert.doesNotMatch(claims, /7|Reclamos GPS/);
      } else assert.match(claims, /7/);
      if (failed === "rewards") {
        assert.match(result.html, /Fuente de recompensas no disponible/);
        assert.doesNotMatch(result.html, /Beneficio de control QA|No hay recompensas configuradas todavía/);
      } else assert.match(result.html, /Beneficio de control QA/);
    });
  }
}

test("valid empty catalog remains distinct from a failed catalog source", async () => {
  const result = await mount({ responseFor: path => apiResponse(path === paths.rewards ? catalog([]) : bodyFor(path)) }).run();
  assertBoundReads(result);
  assert.match(result.html, /No hay recompensas configuradas todavía/);
  assert.doesNotMatch(result.html, /Fuentes parciales|Fuente de recompensas no disponible/);
});

test("recent list keeps five paused rows rather than claiming the older active reward is shown", async () => {
  const recent = Array.from({ length: 5 }, (_, i) => ({ ...reward, code: `RECENT-${i}`, title: `Beneficio reciente ${i}` }));
  const older = { ...reward, code: "OLDER-ACTIVE", title: "Beneficio activo anterior", status: "active" };
  const result = await mount({ responseFor: path => apiResponse(path === paths.rewards ? catalog([...recent, older]) : bodyFor(path)) }).run();
  assertBoundReads(result);
  const rows = nodes(result.node).filter(node => node.type === "li");
  assert.equal(rows.length, 5);
  for (const [i, row] of rows.entries()) assert.match(text(row), new RegExp(`Beneficio reciente ${i}`));
  assert.match(result.html, /Últimos beneficios configurados/);
  assert.doesNotMatch(result.html, /Beneficio activo anterior|Catálogo de Beneficios Activos/);
});

test("unknown persisted status is displayed as unconfirmed without declaring eligibility", async () => {
  const result = await mount({ responseFor: path => apiResponse(path === paths.rewards ? catalog([{ ...reward, status: "legacy-unknown" }]) : bodyFor(path)) }).run();
  assertBoundReads(result);
  assert.match(result.html, /Estado sin confirmar/);
  assert.doesNotMatch(result.html, /legacy-unknown/);
});

test("session rejection propagates before context and all three module reads", async () => {
  const denied = new Error("SYNTHETIC_SESSION_DENIED");
  const boundary = mount({ sessionError: denied });
  await assert.rejects(boundary.run(), error => error === denied);
  assert.deepEqual(boundary.permissionRequests, ["crm:read"]);
  assert.equal(boundary.contextCalls.length, 0);
  assert.equal(boundary.calls.length, 0);
});

test("recovery retains the real tenant resolver and never broadens a company query to another tenant", async () => {
  const result = await mount({ query: { tenant: "another-company" } }).run();
  assertBoundReads(result);
  assert.equal(result.contextCalls[0].requested, "another-company");
  assert.match(result.html, /tenant=qa-company/);
  assert.doesNotMatch(result.html, /tenant=another-company|scope=global/);
});

test("explicit high-impact deny keeps engagement streaming disabled during partial recovery", async () => {
  const session = { ...principal, role: "super-admin", tenantSlug: null, permissions: ["*"], deniedPermissions: ["events.read_sensitive"] };
  const result = await mount({ session, query: { tenant }, responseFor: path => path === paths.rewards
    ? new Response("{invalid", { status: 200 }) : apiResponse(bodyFor(path)) }).run();
  assertBoundReads(result);
  const panels = nodes(result.node).filter(node => node.type === Panel);
  assert.equal(panels.length, 1);
  assert.equal(panels[0].props.canRead, true);
  assert.equal(panels[0].props.streamEnabled, false);
  assert.equal(panels[0].props.tenantSlug, tenant);
  assert.match(result.html, /Fuente de recompensas no disponible/);
});

test("overview fence admits only the actual reviewed Page and retains its independent published origin", () => {
  const path = "apps/dashboard/src/app/(app)/loyalty/overview/page.tsx";
  assert.equal(LOYALTY_OVERVIEW_RECOVERY_SOURCE_BASE, "3eb3e8dccc09101bd429c29bb1d19efbf9481ae3");
  assert.deepEqual(Object.keys(LOYALTY_OVERVIEW_RECOVERY_REVIEWED_SOURCES), [path]);
  const pin = LOYALTY_OVERVIEW_RECOVERY_REVIEWED_SOURCES[path];
  const actualHash = createHash("sha256").update(pageSource.replaceAll("\r\n", "\n")).digest("hex");
  const actual = loyaltyOverviewReadinessPriorHash(path, actualHash);
  assert.equal(actual, pin.after);
  assert.equal(pin.before, REWARD_PROGRAM_CONTEXT_REVIEWED_SOURCES[path].after);
  assert.equal(loyaltyOverviewRecoveryPriorHash(path, actual), pin.before);
  const changedSource = createHash("sha256").update(pageSource + "\n// unreviewed change\n").digest("hex");
  const changedHash = actual.slice(0, -1) + (actual.endsWith("0") ? "1" : "0");
  for (const rejected of [pin.before, "0".repeat(64), changedHash, changedSource]) {
    assert.throws(() => loyaltyOverviewRecoveryPriorHash(path, rejected), /exact reviewed overview recovery increment/);
  }
});

test("overview fence passes unreviewed and prototype-named paths through without granting an origin", () => {
  for (const path of ["__proto__", "constructor", "toString", "apps/dashboard/src/unreviewed-addition.ts", "apps/dashboard/src/app/(app)/loyalty/overview/page.tsx?other"]) {
    const unreviewed = "unreviewed-source-" + path;
    assert.equal(loyaltyOverviewRecoveryPriorHash(path, unreviewed), unreviewed);
    assert.notEqual(loyaltyOverviewRecoveryPriorHash(path, unreviewed), "6d57395ccb0c6da0f3da6be971567ded7ea60f8ced2322fdad0b662c952f7b5a");
  }
});

const copy = value => structuredClone(value);
function zeroConsumer(expectedTenant = tenant) {
  const body = copy(consumer);
  body.tenant = expectedTenant || null;
  for (const key of Object.keys(body.overview)) if (typeof body.overview[key] === "number") body.overview[key] = 0;
  body.overview.consentedActorsByChannel = { email: 0, whatsapp: 0, phone: 0 };
  body.provenance.counts = { operationalTap: 0, declaredDemo: 0, imported: 0, legacyUnclassified: 0, mixed: 0 };
  body.provenance.hasIsolatedRecords = false;
  body.provenance.latestOperationalAt = null;
  return body;
}
async function consumerPage(body) {
  const result = await mount({ responseFor: path => apiResponse(path === paths.consumer ? body : bodyFor(path)) }).run();
  assertBoundReads(result);
  return result;
}
function metricCard(result, label) {
  const matches = nodes(result.node).filter(node => (node.type === "article" || node.type === "div")
    && Array.isArray(node.props.children) && text(node.props.children[0]) === label);
  assert.equal(matches.length, 1, label);
  return matches[0];
}
const metricValue = (result, label) => text(metricCard(result, label).props.children[1]);

test("loyalty cards distinguish program enrollments and point credits/debits from people or confirmed redemptions", async () => {
  for (const totals of [loyalty, { active_programs: 0, total_members: 0, points_issued: 0, points_redeemed: 0 }]) {
    const result = await mount({ responseFor: path => apiResponse(path === paths.loyalty ? totals : bodyFor(path)) }).run();
    assertBoundReads(result);
    for (const [key, label] of [["total_members", "Inscripciones en programas"], ["points_issued", "Puntos acreditados"], ["points_redeemed", "Puntos debitados"]]) assert.equal(metricValue(result, label), String(totals[key]));
    assert.match(article(result, "Inscripciones en programas"), /Una persona puede figurar en varios programas activos\./);
    assert.match(article(result, "Puntos acreditados"), /Total de puntos sumados en programas activos\./);
    assert.match(article(result, "Puntos debitados"), /Total de puntos descontados en programas activos, por canjes u otros movimientos\./);
    assert.doesNotMatch(result.html, /Total Miembros|Miembros enrolados|Inscripciones activas|Puntos Emitidos|Puntos otorgados por la plataforma|Puntos Canjeados|Canjes confirmados/);
  }
  const path = "apps/dashboard/src/app/(app)/loyalty/overview/page.tsx", copy = LOYALTY_OVERVIEW_METRIC_COPY_SOURCE;
  assert.equal(copy.path, path);
  assert.equal(copy.base, "34cbe641978f7525a8c832de60a23c80d6e42315");
  assert.equal(copy.before, LOYALTY_OVERVIEW_READINESS_REVIEWED_SOURCES[path].after);
  const actual = createHash("sha256").update(pageSource.replaceAll("\r\n", "\n")).digest("hex");
  const coverage = LOYALTY_OVERVIEW_COVERAGE_SOURCE;
  assert.equal(coverage.path, path);
  assert.equal(coverage.base, "4c1f42c683ca97fa0c0afa62a0fd82143d439636");
  assert.equal(coverage.before, copy.after);
  assert.equal(actual, coverage.after);
  assert.equal(loyaltyOverviewReadinessPriorHash(path, copy.after), LOYALTY_OVERVIEW_READINESS_REVIEWED_SOURCES[path].before);
  assert.equal(loyaltyOverviewReadinessPriorHash(path, actual), LOYALTY_OVERVIEW_READINESS_REVIEWED_SOURCES[path].before);
});
function assertConsumerWithheld(result) {
  for (const label of ["Titularidad con restricciones", "Actores conocidos", "Identidad verificada", "Email opt-in", "WhatsApp opt-in", "Teléfono opt-in"]) assert.equal(metricValue(result, label), "—", label);
  assert.match(article(result, "Inscripciones en programas"), /123/);
  assert.match(result.html, /Beneficio de control QA/);
}

for (const [key, label] of [["total_members", "Inscripciones en programas"], ["points_issued", "Puntos acreditados"], ["points_redeemed", "Puntos debitados"]]) {
  test(`loyalty ${key}: missing or invalid wire values withhold only that field and preserve other explicit numbers`, async () => {
    const invalid = [null, false, "", "0", "NaN", "Infinity", [], {}, -1, 1.5, Number.MAX_SAFE_INTEGER + 1];
    for (const value of [undefined, ...invalid]) {
      const body = { ...loyalty };
      if (value === undefined) delete body[key]; else body[key] = value;
      const result = await mount({ responseFor: path => apiResponse(path === paths.loyalty ? body : bodyFor(path)) }).run();
      assertBoundReads(result);
      assert.equal(metricValue(result, label), "—", `${key}: ${JSON.stringify(value)}`);
      assert.doesNotMatch(article(result, label), /Una persona puede figurar|Total de puntos sumados|Total de puntos descontados/);
      assert.match(result.html, /Fuentes parciales/);
      assert.equal(metricValue(result, "Titularidad con restricciones"), "7");
      for (const [other, title] of [["total_members", "Inscripciones en programas"], ["points_issued", "Puntos acreditados"], ["points_redeemed", "Puntos debitados"]]) {
        if (other !== key) assert.equal(metricValue(result, title), String(loyalty[other]));
      }
    }
  });
}

test("loyalty bare four-field zero response is confirmed without a consumer envelope", async () => {
  const result = await mount({ responseFor: path => apiResponse(path === paths.loyalty
    ? { active_programs: 0, total_members: 0, points_issued: 0, points_redeemed: 0 } : bodyFor(path)) }).run();
  assertBoundReads(result);
  for (const label of ["Inscripciones en programas", "Puntos acreditados", "Puntos debitados"]) assert.equal(metricValue(result, label), "0");
  assert.doesNotMatch(result.html, /Fuentes parciales/);
});

test("real Page read preserves a large safe count in full without abbreviation or a fabricated zero", async () => {
  const body = copy(consumer);
  body.overview.knownActors = Number.MAX_SAFE_INTEGER;
  const result = await mount({ responseFor: path => apiResponse(path === paths.loyalty
    ? { ...loyalty, total_members: Number.MAX_SAFE_INTEGER } : path === paths.consumer ? body : bodyFor(path)) }).run();
  assertBoundReads(result);
  assert.equal(metricValue(result, "Inscripciones en programas"), "9.007.199.254.740.991");
  assert.equal(metricValue(result, "Actores conocidos"), "9.007.199.254.740.991");
  assert.equal(metricValue(result, "Titularidad con restricciones"), "7");
  assert.doesNotMatch(result.html, /Fuentes parciales|NaN|Infinity/);
});

test("consumer projection preserves unrelated fields when one count is missing, wrong-type or unsafe", async () => {
  for (const value of [undefined, null, false, "", "20", "NaN", "Infinity", NaN, Infinity, -Infinity, [], {}, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const body = copy(consumer);
    if (value === undefined) delete body.overview.knownActors; else body.overview.knownActors = value;
    const projected = consumerTruth.projectConsumerNetworkOverview(body, tenant);
    assert.ok(projected);
    assert.notEqual(projected.counts.knownActors.state, "ready");
    assert.deepEqual(projected.counts.riskBlockedClaims, { state: "ready", value: 7 });
    assert.deepEqual(projected.channels.email, { state: "ready", value: 4 });
    const result = await consumerPage(body);
    assert.equal(metricValue(result, "Actores conocidos"), "—");
    assert.equal(metricValue(result, "Titularidad con restricciones"), "7");
    assert.equal(metricValue(result, "Email opt-in"), "4");
    assert.match(result.html, /Fuentes parciales/);
  }
});

test("consumer channels have independent missing states while retaining explicit zero and other channels", async () => {
  const body = copy(consumer);
  delete body.overview.consentedActorsByChannel.whatsapp;
  body.overview.consentedActorsByChannel.email = 0;
  const result = await consumerPage(body);
  assert.equal(metricValue(result, "Email opt-in"), "0");
  assert.equal(metricValue(result, "WhatsApp opt-in"), "—");
  assert.equal(metricValue(result, "Teléfono opt-in"), "2");
  assert.equal(metricValue(result, "Actores conocidos"), "20");
  const sections = nodes(result.node).filter(node => node.type === "section");
  const identityGroup = sections.find(section => section.props["aria-labelledby"] === "loyalty-coverage-identity");
  const consentGroup = sections.find(section => section.props["aria-labelledby"] === "loyalty-coverage-consent");
  assert.ok(identityGroup && consentGroup);
  assert.match(text(identityGroup), /Vínculos e identidad/);
  assert.match(text(consentGroup), /Consentimientos por canal/);
  assert.ok(nodes(identityGroup).includes(metricCard(result, "Identidad verificada")));
  for (const label of ["Email opt-in", "WhatsApp opt-in", "Teléfono opt-in"]) {
    assert.ok(nodes(consentGroup).includes(metricCard(result, label)), label);
  }
  assert.match(text(metricCard(result, "WhatsApp opt-in")), /No informado por la fuente/);
  assert.doesNotMatch(text(metricCard(result, "Email opt-in")), /No informado por la fuente/);
});

test("identity and channel groups need the member denominator and marketing purpose", async () => {
  for (const change of [body => { delete body.overview.activeTenantMembers; }, body => { body.overview.activeTenantMembers = "20"; }]) {
    const body = copy(consumer); change(body);
    const result = await consumerPage(body);
    for (const label of ["Identidad verificada", "Email opt-in", "WhatsApp opt-in", "Teléfono opt-in"]) assert.equal(metricValue(result, label), "—");
    assert.equal(metricValue(result, "Actores conocidos"), "20");
    assert.equal(metricValue(result, "Titularidad con restricciones"), "7");
  }
  for (const value of [undefined, "service", false]) {
    const body = copy(consumer);
    if (value === undefined) delete body.overview.consentPurpose; else body.overview.consentPurpose = value;
    const result = await consumerPage(body);
    for (const label of ["Email opt-in", "WhatsApp opt-in", "Teléfono opt-in"]) assert.equal(metricValue(result, label), "—");
    assert.equal(metricValue(result, "Identidad verificada"), "10");
  }
});

test("channel and verified-member bounds affect only their respective groups", async () => {
  const body = copy(consumer);
  body.overview.verifiedIdentityActors = 21;
  body.overview.consentedActorsByChannel.whatsapp = 21;
  const result = await consumerPage(body);
  assert.equal(metricValue(result, "Identidad verificada"), "—");
  assert.equal(metricValue(result, "WhatsApp opt-in"), "—");
  assert.equal(metricValue(result, "Email opt-in"), "4");
  assert.equal(metricValue(result, "Actores conocidos"), "20");
});

test("activity group contradictions withhold the derived total and percentage, preserving independent counts", async () => {
  for (const change of [body => { body.overview.totalActivity = 91; }, body => { delete body.overview.customerActions; }, body => { body.overview.activityWithoutActor = 44; }]) {
    const body = copy(consumer); change(body);
    const projected = consumerTruth.projectConsumerNetworkOverview(body, tenant);
    assert.ok(projected);
    assert.notEqual(projected.counts.totalActivity.state, "ready");
    assert.notEqual(projected.rate.state, "ready");
    const result = await consumerPage(body);
    assert.equal(metricValue(result, "Actores conocidos"), "20");
    assert.equal(metricValue(result, "Titularidad con restricciones"), "7");
    assert.doesNotMatch(result.html, /style="width:/);
  }
});

test("an absent or contradictory rate is never calculated into a successful percentage", async () => {
  for (const value of [undefined, null, "50", false, -1, 101, 49.9]) {
    const body = copy(consumer);
    if (value === undefined) delete body.overview.actorLinkedActivityRate; else body.overview.actorLinkedActivityRate = value;
    const result = await consumerPage(body);
    assert.equal(metricValue(result, "Actores conocidos"), "20");
    assert.doesNotMatch(result.html, /style="width:|>50%<|>49,9%<|NaN|Infinity/);
    assert.match(result.html, /Fuentes parciales/);
  }
});

test("a complete zero operational response shows real zero counts and no percentage without a base", async () => {
  const body = zeroConsumer();
  assert.ok(consumerTruth.parseConsumerNetworkOverview(body, tenant));
  const projected = consumerTruth.projectConsumerNetworkOverview(body, tenant);
  assert.equal(projected.availability, "ready");
  assert.deepEqual(projected.rate, { state: "no_base", value: null });
  const result = await consumerPage(body);
  assert.equal(metricValue(result, "Titularidad con restricciones"), "0");
  assert.equal(metricValue(result, "Actores conocidos"), "0");
  assert.match(result.html, /Sin actividad/);
  assert.doesNotMatch(result.html, />0%<|style="width:|aria-valuenow|Fuentes parciales/);
});

test("zero operational provenance cannot be salvaged around any positive operational metric or product", () => {
  const changes = [
    ...Object.keys(zeroConsumer().overview).filter(key => typeof zeroConsumer().overview[key] === "number").map(key => body => { body.overview[key] = 1; }),
    ...["email", "whatsapp", "phone"].map(key => body => { body.overview.consentedActorsByChannel[key] = 1; }),
    body => { body.topProductsByClaims = [{ product_name: "QA", bid: "QA-1", claims: 1 }]; },
  ];
  for (const change of changes) {
    const body = zeroConsumer(); change(body);
    assert.equal(consumerTruth.projectConsumerNetworkOverview(body, tenant), null);
  }
});

test("new projection rejects unsafe provenance without silently changing the existing full parser", () => {
  const body = zeroConsumer();
  const unsafe = Number.MAX_SAFE_INTEGER + 1;
  body.provenance.counts.operationalTap = unsafe;
  body.provenance.latestOperationalAt = "2026-11-01T11:00:00.000Z";
  body.overview.totalTaps = unsafe;
  body.overview.totalActivity = unsafe;
  body.overview.activityWithoutActor = unsafe;
  assert.ok(consumerTruth.parseConsumerNetworkOverview(body, tenant), "legacy integer contract remains unchanged");
  assert.equal(consumerTruth.projectConsumerNetworkOverview(body, tenant), null);
  for (const key of ["declaredDemo", "imported", "legacyUnclassified", "mixed"]) {
    const raw = copy(consumer);
    raw.provenance.counts[key] = unsafe;
    raw.provenance.hasIsolatedRecords = true;
    raw.provenance.state = key === "legacyUnclassified" ? "partial_legacy_unclassified" : "classified";
    assert.equal(consumerTruth.projectConsumerNetworkOverview(raw, tenant), null, key);
  }
});

test("rejected consumer envelope, tenant, provenance and global contract never expose salvaged metrics", async () => {
  const changes = [
    body => { body.ok = false; }, body => { delete body.tenant; }, body => { body.tenant = "foreign-company"; },
    body => { delete body.provenance; }, body => { body.provenance.contractVersion = "unknown"; },
    body => { body.overview.totalTaps = 59; }, body => { delete body.identityBoundary; },
    body => { body.topProductsByClaims = [{ product_name: {}, bid: "QA", claims: 1 }]; },
    body => { delete body.topProductsByClaims; },
  ];
  for (const change of changes) {
    const body = copy(consumer); change(body);
    assert.equal(consumerTruth.projectConsumerNetworkOverview(body, tenant), null);
    assertConsumerWithheld(await consumerPage(body));
  }
});

test("projection does not read inherited metric, channel, or provenance fields as reported values", () => {
  const body = copy(consumer);
  const known = body.overview.knownActors;
  delete body.overview.knownActors;
  Object.setPrototypeOf(body.overview, { knownActors: known });
  const result = consumerTruth.projectConsumerNetworkOverview(body, tenant);
  assert.equal(result.counts.knownActors.state, "missing");
  const channels = copy(consumer);
  const email = channels.overview.consentedActorsByChannel.email;
  delete channels.overview.consentedActorsByChannel.email;
  Object.setPrototypeOf(channels.overview.consentedActorsByChannel, { email });
  assert.equal(consumerTruth.projectConsumerNetworkOverview(channels, tenant).channels.email.state, "missing");
  const provenance = copy(consumer);
  delete provenance.provenance.counts.operationalTap;
  Object.setPrototypeOf(provenance.provenance.counts, { operationalTap: 60 });
  assert.equal(consumerTruth.projectConsumerNetworkOverview(provenance, tenant), null);
});

test("production transport can include isolated declared-demo records without relabeling operational metrics", async () => {
  assert.equal(consumer.provenance.counts.declaredDemo, 2);
  const projected = consumerTruth.projectConsumerNetworkOverview(copy(consumer), tenant);
  assert.equal(projected.availability, "ready");
  const result = await mount().run();
  assert.equal(metricValue(result, "Titularidad con restricciones"), "7");
  assert.doesNotMatch(result.html, /Datos de demostración/);
});

test("missing or unknown BFF mode never defaults all sources to production", async () => {
  for (const mode of [null, "", "real", "unknown"]) {
    const result = await mount({ responseFor: path => mode === null ? Response.json(bodyFor(path)) : apiResponse(bodyFor(path), 200, mode) }).run();
    assertBoundReads(result);
    for (const label of ["Inscripciones en programas", "Puntos acreditados", "Puntos debitados", "Titularidad con restricciones"]) assert.equal(metricValue(result, label), "—");
    assert.doesNotMatch(result.html, /Beneficio de control QA|No hay recompensas configuradas todavía/);
  }
});

test("known demo metadata has strict boolean/source types while production false or absent remains valid", async () => {
  for (const patch of [{}, { demo: false, demoMode: false, dataSource: "production" }]) {
    const result = await mount({ responseFor: path => apiResponse({ ...copy(bodyFor(path)), ...patch }) }).run();
    assert.equal(metricValue(result, "Inscripciones en programas"), "123");
    assert.equal(metricValue(result, "Titularidad con restricciones"), "7");
  }
  for (const patch of [{ demo: "true" }, { demo: null }, { demo: true }, { demoMode: "false" }, { demoMode: null }, { demoMode: true }, { dataSource: "demo" }, { dataSource: null }]) {
    const result = await mount({ responseFor: path => apiResponse({ ...copy(bodyFor(path)), ...patch }) }).run();
    for (const label of ["Inscripciones en programas", "Titularidad con restricciones"]) assert.equal(metricValue(result, label), "—");
    assert.doesNotMatch(result.html, /Beneficio de control QA/);
  }
});

test("demo data needs an allowed demo session and cannot carry positive operational consumer metrics", async () => {
  const demoBody = path => ({ ...copy(path === paths.consumer ? zeroConsumer() : bodyFor(path)), demo: true, demoMode: true, dataSource: "demo" });
  const operational = await mount({ responseFor: path => apiResponse(demoBody(path), 200, "demo") }).run();
  for (const label of ["Titularidad con restricciones", "Actores conocidos", "Identidad verificada", "Email opt-in", "WhatsApp opt-in", "Teléfono opt-in"]) assert.equal(metricValue(operational, label), "—");
  assert.doesNotMatch(operational.html, /Beneficio de control QA|No hay recompensas configuradas todavía/);
  assert.equal(metricValue(operational, "Inscripciones en programas"), "—");
  const allowed = await mount({ session: { ...principal, isDemo: true }, responseFor: path => apiResponse(demoBody(path), 200, "demo") }).run();
  assertBoundReads(allowed);
  assert.equal(metricValue(allowed, "Titularidad con restricciones"), "0");
  assert.match(allowed.html, /Datos de demostración/);
  for (const patch of [{ demo: false }, { demo: "true" }, { demoMode: false }, { dataSource: "production" }]) {
    const rejected = await mount({ session: { ...principal, isDemo: true }, responseFor: path => apiResponse({ ...demoBody(path), ...patch }, 200, "demo") }).run();
    assert.equal(metricValue(rejected, "Titularidad con restricciones"), "—");
    assert.doesNotMatch(rejected.html, /Beneficio de control QA/);
  }
  const contradiction = await mount({ session: { ...principal, isDemo: true }, responseFor: path => apiResponse(path === paths.consumer
    ? { ...copy(consumer), demo: true, demoMode: true, dataSource: "demo" } : demoBody(path), 200, "demo") }).run();
  assert.equal(metricValue(contradiction, "Titularidad con restricciones"), "—");
  assert.equal(metricValue(contradiction, "Inscripciones en programas"), "123");
});

test("reward validation checks the whole scoped collection, including an invalid sixth row, before five are shown", async () => {
  const valid = Array.from({ length: 5 }, (_, i) => ({ ...reward, code: `VALID-${i}` }));
  const malformed = [
    { ...catalog(valid), tenant: "foreign-company" }, { ...catalog(valid), scope: "global" },
    catalog([...valid, { ...reward, tenant_slug: "foreign-company" }]),
    catalog([...valid, { ...reward, title: {} }]), catalog([...valid, { ...reward, points: null }]),
    { ...catalog(valid), ok: false },
  ];
  for (const body of malformed) {
    const result = await mount({ responseFor: path => apiResponse(path === paths.rewards ? body : bodyFor(path)) }).run();
    assertBoundReads(result);
    assert.match(result.html, /Fuente de recompensas no disponible/);
    assert.doesNotMatch(result.html, /Beneficio de control QA|No hay recompensas configuradas todavía/);
    assert.equal(metricValue(result, "Inscripciones en programas"), "123");
    assert.equal(metricValue(result, "Titularidad con restricciones"), "7");
  }
});

test("a valid legacy reward with longer persisted text does not inherit the current writer's length limits", async () => {
  const recent = Array.from({ length: 5 }, (_, i) => ({ ...reward, code: `RECENT-${i}` }));
  const legacy = { ...reward, code: "LEGACY-" + "A".repeat(120), title: "Texto persistido " + "B".repeat(320), status: "legacy-unknown" };
  const result = await mount({ responseFor: path => apiResponse(path === paths.rewards ? catalog([...recent, legacy]) : bodyFor(path)) }).run();
  assertBoundReads(result);
  assert.equal(nodes(result.node).filter(node => node.type === "li").length, 5);
  assert.match(result.html, /Beneficio de control QA/);
  assert.doesNotMatch(result.html, /Fuente de recompensas no disponible|Fuentes parciales/);
  const visible = await mount({ responseFor: path => apiResponse(path === paths.rewards ? catalog([legacy, ...recent]) : bodyFor(path)) }).run();
  assertBoundReads(visible);
  const first = nodes(visible.node).filter(node => node.type === "li")[0];
  assert.ok(text(first).includes(legacy.title));
  assert.ok(text(first).includes(legacy.code));
  assert.match(visible.html, /href="\/loyalty\/rewards\?tenant=qa-company"/);
  assert.doesNotMatch(visible.html, /Fuente de recompensas no disponible/);
});

test("a mixed authorized demo marks only its demo blocks and preserves production activity and catalog", async () => {
  const result = await mount({ session: { ...principal, isDemo: true }, responseFor: path => path === paths.loyalty
    ? apiResponse({ ...loyalty, demo: true, demoMode: true, dataSource: "demo" }, 200, "demo")
    : apiResponse(bodyFor(path)) }).run();
  assertBoundReads(result);
  assert.equal(metricValue(result, "Inscripciones en programas"), "123");
  assert.equal(metricValue(result, "Titularidad con restricciones"), "7");
  assert.equal(metricCard(result, "Inscripciones en programas").props["data-source-mode"], "demo");
  assert.equal(metricCard(result, "Titularidad con restricciones").props["data-source-mode"], "production");
  assert.match(article(result, "Inscripciones en programas"), /Demo/);
  assert.doesNotMatch(article(result, "Titularidad con restricciones"), /Demo/);
  assert.match(result.html, /Datos de demostración en: puntos y miembros\./);
  assert.doesNotMatch(result.html, /No representan actividad de clientes reales/);
  assert.match(result.html, /Beneficio de control QA/);
});

test("reward read denial keeps other permitted sources visible without claiming an empty catalog", async () => {
  const result = await mount({ responseFor: path => path === paths.rewards ? apiResponse({ ok: false }, 403) : apiResponse(bodyFor(path)) }).run();
  assertBoundReads(result);
  assert.equal(metricValue(result, "Inscripciones en programas"), "123");
  assert.equal(metricValue(result, "Titularidad con restricciones"), "7");
  assert.match(result.html, /Fuente de recompensas no disponible/);
  assert.doesNotMatch(result.html, /No hay recompensas configuradas todavía/);
});

test("authorized global catalog retains two companies with the same code and labels each company", async () => {
  const expectedPaths = [paths.loyalty, paths.consumer, paths.rewards + "?scope=global"];
  const result = await mount({ session: { ...principal, role: "super-admin", tenantSlug: null, permissions: ["*"] }, responseFor: path => {
    if (path === expectedPaths[2]) return apiResponse({ ok: true, tenant: null, scope: "global", rewards: [
      { ...reward, code: "VIP", tenant_slug: tenant }, { ...reward, code: "VIP", tenant_slug: "another-company" },
    ] });
    return apiResponse(path === paths.consumer ? { ...copy(consumer), tenant: null } : bodyFor(path));
  } }).run();
  assertBoundReads(result, expectedPaths, "");
  assert.match(result.html, /Empresa: qa-company/);
  assert.match(result.html, /Empresa: another-company/);
  assert.equal(nodes(result.node).filter(node => node.type === "li").length, 2);
  assert.match(result.html, /Vista de empresas:/);
  assert.match(result.html, /href="\/loyalty\/rewards"/);
  assert.match(result.html, /href="\/loyalty\/configuration"/);
  assert.doesNotMatch((await mount().run()).html, /Empresa: qa-company/);
});

test("company copy and primary navigation retain the existing tenant scope without internal workspace jargon", async () => {
  const result = await mount().run();
  assertBoundReads(result);
  assert.match(result.html, /Empresa actual:/);
  assert.match(result.html, /Consultá las lecturas, acciones y beneficios de tu empresa/);
  assert.doesNotMatch(result.html, /Workspace activo|operativo del tenant/);
  assert.match(result.html, /href="\/loyalty\/rewards\?tenant=qa-company"/);
  assert.match(result.html, /href="\/loyalty\/configuration\?tenant=qa-company"/);
});

test("restriction metric copy reports ownership states without accusing fraud or claiming GPS", async () => {
  const result = await mount().run();
  const metric = article(result, "Titularidad con restricciones");
  assert.match(metric, /Lectura repetida, revocación o disputa/);
  assert.equal(metricValue(result, "Titularidad con restricciones"), "7");
  assert.doesNotMatch(metric, /Sospechos|GPS|falsific|fraude|presencia física/);
});

test("readiness fence admits exactly both runtime sources and retains their independent D5 or baseline origins", () => {
  const expectedPaths = ["apps/dashboard/src/app/(app)/loyalty/overview/page.tsx", "apps/dashboard/src/lib/consumer-network-overview-truth.ts"];
  assert.deepEqual(Object.keys(LOYALTY_OVERVIEW_READINESS_REVIEWED_SOURCES).sort(), expectedPaths.sort());
  for (const path of expectedPaths) {
    const source = readFileSync(new URL("../" + path.replace(/^apps\/dashboard\//, ""), import.meta.url), "utf8");
    const digest = createHash("sha256").update(source.replaceAll("\r\n", "\n")).digest("hex");
    const pin = LOYALTY_OVERVIEW_READINESS_REVIEWED_SOURCES[path];
    assert.equal(loyaltyOverviewReadinessPriorHash(path, digest), pin.before);
    for (const changed of [pin.before, "0".repeat(64), createHash("sha256").update(source + "\n// unreviewed\n").digest("hex")]) assert.throws(() => loyaltyOverviewReadinessPriorHash(path, changed), /exact reviewed overview readiness increment/);
  }
  for (const path of ["__proto__", "constructor", "toString", "apps/dashboard/src/unreviewed.ts"]) assert.equal(loyaltyOverviewReadinessPriorHash(path, "unreviewed"), "unreviewed");
});

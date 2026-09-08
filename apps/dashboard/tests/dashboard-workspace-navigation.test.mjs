import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { dashboardWorkspaceTab, dashboardWorkspaceHref } from "../src/lib/dashboard-workspace-navigation.ts";

test("workspace URL resolves exactly the visible section and fails closed for tenant-only navigation", () => {
  for (const [section, tab] of [["operations", "infra"], ["engagement", "loyalty"], ["showroom", "demo"], ["tenants", "tenants"], [null, "summary"], ["bogus", "summary"]]) {
    assert.equal(dashboardWorkspaceTab(section, false), tab);
  }
  assert.equal(dashboardWorkspaceTab("showroom", true), "summary");
  assert.equal(dashboardWorkspaceTab("tenants", true), "summary");
});

test("section navigation preserves tenant and filters but clears stale TAP view and stays internal", () => {
  assert.equal(dashboardWorkspaceHref("?tenant=demobodega&view=physical-taps", "infra"), "/?tenant=demobodega&section=operations");
  assert.equal(dashboardWorkspaceHref("?section=operations&tenant=demobodega&range=24h", "loyalty"), "/?section=engagement&tenant=demobodega&range=24h");
  assert.equal(dashboardWorkspaceHref("?section=operations&view=physical-taps", "summary"), "/");
  assert.equal(dashboardWorkspaceHref("?tenant=a%26b", "infra"), "/?tenant=a%26b&section=operations");
});

test("home follows Next URL state for back/forward and hides duplicate navigation beneath the CRM overlay", async () => {
  const source = await readFile(new URL("../src/components/dashboard-home-client.tsx", import.meta.url), "utf8");
  assert.match(source, /useSearchParams\(\)/);
  assert.match(source, /dashboardWorkspaceTab\(searchParams.get\("section"\), isTenantAdmin\)/);
  assert.match(source, /window.history.pushState\(null, "", href\)/);
  assert.match(source, /activeTab !== "summary" && <nav/);
  assert.doesNotMatch(source, /sticky top-\[72px\]/);
});

test("map shortcut opens overview before moving focus and respects reduced motion", async () => {
  const source = await readFile(new URL("../src/components/executive-realtime-crm.tsx", import.meta.url), "utf8");
  assert.match(source, /const openMapPanel = \(\) => \{\s*selectActiveView\("overview"\);\s*setMapPanelRequested\(true\)/);
  assert.match(source, /label: "Mapa por capas"[^\n]*action: openMapPanel/);
  assert.match(source, /if \(!mapPanelRequested\) return;[\s\S]*?prefers-reduced-motion: reduce[\s\S]*?focus\(\{ preventScroll: true \}\)/);
});

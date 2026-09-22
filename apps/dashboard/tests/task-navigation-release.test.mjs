import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { groupTaskNavigation, dashboardTaskCopy, taskDestinationLabel } from "../src/lib/dashboard-task-navigation.ts";
import { DASHBOARD_DESTINATIONS, dashboardCanOpenDestination } from "../src/lib/dashboard-destination-policy.ts";
import { DASHBOARD_RELEASE, RELEASE_NOTES, releaseCopy } from "../src/lib/dashboard-release.ts";
const source = (path) => readFile(new URL(path, import.meta.url), "utf8");
const candidates = Object.entries(DASHBOARD_DESTINATIONS).map(([destination, policy]) => ({ destination, href: policy.href, label: destination }));
const flatten = (groups) => groups.flatMap((group) => group.items);
test("task groups preserve every already-authorized destination exactly once", () => {
  const groups = groupTaskNavigation(candidates, "es-AR");
  assert.equal(flatten(groups).length, candidates.length);
  assert.equal(new Set(flatten(groups).map((item) => item.href)).size, candidates.length);
  assert.deepEqual(groups.map((group) => group.id), ["operations", "products", "customers", "integrations", "administration", "resources"]);
});
test("grouping never adds permissions or a missing module", () => {
  for (const role of ["super-admin", "tenant-admin", "tenant-operator", "reseller-admin"]) {
    const access = { role, permissions: ["events.read_sensitive", "campaigns:read", "rewards:read"], deniedPermissions: ["campaigns:read"], isDemo: false };
    const authorized = candidates.filter((item) => dashboardCanOpenDestination(item.destination, access));
    const grouped = flatten(groupTaskNavigation(authorized, "es-AR"));
    assert.deepEqual(grouped.map((item) => item.href).sort(), authorized.map((item) => item.href).sort());
    assert.equal(grouped.some((item) => item.destination === "campaigns"), false);
  }
});
test("duplicates and empty groups are removed without mutating caller data", () => {
  const item = Object.freeze({ destination: "tags", href: "/tags", label: "Tags" });
  assert.equal(flatten(groupTaskNavigation([item, item], "en")).length, 1);
  assert.deepEqual(groupTaskNavigation([], "en"), []);
  assert.equal(item.label, "Tags");
});
test("demos and commercial presentations are separated from operations", () => {
  const groups = groupTaskNavigation(candidates, "es-AR");
  const resources = groups.find((group) => group.id === "resources").items;
  for (const name of ["demoLab", "investorSnapshot", "salesPlaybook"]) assert.ok(resources.some((item) => item.destination === name));
  assert.ok(groups.find((group) => group.id === "operations").items.some((item) => item.destination === "events"));
});
test("navigation labels and notes exist in all supported locales", () => {
  for (const locale of ["es-AR", "en", "pt-BR"]) {
    assert.ok(dashboardTaskCopy(locale).navigation);
    assert.equal(releaseCopy(locale).cards.length, 4);
    assert.equal(releaseCopy(locale).steps.length, 4);
    assert.ok(taskDestinationLabel({ destination: "serviceLevels", href: "/service-levels", label: "SLO" }, locale));
  }
  assert.equal(dashboardTaskCopy("unknown"), dashboardTaskCopy("es-AR"));
  assert.equal(releaseCopy("unknown"), RELEASE_NOTES["es-AR"]);
});
test("public version marker agrees with the displayed release", async () => {
  const marker = JSON.parse(await source("../public/release.json"));
  assert.equal(marker.release, DASHBOARD_RELEASE);
  assert.equal(marker.apiChangesIncluded, false);
  assert.equal(marker.requiredApiRelease, "2026.09.22-api-support-workflow.1");
  assert.equal(marker.requiredWebRelease, "2026.09.21-web-support.1");
  assert.equal(marker.supportTicketLookupProtocol, "nexid.support-ticket-lookup.v1");
  assert.equal(marker.supportTicketWorkflowProtocol, "nexid.support-ticket-workflow.v1");
  assert.equal(marker.databaseMigrationsIncluded, false);
  assert.equal(marker.campaignDeliveryIncluded, false);
  assert.equal(marker.realTapCertification, "not-included");
  assert.equal(marker.scope, "audited-support-ticket-status-workflow");
  assert.equal(marker.reconciliationBaseRelease, "2026.09.21-dashboard.28");
});

test("browser release acceptance reads the committed marker instead of pinning an older release", async () => {
  const browser = await source("./task-navigation.browser.mjs");
  assert.match(browser, /new URL\('\.\.\/public\/release\.json',import\.meta\.url\)/);
  assert.doesNotMatch(browser, /const expected=['"]\d{4}\.\d{2}\.\d{2}-dashboard\.\d+/);
});
test("release notes have no private API, database access or provider identifiers", async () => {
  const page = await source("../src/app/novedades/page.tsx");
  assert.doesNotMatch(page, /fetch\(|requireDashboardSession|createAdminPageContext|DATABASE_URL|tenant_id|team_BV|prj_/);
  assert.match(page, /releaseCopy\(locale\)/);
  assert.match(page, /data-testid="dashboard-release-id"/);
  assert.match(page, /prefetch=\{false\}/);
});
test("shell connects existing permission-filtered candidates to the task groups", async () => {
  const shell = await source("../src/components/dashboard-shell.tsx");
  assert.match(shell, /groupTaskNavigation\(\[/);
  for (const name of ["coreOpsItems", "globalNetworkItems", "loyaltyNetworkItems"]) assert.ok(shell.includes(`...${name}`));
  assert.match(shell, /settingsItems\.filter\(\(item\) => canOpenDestination\(item.destination\)\)/);
  assert.match(shell, /group\.items\.map\(renderNavLink\)/);
  assert.match(shell, /group.id !== "resources"/);
  assert.match(shell, /prefetch=\{false\}/);
});
test("mobile drawer handles focus, background, escape and viewport changes without polling", async () => {
  const hook = await source("../src/components/use-mobile-navigation.ts");
  assert.match(hook, /event.key === "Escape"/);
  assert.match(hook, /event.key !== "Tab"/);
  assert.match(hook, /content.setAttribute\("inert", ""\)/);
  assert.match(hook, /content.removeAttribute\("inert"\)/);
  assert.match(hook, /document.body.style.overflow = previousOverflow/);
  assert.match(hook, /triggerRef.current.focus\(\)/);
  assert.match(hook, /media.removeEventListener/);
  assert.doesNotMatch(hook, /setInterval|fetch\(|localStorage/);
});
test("release entry is discoverable at login and in authenticated navigation", async () => {
  for (const path of ["../src/app/login/page.tsx", "../src/components/dashboard-shell.tsx"]) {
    assert.match(await source(path), /<ReleaseNotesLink locale=\{locale\}/);
  }
});

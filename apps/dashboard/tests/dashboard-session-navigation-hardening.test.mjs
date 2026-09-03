import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = async (relativePath) => readFile(new URL(relativePath, import.meta.url), "utf8");

test("dashboard network boundaries share one abortable timeout", async () => {
  const [fetchSource, session, apiProxy, heartbeat, recovery] = await Promise.all([
    source("../src/lib/dashboard-fetch.ts"),
    source("../src/lib/session.ts"),
    source("../src/lib/api-proxy.ts"),
    source("../src/components/session-heartbeat.tsx"),
    source("../src/app/session-recovery/session-recovery-client.tsx"),
  ]);

  assert.match(fetchSource, /DASHBOARD_FETCH_TIMEOUT_MS = 8_000/);
  assert.match(fetchSource, /new AbortController\(\)/);
  assert.match(fetchSource, /controller\.abort\(new DOMException\("Dashboard request timed out", "TimeoutError"\)\)/);
  assert.match(fetchSource, /signal: controller\.signal/);
  assert.match(session, /dashboardFetch\(`\$\{API_BASE\}\/auth\/session`/);
  assert.match(apiProxy, /return dashboardFetch\(`\$\{API_BASE\}\$\{path\}`/);
  assert.match(heartbeat, /dashboardFetch\("\/api\/session\/current"/);
  assert.match(recovery, /dashboardFetch\("\/api\/session\/current"/);

  const { dashboardFetch } = await import(`../src/lib/dashboard-fetch.ts?timeout=${Date.now()}`);
  const originalFetch = globalThis.fetch;
  let observedSignal;
  globalThis.fetch = (_input, init = {}) => new Promise((_resolve, reject) => {
    observedSignal = init.signal;
    const rejectForAbort = () => reject(init.signal?.reason || new Error("aborted"));
    if (init.signal?.aborted) rejectForAbort();
    else init.signal?.addEventListener("abort", rejectForAbort, { once: true });
  });

  try {
    await assert.rejects(
      dashboardFetch("https://dashboard.invalid/session", {}, 5),
      (error) => error?.name === "TimeoutError",
    );
    assert.equal(observedSignal?.aborted, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("unsigned or incomplete session snapshots fail closed without wildcard permissions", async () => {
  const [currentSession, loginRoute, clerkRoute] = await Promise.all([
    source("../src/app/api/session/current/route.ts"),
    source("../src/lib/session-login-route.ts"),
    source("../src/app/auth/clerk/super-admin/route.ts"),
  ]);

  assert.match(currentSession, /Array\.isArray\(data\.session\.permissions\) \? data\.session\.permissions : \[\]/);
  assert.match(loginRoute, /permissions: permissions \|\| \[\]/);
  assert.match(loginRoute, /Array\.isArray\(data\.permissions\) \? data\.permissions : \[\]/);
  assert.match(clerkRoute, /Array\.isArray\(data\.permissions\) \? data\.permissions : \[\]/);
});

test("logout is POST-only, same-origin protected, bounded and used by every caller", async () => {
  const [logout, logoutButton] = await Promise.all([
    source("../src/app/logout/route.ts"),
    source("../src/components/secure-dashboard-logout-button.tsx"),
  ]);

  assert.match(logout, /export async function GET[\s\S]*status: 405/);
  assert.match(logout, /response\.headers\.set\("Allow", "POST"\)/);
  assert.match(logout, /fetchSite === "cross-site" \|\| !requireSameOrigin\(req\)/);
  assert.match(logout, /dashboardFetch\(`\$\{API_BASE\}\/auth\/session`, \{ method: "DELETE"/);
  assert.match(logoutButton, /<form method="post" action="\/logout">/);
  assert.match(logoutButton, /dashboardFetch\("\/logout", \{[\s\S]*method: "POST",[\s\S]*credentials: "same-origin"/);
  assert.doesNotMatch(logoutButton, /href="\/logout"/);

  const route = await import(`../src/app/logout/route.ts?logout=${Date.now()}`);
  const getResponse = await route.GET(new Request("https://app.nexid.lat/logout"));
  assert.equal(getResponse.status, 405);
  assert.equal(getResponse.headers.get("allow"), "POST");

  const crossSiteResponse = await route.POST(new Request("https://app.nexid.lat/logout", {
    method: "POST",
    headers: {
      origin: "https://attacker.invalid",
      "sec-fetch-site": "cross-site",
    },
  }));
  assert.equal(crossSiteResponse.status, 403);
  assert.deepEqual(await crossSiteResponse.json(), { ok: false, reason: "same_origin_required" });

  const sameOriginResponse = await route.POST(new Request("https://app.nexid.lat/logout", {
    method: "POST",
    headers: {
      origin: "https://app.nexid.lat",
      "sec-fetch-site": "same-origin",
    },
  }));
  assert.equal(sameOriginResponse.status, 200);
  assert.match(await sameOriginResponse.text(), /location\.replace/);
});

test("internal batch creation derives role and capabilities from the validated session", async () => {
  const internalBatch = await source("../src/app/(app)/batches/internal/page.tsx");

  assert.match(internalBatch, /requireDashboardSession\("batches:write"\)/);
  assert.match(internalBatch, /currentRole=\{session\.role\}/);
  assert.match(internalBatch, /currentPermissions=\{session\.permissions\}/);
  assert.match(internalBatch, /currentDeniedPermissions=\{session\.deniedPermissions\}/);
  assert.doesNotMatch(internalBatch, /currentRole="super-admin"/);
  assert.doesNotMatch(internalBatch, /currentPermissions=\{\["\*"\]\}/);
});

test("sensitive direct destinations use the same server-side policy as dashboard navigation", async () => {
  const [guard, investorLayout, salesLayout, subscriptions, encoderLayout] = await Promise.all([
    source("../src/lib/dashboard-destination-guard.ts"),
    source("../src/app/(app)/investor-snapshot/layout.tsx"),
    source("../src/app/(app)/sales-playbook/layout.tsx"),
    source("../src/app/(app)/subscriptions/page.tsx"),
    source("../src/app/(app)/demo-lab/encode/layout.tsx"),
  ]);

  assert.match(guard, /dashboardCanOpenDestination\(destination, \{/);
  assert.match(guard, /deniedPermissions: session\.deniedPermissions/);
  assert.match(guard, /if \(!dashboardSessionCanOpenDestination\(session, destination\)\) notFound\(\)/);
  assert.match(guard, /const session = await requireDashboardSession\(\)/);
  assert.match(investorLayout, /requireDashboardDestination\("investorSnapshot"\)/);
  assert.match(salesLayout, /requireDashboardDestination\("salesPlaybook"\)/);
  assert.match(subscriptions, /requireDashboardDestination\("subscriptions"\)/);
  assert.match(encoderLayout, /requireDashboardDestination\("demoEncoder"\)/);
});

test("tenant operational routes that previously relied on hidden navigation are guarded server-side", async () => {
  const guardedLayouts = {
    analytics: "../src/app/(app)/analytics/layout.tsx",
    serviceLevels: "../src/app/(app)/service-levels/layout.tsx",
    tags: "../src/app/(app)/tags/layout.tsx",
    marketplace: "../src/app/(app)/consumer-network/marketplace/layout.tsx",
    consumerOverview: "../src/app/(app)/consumer-network/overview/layout.tsx",
  };

  for (const [destination, path] of Object.entries(guardedLayouts)) {
    const layout = await source(path);
    assert.match(layout, new RegExp(`requireDashboardDestination\\("${destination}"\\)`), destination);
  }
});

test("sidebar search has one result per authorized href and billing follows the registry", async () => {
  const shell = await source("../src/components/dashboard-shell.tsx");
  assert.match(shell, /new Map\([\s\S]*\.map\(\(entry\) => \[entry\.href, entry\] as const\)/);
  assert.match(shell, /canOpenDestination\("billing"\) \? \([\s\S]*DASHBOARD_DESTINATIONS\.billing\.href/);
});

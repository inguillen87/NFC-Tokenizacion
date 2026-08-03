import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const proxySource = await readFile(new URL("../src/app/api/internal/demo/[...path]/route.ts", import.meta.url), "utf8");
const policySource = await readFile(new URL("../src/lib/demo-access-policy.ts", import.meta.url), "utf8");
const pageSource = await readFile(new URL("../src/app/(app)/demo-lab/page.tsx", import.meta.url), "utf8");
const missionSource = await readFile(new URL("../src/components/demo-lab.tsx", import.meta.url), "utf8");
const shellSource = await readFile(new URL("../src/components/dashboard-shell.tsx", import.meta.url), "utf8");
const profilesSource = await readFile(new URL("../src/lib/access-profiles.ts", import.meta.url), "utf8");

test("demo admin proxy requires a dashboard session, permission and tenant scope", () => {
  assert.match(proxySource, /getDashboardSessionCredential\(\{ persistRotation: true \}\)/);
  assert.match(proxySource, /authentication_required/);
  assert.match(proxySource, /dashboardPermissionMatches\(session\.permissions, permission\)/);
  assert.match(proxySource, /demoTenantScopeAllowed\(session\.role, session\.tenantSlug\)/);
  assert.match(proxySource, /demoPayloadScopeAllowed\(payload\)/);
  assert.match(proxySource, /validDemoResetCommand\(payload\)/);
  assert.match(proxySource, /demoEndpointAllowed\(req\.method, path\)/);
  assert.doesNotMatch(policySource, /"seed"|"upload-manifest"|"upload-products"/);
});

test("demo policy is fixed to the isolated Bodega corpus", () => {
  assert.match(policySource, /DEMO_TENANT_SLUG = "demobodega"/);
  assert.match(policySource, /DEMO_BATCH_ID = "DEMO-2026-02"/);
  assert.match(policySource, /RESET \$\{DEMO_TENANT_SLUG\}\/\$\{DEMO_BATCH_ID\}/);
  assert.match(policySource, /path\.length > 1/);
  assert.match(policySource, /return "demo:read"/);
  assert.match(policySource, /return "demo:reset"/);
  assert.match(policySource, /return "demo:run"/);
});

test("dashboard Demo Lab is a permissioned native mission control, not an iframe", () => {
  assert.match(pageSource, /requireDashboardSession\("demo:read"\)/);
  assert.match(pageSource, /dashboardPermissionMatches\(session\.permissions, "demo:run"\)/);
  assert.match(pageSource, /session\.role === "super-admin" && dashboardPermissionMatches\(session\.permissions, "demo:reset"\)/);
  assert.match(missionSource, /data-testid="demo-mission-control"/);
  assert.match(missionSource, /data-testid="demo-execution-receipt"/);
  assert.match(missionSource, /data\.payload && typeof data\.payload === "object"/);
  assert.match(missionSource, /execution\.event_id/);
  assert.match(missionSource, /persisted: source === "demo"/);
  assert.match(missionSource, /chainWrite: false/);
  assert.match(missionSource, /No hubo escritura on-chain/);
  assert.doesNotMatch(pageSource + missionSource, /<iframe/);
});

test("Demo Lab is discoverable through permission-aware dashboard navigation", () => {
  assert.match(shellSource, /const permissionMatches = \(permission: string\) => dashboardPermissionMatches\([\s\S]*currentDeniedPermissions/);
  assert.match(shellSource, /permissionMatches\("demo:read"\)/);
  assert.match(shellSource, /href: "\/demo-lab", label: "Demo Mission Control", icon: FlaskConical/);
  assert.match(shellSource, /pathname\.startsWith\("\/demo-lab"\)[\s\S]*title: "Demo Mission Control", subtitle: "Tenant demo operations"/);
  assert.match(profilesSource, /"demo:\*"/);
  assert.match(profilesSource, /"demo:read", "demo:run"/);
});

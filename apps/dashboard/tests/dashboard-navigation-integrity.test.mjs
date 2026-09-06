import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [shell, content, home, crm] = await Promise.all([
  readFile(new URL("../src/components/dashboard-shell.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/dashboard-content.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/dashboard-home-client.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/executive-realtime-crm.tsx", import.meta.url), "utf8"),
]);

const { dashboardCanOpenDestination } = await import("../src/lib/dashboard-destination-policy.ts");

test("mobile scan never links to a nonexistent public simulator", () => {
  assert.doesNotMatch(shell, /\/sun\/simulate/);
  assert.doesNotMatch(shell, /href=\{publicMobile\}/);
  assert.match(shell, /data-testid="mobile-scan-signed-link-required"/);
  assert.match(shell, /Tap móvil · requiere URL firmada/);
});

test("home module cards are filtered through the shared destination policy", () => {
  assert.match(home, /loyaltyModuleCandidates[\s\S]*destination: "campaigns"/);
  assert.match(home, /\.filter\(\(\{ destination \}\) => dashboardCanOpenDestination\(destination, destinationAccess\)\)/);
  assert.match(home, /home-loyalty-destinations-unavailable/);
  assert.doesNotMatch(home, /status: "activo"/);

  const deniedTenant = {
    role: "tenant-admin",
    permissions: ["campaigns:read", "rewards:read", "crm:read"],
    deniedPermissions: ["campaigns:read"],
    isDemo: false,
  };
  assert.equal(dashboardCanOpenDestination("campaigns", deniedTenant), false);
  assert.equal(dashboardCanOpenDestination("consumerOverview", deniedTenant), false);
  assert.equal(dashboardCanOpenDestination("rewards", deniedTenant), true);
});

test("CRM deep links become honest unavailable states without permission", () => {
  assert.match(crm, /canReadSensitiveEvents \? \([\s\S]*Ver todos los eventos[\s\S]*events-audit-unavailable/);
  assert.match(crm, /onOpenAudit=\{canReadSensitiveEvents \? \(\) => router\.push\(DASHBOARD_DESTINATIONS\.events\.href\) : undefined\}/);
  assert.match(crm, /auditUnavailableReason=\{eventsUnavailableReason\}/);
  assert.doesNotMatch(crm, /openCampaignStudio|DASHBOARD_DESTINATIONS\.campaigns/);
});

test("shell health is neutral and Demo Pack count reflects configured data", () => {
  assert.match(shell, /data-testid="dashboard-data-status-neutral"/);
  assert.match(shell, /<Badge>\{shell\.apiConnected\}<\/Badge>/);
  assert.doesNotMatch(shell, /<Badge tone="green">\{shell\.apiConnected\}<\/Badge>/);
  assert.match(content, /Estado de datos: ver cada módulo/);
  assert.doesNotMatch(content, /Estado API en módulo/);

  assert.match(home, /demoPacks\.length === 0/);
  assert.match(home, /`\$\{demoPacks\.length\}/);
  assert.doesNotMatch(home, /10 Escenarios Demo Pack Listos/);
});

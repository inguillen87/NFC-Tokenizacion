import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const settingsSource = await readFile(new URL("../src/app/(app)/settings/page.tsx", import.meta.url), "utf8");
const tenantDetailSource = await readFile(new URL("../src/app/(app)/tenants/[slug]/page.tsx", import.meta.url), "utf8");
const secureLogoutSource = await readFile(new URL("../src/components/secure-dashboard-logout-button.tsx", import.meta.url), "utf8");

test("settings page is an enterprise account command center", () => {
  assert.match(settingsSource, /data-testid="settings-command-center"/);
  assert.match(settingsSource, /Centro de administracion del workspace/);
  assert.match(settingsSource, /Cuenta operativa/);
  assert.match(settingsSource, /Siguiente accion recomendada/);
  assert.match(settingsSource, /data-testid="settings-primary-action"/);
  assert.match(settingsSource, /data-testid="settings-session-actions"/);
  assert.match(settingsSource, /Volver al dashboard/);
  assert.match(settingsSource, /Cambiar cuenta o perfil/);
  assert.doesNotMatch(settingsSource, /href="\/login"/);
  assert.match(settingsSource, /<SecureDashboardLogoutButton/);
  assert.match(settingsSource, /testId="settings-change-account"/);
  assert.match(settingsSource, /testId="settings-logout"/);
  assert.match(secureLogoutSource, /method="post" action="\/logout"/);
  assert.match(secureLogoutSource, /await fetch\("\/logout", \{ method: "POST", cache: "no-store" \}\)/);
  assert.match(secureLogoutSource, /Cerrar sesion segura/);
});

test("settings page keeps tenant-scoped operational links", () => {
  assert.match(settingsSource, /const tenantQuery = tenantSlug \? `\?tenant=\$\{encodeURIComponent\(tenantSlug\)\}` : ""/);
  assert.match(settingsSource, /const tenantHref = tenantSlug \? `\/tenants\/\$\{encodeURIComponent\(tenantSlug\)\}` : "\/tenants"/);
  assert.match(settingsSource, /href: `\/api-keys\$\{tenantQuery\}`/);
  assert.match(settingsSource, /dashboardHighImpactPermissionMatches\([\s\S]*"api_keys\.read"[\s\S]*session\.deniedPermissions/);
  assert.match(settingsSource, /dashboardHighImpactPermissionMatches\([\s\S]*"proofs\.read"[\s\S]*session\.deniedPermissions/);
  assert.match(settingsSource, /!tile\.href\.startsWith\("\/api-keys"\) \|\| canReadApiKeys/);
  assert.match(settingsSource, /tile\.href !== "\/proof" \|\| canReadProof/);
  assert.match(settingsSource, /\{canReadProof \? \([\s\S]*href="\/proof"[\s\S]*\) : null\}/);
  assert.match(settingsSource, /href: `\/subscriptions\$\{tenantQuery\}`/);
  assert.match(settingsSource, /href: canManageUsers \? "\/users" : "\/settings"/);
  assert.match(settingsSource, /sessionSecurityLabel/);
  assert.match(settingsSource, /Google\/Clerk SSO verificado/);
});

test("tenant detail page exposes account administration without hiding it in the CRM", () => {
  assert.match(tenantDetailSource, /data-testid="tenant-detail-enterprise-profile"/);
  assert.match(tenantDetailSource, /data-testid="tenant-detail-admin-actions"/);
  assert.match(tenantDetailSource, /Administracion de cuenta/);
  assert.match(tenantDetailSource, /Tenant account cockpit/);
  assert.match(tenantDetailSource, /Playbook ejecutivo/);
  assert.match(tenantDetailSource, /data-testid="tenant-proof-layer-grid"/);
  assert.match(tenantDetailSource, /Que evidencia registra nexID, IOTA, Polygon y API/);
  assert.match(tenantDetailSource, /nexID Core/);
  assert.match(tenantDetailSource, /IOTA proof/);
  assert.match(tenantDetailSource, /Polygon titularidad digital/);
  assert.match(tenantDetailSource, /SDK \/ API/);
  assert.match(tenantDetailSource, /href: "\/settings"/);
  assert.match(tenantDetailSource, /href: "\/users"/);
  assert.match(tenantDetailSource, /const tenantParam = encodeURIComponent\(tenant\.slug\)/);
  assert.match(tenantDetailSource, /`\/api-keys\?tenant=\$\{tenantParam\}`/);
  assert.match(tenantDetailSource, /`\/subscriptions\?tenant=\$\{tenantParam\}`/);
  assert.match(tenantDetailSource, /href="\/tenants"/);
  assert.match(tenantDetailSource, /Volver a tenants/);
  assert.match(tenantDetailSource, /data-testid="tenant-operational-links"/);
  assert.doesNotMatch(tenantDetailSource, /Quick CTA/);
  assert.doesNotMatch(tenantDetailSource, /Create supplier batch/);
  assert.doesNotMatch(tenantDetailSource, /Lead \/ opportunities/);
});

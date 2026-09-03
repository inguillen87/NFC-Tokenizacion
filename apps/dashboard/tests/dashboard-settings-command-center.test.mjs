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
  assert.match(secureLogoutSource, /await dashboardFetch\("\/logout", \{[\s\S]*method: "POST",[\s\S]*credentials: "same-origin"/);
  assert.match(secureLogoutSource, /Cerrar sesion segura/);
});

test("settings renders the account email without triggering Cloudflare HTML rewriting", () => {
  assert.match(settingsSource, /function CloudflareSafeEmail/);
  assert.match(settingsSource, /value\.lastIndexOf\("@"\)/);
  assert.match(settingsSource, /aria-label=\{session\.email\}/);
  assert.match(settingsSource, /<CloudflareSafeEmail value=\{session\.email\} \/>/);
  assert.doesNotMatch(settingsSource, />\{session\.email\}<\/p>/);
});

test("settings page keeps tenant-scoped operational links", () => {
  assert.match(settingsSource, /const tenantQuery = tenantSlug \? `\?tenant=\$\{encodeURIComponent\(tenantSlug\)\}` : ""/);
  assert.match(settingsSource, /const tenantHref = tenantSlug \? `\/tenants\/\$\{encodeURIComponent\(tenantSlug\)\}` : "\/tenants"/);
  assert.match(settingsSource, /href: `\/api-keys\$\{tenantQuery\}`/);
  assert.match(settingsSource, /dashboardCanOpenDestination\(destination, destinationAccess\)/);
  assert.match(settingsSource, /deniedPermissions: session\.deniedPermissions/);
  assert.match(settingsSource, /destination: "apiKeys"/);
  assert.match(settingsSource, /destination: "proof"/);
  assert.match(settingsSource, /const tiles = allTiles\.filter\(\(tile\) => !tile\.destination \|\| canOpenDestination\(tile\.destination\)\)/);
  assert.match(settingsSource, /const restrictedTiles = allTiles\.filter\(\(tile\) => tile\.destination && !canOpenDestination\(tile\.destination\)\)/);
  assert.match(settingsSource, /data-testid="settings-restricted-destinations"/);
  assert.match(settingsSource, /sin enlaces ni acciones/);
  assert.match(settingsSource, /\{canReadProof \? \([\s\S]*DASHBOARD_DESTINATIONS\.proof\.href[\s\S]*\) : null\}/);
  assert.match(settingsSource, /href: `\/subscriptions\$\{tenantQuery\}`/);
  assert.match(settingsSource, /destination: "users"[\s\S]*href: DASHBOARD_DESTINATIONS\.users\.href/);
  assert.doesNotMatch(settingsSource, /permissions\.includes\("employees:\*"\)/);
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
  assert.match(tenantDetailSource, /destination: "settings" as const/);
  assert.match(tenantDetailSource, /destination: "users" as const/);
  assert.match(tenantDetailSource, /const tenantParam = encodeURIComponent\(tenant\.slug\)/);
  assert.match(tenantDetailSource, /`\/api-keys\?tenant=\$\{tenantParam\}`/);
  assert.match(tenantDetailSource, /`\/subscriptions\?tenant=\$\{tenantParam\}`/);
  assert.match(tenantDetailSource, /dashboardCanOpenDestination\(destination, destinationAccess\)/);
  assert.match(tenantDetailSource, /\.filter\(canOpenScopedLink\)/);
  assert.match(tenantDetailSource, /const backHref = canOpenDestination\("tenants"\) \? DASHBOARD_DESTINATIONS\.tenants\.href : DASHBOARD_DESTINATIONS\.settings\.href/);
  assert.match(tenantDetailSource, /data-testid="tenant-detail-restricted-destinations"/);
  assert.match(tenantDetailSource, /no se ofrecen rutas que luego fallen por permisos/);
  assert.match(tenantDetailSource, /data-testid="tenant-operational-links"/);
  assert.doesNotMatch(tenantDetailSource, /Quick CTA/);
  assert.doesNotMatch(tenantDetailSource, /Create supplier batch/);
  assert.doesNotMatch(tenantDetailSource, /Lead \/ opportunities/);
});

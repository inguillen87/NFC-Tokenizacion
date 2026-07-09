import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const settingsSource = await readFile(new URL("../src/app/(app)/settings/page.tsx", import.meta.url), "utf8");
const tenantDetailSource = await readFile(new URL("../src/app/(app)/tenants/[slug]/page.tsx", import.meta.url), "utf8");

test("settings page is an enterprise account command center", () => {
  assert.match(settingsSource, /data-testid="settings-command-center"/);
  assert.match(settingsSource, /Centro de administracion del workspace/);
  assert.match(settingsSource, /Cuenta operativa/);
  assert.match(settingsSource, /Siguiente accion recomendada/);
  assert.match(settingsSource, /data-testid="settings-primary-action"/);
  assert.match(settingsSource, /data-testid="settings-session-actions"/);
  assert.match(settingsSource, /Volver al dashboard/);
  assert.match(settingsSource, /Cambiar cuenta o perfil/);
  assert.match(settingsSource, /href="\/logout"/);
  assert.doesNotMatch(settingsSource, /href="\/login"/);
  assert.match(settingsSource, /method="post" action="\/logout"/);
  assert.match(settingsSource, /data-testid="settings-logout"/);
  assert.match(settingsSource, /Cerrar sesion segura/);
});

test("settings page keeps tenant-scoped operational links", () => {
  assert.match(settingsSource, /const tenantQuery = tenantSlug \? `\?tenant=\$\{encodeURIComponent\(tenantSlug\)\}` : ""/);
  assert.match(settingsSource, /const tenantHref = tenantSlug \? `\/tenants\/\$\{encodeURIComponent\(tenantSlug\)\}` : "\/tenants"/);
  assert.match(settingsSource, /href: `\/api-keys\$\{tenantQuery\}`/);
  assert.match(settingsSource, /href: `\/subscriptions\$\{tenantQuery\}`/);
  assert.match(settingsSource, /href: canManageUsers \? "\/users" : "\/settings"/);
  assert.match(settingsSource, /sessionSecurityLabel/);
  assert.match(settingsSource, /SSO Google\/Clerk/);
});

test("tenant detail page exposes account administration without hiding it in the CRM", () => {
  assert.match(tenantDetailSource, /data-testid="tenant-detail-admin-actions"/);
  assert.match(tenantDetailSource, /Administracion de cuenta/);
  assert.match(tenantDetailSource, /href="\/settings"/);
  assert.match(tenantDetailSource, /href="\/users"/);
  assert.match(tenantDetailSource, /`\/api-keys\?tenant=\$\{tenant\.slug\}`/);
  assert.match(tenantDetailSource, /`\/subscriptions\?tenant=\$\{tenant\.slug\}`/);
  assert.match(tenantDetailSource, /href="\/tenants"/);
  assert.match(tenantDetailSource, /Volver a tenants/);
});

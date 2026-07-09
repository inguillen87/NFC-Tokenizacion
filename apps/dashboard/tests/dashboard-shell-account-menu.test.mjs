import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const shellSource = await readFile(new URL("../src/components/dashboard-shell.tsx", import.meta.url), "utf8");
const layoutSource = await readFile(new URL("../src/app/(app)/layout.tsx", import.meta.url), "utf8");
const homeClientSource = await readFile(new URL("../src/components/dashboard-home-client.tsx", import.meta.url), "utf8");
const crmSource = await readFile(new URL("../src/components/executive-realtime-crm.tsx", import.meta.url), "utf8");

test("dashboard shell exposes enterprise account drawer instead of bare logout", () => {
  assert.match(shellSource, /import \{ TenantAccountMenu \} from "\.\/tenant-account-menu"/);
  assert.match(shellSource, /<TenantAccountMenu[\s\S]*email=\{currentEmail\}/);
  assert.match(shellSource, /<TenantAccountMenu[\s\S]*label=\{currentLabel\}/);
  assert.match(shellSource, /<TenantAccountMenu[\s\S]*permissions=\{currentPermissions\}/);
  assert.match(shellSource, /className="dashboard-shell-account-menu w-full sm:w-auto"/);
  assert.match(shellSource, /surface="dashboard"/);
  assert.match(shellSource, /<TenantAccountMenu[\s\S]*tenantSlug=\{currentTenantSlug\}/);
  assert.doesNotMatch(shellSource, /onClick=\{handleLogout\}/);
  assert.doesNotMatch(shellSource, /const \[loggingOut, setLoggingOut\]/);
});

test("app layout passes real session status into account drawer", () => {
  assert.match(layoutSource, /currentTenantSlug=\{session\.tenantSlug\}/);
  assert.match(layoutSource, /currentMfaVerified=\{session\.mfaVerified\}/);
  assert.match(layoutSource, /currentSetupCompleted=\{session\.setupCompleted\}/);
  assert.match(layoutSource, /import \{ isClerkConfiguredForRuntime \} from "\.\.\/\.\.\/lib\/clerk-env"/);
  assert.match(layoutSource, /clerkEnabled=\{isClerkConfiguredForRuntime\(\)\}/);
  assert.match(shellSource, /clerkEnabled\?: boolean/);
  assert.match(shellSource, /clerkEnabled=\{clerkEnabled\}/);
});

test("fullscreen CRM account menu receives same permissions contract", () => {
  assert.match(homeClientSource, /permissions:\s*session\.permissions/);
  assert.match(homeClientSource, /clerkEnabled\?: boolean/);
  assert.match(homeClientSource, /clerkEnabled\s*\}\s*: DashboardHomeClientProps/);
  assert.match(homeClientSource, /clerkEnabled,\s*\}\}/);
  assert.match(crmSource, /permissions\?: string\[\]/);
  assert.match(crmSource, /clerkEnabled\?: boolean/);
  assert.match(crmSource, /className="nexid-crm-account-menu w-full sm:w-auto"/);
  assert.match(crmSource, /permissions=\{account\.permissions\}/);
  assert.match(crmSource, /surface="crm"/);
  assert.match(crmSource, /clerkEnabled=\{account\.clerkEnabled\}/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const shellSource = await readFile(new URL("../src/components/dashboard-shell.tsx", import.meta.url), "utf8");
const layoutSource = await readFile(new URL("../src/app/(app)/layout.tsx", import.meta.url), "utf8");
const homeClientSource = await readFile(new URL("../src/components/dashboard-home-client.tsx", import.meta.url), "utf8");
const crmSource = await readFile(new URL("../src/components/executive-realtime-crm.tsx", import.meta.url), "utf8");
const globalsSource = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("dashboard shell exposes enterprise account drawer instead of bare logout", () => {
  assert.match(shellSource, /import \{ TenantAccountMenu \} from "\.\/tenant-account-menu"/);
  assert.match(shellSource, /<TenantAccountMenu[\s\S]*email=\{currentEmail\}/);
  assert.match(shellSource, /<TenantAccountMenu[\s\S]*label=\{currentLabel\}/);
  assert.match(shellSource, /<TenantAccountMenu[\s\S]*permissions=\{currentPermissions\}/);
  assert.match(shellSource, /<TenantAccountMenu[\s\S]*deniedPermissions=\{currentDeniedPermissions\}/);
  assert.match(shellSource, /className="dashboard-shell-account-menu shrink-0 sm:w-auto"/);
  assert.doesNotMatch(shellSource, /className="dashboard-shell-account-menu w-full sm:w-auto"/);
  assert.match(shellSource, /surface="dashboard"/);
  assert.match(shellSource, /<TenantAccountMenu[\s\S]*tenantSlug=\{currentTenantSlug\}/);
  assert.doesNotMatch(shellSource, /onClick=\{handleLogout\}/);
  assert.doesNotMatch(shellSource, /const \[loggingOut, setLoggingOut\]/);
  assert.match(shellSource, /canOpenDestination\("leadsTickets"\) \? \([\s\S]*<AdminNotificationBell/);
});

test("dashboard account trigger stays compact in mobile header", () => {
  assert.match(globalsSource, /\.dashboard-header \.dashboard-shell-account-menu\s*\{[\s\S]*flex:\s*0 1 auto/);
  assert.match(globalsSource, /@media \(max-width:\s*640px\)\s*\{[\s\S]*\.dashboard-header \.dashboard-shell-account-menu\s*\{[\s\S]*width:\s*auto !important/);
  assert.match(globalsSource, /@media \(max-width:\s*640px\)\s*\{[\s\S]*\.dashboard-header \.dashboard-shell-account-menu \[data-testid="tenant-account-menu-trigger"\]\s*\{[\s\S]*border-radius:\s*999px !important/);
  assert.match(globalsSource, /@media \(max-width:\s*640px\)\s*\{[\s\S]*\.dashboard-header \.dashboard-shell-account-menu \[data-testid="tenant-account-menu-trigger"\]\s*\{[\s\S]*height:\s*2\.875rem !important/);
  assert.match(globalsSource, /@media \(max-width:\s*640px\)\s*\{[\s\S]*\.dashboard-header \.dashboard-shell-account-menu \[data-testid="tenant-account-menu-trigger"\]\s*\{[\s\S]*max-height:\s*2\.875rem !important/);
  assert.match(globalsSource, /@media \(max-width:\s*640px\)\s*\{[\s\S]*\.dashboard-header \.dashboard-shell-account-menu \[data-testid="tenant-account-menu-trigger"\]\s*\{[\s\S]*max-width:\s*15\.5rem !important/);
  assert.match(globalsSource, /@media \(max-width:\s*640px\)\s*\{[\s\S]*\.dashboard-header \.dashboard-shell-account-menu \[data-testid="tenant-account-menu-trigger"\] > span:first-child\s*\{[\s\S]*width:\s*2rem !important/);
  assert.match(globalsSource, /@media \(max-width:\s*640px\)\s*\{[\s\S]*\.dashboard-header \.dashboard-shell-account-menu \[data-account-menu-compact="true"\] > span:nth-child\(2\) span\s*\{[\s\S]*display:\s*none !important/);
  assert.match(globalsSource, /@media \(max-width:\s*640px\)\s*\{[\s\S]*\.nexid-crm-account-menu\s*\{[\s\S]*max-width:\s*min\(100%, 15\.5rem\) !important/);
  assert.match(globalsSource, /\.nexid-crm-account-menu \[data-testid="tenant-account-menu-trigger"\]\s*\{[^}]*height:\s*2\.875rem !important/s);
  assert.match(globalsSource, /\.nexid-crm-account-menu \[data-account-menu-compact="true"\] > span:nth-child\(2\) span\s*\{[^}]*display:\s*none !important/s);
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
  assert.match(crmSource, /import \{ SecureDashboardLogoutButton \} from "\.\/secure-dashboard-logout-button"/);
  assert.match(crmSource, /<SecureDashboardLogoutButton[\s\S]*testId="crm-rail-secure-logout"/);
  assert.doesNotMatch(crmSource, /<form method="post" action="\/logout"/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const layout = read("../src/app/layout.tsx");
const authThemeControl = read("../src/components/auth-theme-control.tsx");
const globals = read("../src/app/globals.css");
const loginPage = read("../src/app/login/page.tsx");
const loginPanel = read("../src/components/login-form-panel.tsx");
const signInPage = read("../src/app/sign-in/[[...sign-in]]/page.tsx");
const signUpPage = read("../src/app/sign-up/[[...sign-up]]/page.tsx");
const dashboardShell = read("../src/components/dashboard-shell.tsx");
const accountMenu = read("../src/components/tenant-account-menu.tsx");
const opsCommandCenter = read("../src/components/ops-command-center.tsx");

test("dashboard SSR resolves the shared versioned white-first preference", () => {
  assert.match(layout, /resolveThemePreference, THEME_PREFERENCE_VERSION_COOKIE/);
  assert.match(layout, /cookieStore\.get\(THEME_PREFERENCE_VERSION_COOKIE\)/);
  assert.match(layout, /resolveThemePreference\(themeCookie, themeVersionCookie\)/);
  assert.match(layout, /data-theme=\{theme\}/);
  assert.doesNotMatch(layout, /themeCookie === "light" \? "light" : "dark"/);

  assert.match(authThemeControl, /resolveThemePreference/);
  assert.match(authThemeControl, /initialTheme=\{initialTheme\}/);
  assert.doesNotMatch(authThemeControl, /initialTheme="light"/);
});

test("all public authentication entry points share one semantic theme shell", () => {
  for (const source of [
    loginPage,
    read("../src/app/register/page.tsx"),
    read("../src/app/forgot-password/page.tsx"),
    read("../src/app/reset-password/page.tsx"),
    signInPage,
    signUpPage,
  ]) {
    assert.match(source, /dashboard-auth-surface/);
    assert.match(source, /AuthThemeControl/);
    assert.match(source, /dashboard-auth-card/);
  }

  assert.match(loginPage, /dashboard-auth-backdrop/);
  assert.match(loginPanel, /dashboard-auth-feature-card/);
  assert.match(loginPanel, /dashboard-auth-status-card/);
  assert.match(loginPanel, /dashboard-auth-profile-card/);
  assert.doesNotMatch(loginPanel, /linear-gradient\(145deg,rgba\(8,47,73/);
});

test("Clerk surfaces inherit live dashboard theme variables", () => {
  for (const source of [signInPage, signUpPage]) {
    assert.match(source, /colorBackground: "var\(--auth-clerk-bg\)"/);
    assert.match(source, /colorForeground: "var\(--auth-text\)"/);
    assert.match(source, /colorInput: "var\(--auth-input-bg\)"/);
    assert.doesNotMatch(source, /colorBackground: "#020617"/);
  }
});

test("auth tokens define complete dark and light surfaces instead of recoloring text over dark panels", () => {
  assert.match(globals, /\.dashboard-auth-surface \{[\s\S]*--auth-feature-bg:/);
  assert.match(globals, /:where\(html\.theme-light, html\[data-theme="light"\]\) \.dashboard-auth-surface \{[\s\S]*--auth-clerk-bg: #ffffff/);
  assert.match(globals, /\.dashboard-auth-feature-card \{[\s\S]*background: var\(--auth-feature-bg\) !important/);
  assert.match(globals, /\.dashboard-auth-profile-card \{[\s\S]*background: var\(--auth-profile-bg\) !important/);
  assert.match(globals, /\.dashboard-auth-status-card\[data-state="ready"\]/);
  assert.match(globals, /@media \(max-width: 640px\) \{[\s\S]*\.dashboard-auth-theme-control/);
});

test("dashboard navigation avoids dark-only gradients and locale options", () => {
  assert.match(dashboardShell, /dashboard-role-card/);
  assert.match(dashboardShell, /dashboard-ops-tools-card/);
  assert.match(dashboardShell, /dashboard-ops-tool-link/);
  assert.match(dashboardShell, /className="locale-switcher/);
  assert.doesNotMatch(dashboardShell, /<option[^>]+bg-slate-900/);
  assert.match(globals, /data-theme="light"\]\) \.dashboard-role-card/);
  assert.match(globals, /data-theme="light"\]\) \.dashboard-ops-tools-card/);
});

test("tenant account drawer is light in light mode and dark in dark mode", () => {
  assert.match(accountMenu, /\.nexid-account-layer \.tenant-account-panel \{[\s\S]*linear-gradient\(180deg, #08111f/);
  assert.match(accountMenu, /html\.theme-light \.nexid-account-layer,[\s\S]*linear-gradient\(180deg, #ffffff 0%, #f4f9ff/);
  assert.match(accountMenu, /html\[data-theme="light"\] \.nexid-account-dialog/);
  assert.match(accountMenu, /tenant-account-panel__footer[\s\S]*rgba\(255, 255, 255, 0\.98\)/);
  assert.doesNotMatch(accountMenu, /html\.theme-light \.nexid-account-layer \.tenant-account-panel \{[\s\S]{0,260}#08111f/);
});

test("maps and operational chart tooltips follow the selected theme", () => {
  assert.match(globals, /data-theme="light"\]\) \.maplibregl-ctrl-group/);
  assert.match(globals, /data-theme="light"\]\) \.maplibregl-ctrl button\.maplibregl-ctrl-zoom-in/);
  assert.match(globals, /--dashboard-chart-tooltip-bg: #ffffff/);
  assert.match(opsCommandCenter, /background: "var\(--dashboard-chart-tooltip-bg\)"/);
  assert.doesNotMatch(opsCommandCenter, /contentStyle=\{\{ background: "#020617"/);
});

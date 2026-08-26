import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const preferenceModuleUrl = new URL("../../../packages/ui/src/theme-preference.ts", import.meta.url);

test("theme preference resolver executes the one-time white-first migration", async () => {
  const {
    resolveThemePreference,
    themeCookieDomainForHostname,
    THEME_PREFERENCE_VERSION,
  } = await import(preferenceModuleUrl.href);

  assert.equal(resolveThemePreference(undefined, undefined), "light");
  assert.equal(resolveThemePreference("dark", undefined), "light", "legacy dark must migrate to light");
  assert.equal(resolveThemePreference("dark", "legacy-version"), "light");
  assert.equal(resolveThemePreference("dark", THEME_PREFERENCE_VERSION), "dark", "a new explicit dark choice persists");
  assert.equal(resolveThemePreference("light", THEME_PREFERENCE_VERSION), "light");
  assert.equal(resolveThemePreference("invalid", THEME_PREFERENCE_VERSION), "light");
  assert.equal(themeCookieDomainForHostname("www.nexid.com.ar"), ".nexid.com.ar");
  assert.equal(themeCookieDomainForHostname("nexid.lat"), ".nexid.lat");
  assert.equal(themeCookieDomainForHostname("localhost"), null);
});

test("white-first theme migration ignores legacy dark cookies exactly once", async () => {
  const [preference, toggle, layout, home, sdk, demoLab, demoLabTheme, route, uiPackage] = await Promise.all([
    read("../../../packages/ui/src/theme-preference.ts"),
    read("../../../packages/ui/src/theme-toggle.tsx"),
    read("../src/app/layout.tsx"),
    read("../src/app/page.tsx"),
    read("../src/app/sdk/page.tsx"),
    read("../src/app/(public)/demo-lab/page.tsx"),
    read("../src/app/(public)/demo-lab/demo-lab-hub-theme.tsx"),
    read("../src/app/api/theme/route.ts"),
    read("../../../packages/ui/package.json"),
  ]);

  assert.match(preference, /THEME_PREFERENCE_VERSION = "white-first-v2"/);
  assert.match(preference, /if \(versionCookie !== THEME_PREFERENCE_VERSION\) return "light"/);
  assert.match(preference, /return themeCookie === "dark" \? "dark" : "light"/);
  assert.match(preference, /normalized === "nexid\.com\.ar" \|\| normalized\.endsWith\("\.nexid\.com\.ar"\)/);
  assert.match(uiPackage, /"\.\/theme-preference": "\.\/src\/theme-preference\.ts"/);

  for (const surface of [layout, home, sdk, demoLab]) {
    assert.match(surface, /resolveThemePreference\(/);
    assert.match(surface, /THEME_PREFERENCE_VERSION_COOKIE/);
  }

  const versionWrite = toggle.indexOf("localStorage.setItem(THEME_PREFERENCE_VERSION_STORAGE");
  const themeWrite = toggle.indexOf('localStorage.setItem("theme"');
  assert.ok(versionWrite >= 0 && versionWrite < themeWrite, "version must be stored before broadcasting the theme");
  assert.match(toggle, /THEME_PREFERENCE_VERSION_COOKIE/);
  assert.match(toggle, /themeCookieDomainForHostname\(window\.location\.hostname\)/);
  assert.match(toggle, /domain=\$\{domain\}/);
  assert.match(toggle, /theme=; \$\{cookieBase\}; max-age=0/);
  assert.doesNotMatch(toggle, /document\.cookie = `theme=\$\{theme\}; \$\{persistentCookie\}`;[\s\S]*if \(domain\)/);

  assert.match(route, /response\.cookies\.set\(THEME_PREFERENCE_VERSION_COOKIE, THEME_PREFERENCE_VERSION/);
  assert.match(route, /searchParams\.get\("theme"\) === "dark" \? "dark" : "light"/);
  assert.match(route, /response\.headers\.append\("Set-Cookie", `theme=; Path=\/; Max-Age=0/);
  assert.match(route, /ResponseCookies collapses same-name values even when Domain differs/);
  assert.match(demoLab, /requestedThemeParam === "light" \|\| requestedThemeParam === "dark"[\s\S]*: persistedTheme/);
  assert.match(demoLabTheme, /applyTheme as applySiteTheme/);
  assert.match(demoLabTheme, /THEME_PREFERENCE_VERSION_STORAGE/);
  assert.match(demoLabTheme, /initialTheme = "light"/);
  assert.doesNotMatch(demoLabTheme, /domain=\.nexid\.lat/);
});

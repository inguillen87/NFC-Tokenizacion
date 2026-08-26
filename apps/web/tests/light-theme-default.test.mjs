import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [webLayout, homePage, themeToggle, demoPage, demoToggle, dashboardLayout, globalOpsMap, realtimeMap, webManifest, dashboardManifest, themeRoute] = await Promise.all([
  read("../src/app/layout.tsx"),
  read("../src/app/page.tsx"),
  read("../../../packages/ui/src/theme-toggle.tsx"),
  read("../src/app/(public)/demo-lab/page.tsx"),
  read("../src/app/(public)/demo-lab/demo-lab-hub-theme.tsx"),
  read("../../../apps/dashboard/src/app/layout.tsx"),
  read("../../../packages/ui/src/global-ops-map.tsx"),
  read("../../../apps/dashboard/src/components/realtime-maplibre-map.tsx"),
  read("../src/app/manifest.ts"),
  read("../../../apps/dashboard/src/app/manifest.ts"),
  read("../src/app/api/theme/route.ts"),
]);

test("light mode is the platform default while an explicit dark preference is preserved", () => {
  assert.match(webLayout, /hasCurrentThemePreference && themeCookie === "dark" \? "dark" : "light"/);
  assert.match(homePage, /hasCurrentThemePreference && cookieStore\.get\("theme"\)\?\.value === "dark" \? "dark" : "light"/);
  assert.match(dashboardLayout, /hasCurrentThemePreference && themeCookie === "dark" \? "dark" : "light"/);
  assert.match(themeToggle, /ThemeToggle\(\{ initialTheme = "light", locale = "en" \}/);
  assert.match(themeToggle, /THEME_PREFERENCE_VERSION = "light-default-v1"/);
  assert.match(themeToggle, /return "light"/);
  assert.match(themeToggle, /meta\.content = theme === "dark" \? "#020617" : "#fcfdfb"/);
  assert.match(demoPage, /hasCurrentThemePreference && cookieTheme === "dark"[\s\S]*\? "dark"[\s\S]*: "light"/);
  assert.match(demoToggle, /DemoLabThemeToggle\(\{ initialTheme = "light"/);
  assert.match(demoToggle, /THEME_PREFERENCE_VERSION = "light-default-v1"/);
  assert.match(globalOpsMap, /typeof document === "undefined"\) return "light"/);
  assert.match(realtimeMap, /typeof document === "undefined"\) return "light"/);
  assert.match(webManifest, /background_color: "#fcfdfb"/);
  assert.match(webManifest, /theme_color: "#fcfdfb"/);
  assert.match(dashboardManifest, /background_color: "#fcfdfb"/);
  assert.match(dashboardManifest, /theme_color: "#fcfdfb"/);
  assert.match(themeRoute, /cookies\.set\("nexid-theme-preference-version", "light-default-v1"/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const menuSource = await readFile(new URL("../src/components/tenant-account-menu.tsx", import.meta.url), "utf8");
const secureLogoutSource = await readFile(new URL("../src/components/secure-dashboard-logout-button.tsx", import.meta.url), "utf8");
const globalsSource = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
const layoutSource = await readFile(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
const pwaSetupSource = await readFile(new URL("../src/components/pwa-setup.tsx", import.meta.url), "utf8");
const serviceWorkerSource = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");

test("tenant account menu uses a native top-layer dialog above CRM/map layers", () => {
  assert.match(menuSource, /const ACCOUNT_MENU_PORTAL_ROOT_ID = "nexid-account-menu-root"/);
  assert.match(menuSource, /const ACCOUNT_MENU_Z_INDEX = 2147483647/);
  assert.match(menuSource, /const ACCOUNT_MENU_VERSION = "drawer-v22-isolated-trigger"/);
  assert.match(menuSource, /function showAccountMenuDialog\(dialog\?: HTMLDialogElement \| null\)/);
  assert.match(menuSource, /dialog\.matches\(":modal"\)/);
  assert.match(menuSource, /dialog\.setAttribute\("data-account-menu-modal-state", "native-modal"\)/);
  assert.match(menuSource, /window\.setInterval\(reinforceModalLayer,\s*350\)/);
  assert.match(menuSource, /import \{ createPortal, flushSync \} from "react-dom"/);
  assert.match(menuSource, /function getAccountMenuPortalRoot\(\)/);
  assert.match(menuSource, /function promoteAccountMenuPortalRoot\(root: HTMLElement\)/);
  assert.match(menuSource, /document\.body\.appendChild\(root\)/);
  assert.match(menuSource, /root !== document\.body\.lastElementChild/);
  assert.match(menuSource, /root\.style\.setProperty\("z-index", String\(ACCOUNT_MENU_Z_INDEX\), "important"\)/);
  assert.match(menuSource, /root\.style\.setProperty\("pointer-events", "none", "important"\)/);
  assert.match(menuSource, /root\.style\.setProperty\("width", "100vw", "important"\)/);
  assert.match(menuSource, /root\.style\.setProperty\("height", "100dvh", "important"\)/);
  assert.match(menuSource, /const ACCOUNT_OVERLAY_STYLE: CSSProperties = \{/);
  assert.match(menuSource, /const ACCOUNT_BACKDROP_STYLE: CSSProperties = \{/);
  assert.match(menuSource, /className="nexid-account-dialog nexid-account-overlay"/);
  assert.match(menuSource, /<dialog[\s\S]*ref=\{dialogRef\}/);
  assert.match(menuSource, /style=\{ACCOUNT_BACKDROP_STYLE\}/);
  assert.match(menuSource, /<div[\s\S]*data-account-menu-backdrop="true"[\s\S]*data-testid="tenant-account-menu-backdrop"/);
  assert.doesNotMatch(menuSource, /<button[\s\S]{0,240}data-testid="tenant-account-menu-backdrop"/);
  assert.match(menuSource, /dialog\.showModal\(\)/);
  assert.match(menuSource, /dialog\.close\(\)/);
  assert.match(menuSource, /dialog\.style\.setProperty\("z-index", String\(ACCOUNT_MENU_Z_INDEX\), "important"\)/);
  assert.match(menuSource, /dialog\.style\.setProperty\(\s*"background",/);
  assert.match(menuSource, /data-account-menu-dialog="native-top-layer"/);
  assert.match(menuSource, /data-testid="tenant-account-menu-dialog"/);
  assert.match(menuSource, /<dialog[\s\S]*aria-labelledby="tenant-account-menu-title"/);
  assert.match(menuSource, /id="tenant-account-menu-title"/);
  assert.doesNotMatch(menuSource, /ref=\{layerRef\}[\s\S]{0,220}aria-modal="true"/);
  assert.match(menuSource, /data-account-menu-top-layer="native-dialog"/);
  assert.match(menuSource, /createPortal\(menuPanel,\s*activePortalRoot\)/);
  assert.doesNotMatch(menuSource, /drawer-v17-fixed-portal-overlay/);
});

test("account drawer keeps one mobile scroll region, a visible logout and deterministic focus", () => {
  assert.match(menuSource, /data-testid="tenant-account-menu-scroll"/);
  assert.match(menuSource, /tenant-account-panel__scroll min-h-0 flex-1 overflow-y-auto overscroll-contain/);
  assert.match(menuSource, /tenant-account-panel__footer/);
  assert.match(menuSource, /className="grid h-11 w-11/);
  assert.match(menuSource, /shouldRestoreFocusRef\.current = true/);
  assert.match(menuSource, /window\.setTimeout\(\(\) => triggerRef\.current\?\.focus\(\), 0\)/);
  assert.match(menuSource, /data-account-menu-compact="true"/);
  assert.match(menuSource, /onPointerDownCapture=\{\(event\) => \{[\s\S]*event\.stopPropagation\(\);[\s\S]*prepareMenuPortalRoot\(\)/);
  assert.match(menuSource, /onClick=\{\(event\) => \{[\s\S]*event\.preventDefault\(\);[\s\S]*event\.stopPropagation\(\);[\s\S]*toggleMenu\(\)/);
  assert.doesNotMatch(menuSource, /lastActivationRef/);
  assert.doesNotMatch(menuSource, /onMouseDown=/);
  assert.doesNotMatch(menuSource, /onPointerUp=/);
  assert.match(globalsSource, /\.nexid-account-layer \.tenant-account-panel__scroll\s*\{[^}]*overflow-y:\s*auto !important[^}]*touch-action:\s*pan-y !important/s);
  assert.match(globalsSource, /@media \(max-width:\s*640px\)[\s\S]*\.nexid-account-layer \.tenant-account-role-description\s*\{[^}]*display:\s*none !important/s);
  assert.doesNotMatch(globalsSource, /\.min-w-0\.flex-1\s*\{[^}]*padding-bottom:\s*5\.25rem/s);
  assert.match(globalsSource, /@media \(max-width:\s*1024px\)[\s\S]*\.dashboard-main\s*\{[^}]*padding-bottom:\s*5\.25rem/s);
});

test("tenant account menu suppresses the CRM shell while the account drawer is open", () => {
  assert.match(menuSource, /function setCrmShellSuppression\(value: boolean\)/);
  assert.match(menuSource, /document\.querySelectorAll<HTMLElement>\("\.nexid-crm-shell"\)/);
  assert.match(menuSource, /node\.setAttribute\("data-account-menu-suppressed", "true"\)/);
  assert.match(menuSource, /node\.setAttribute\("aria-hidden", "true"\)/);
  assert.match(menuSource, /node\.style\.setProperty\("z-index", "0", "important"\)/);
  assert.match(menuSource, /node\.style\.setProperty\("opacity", "0", "important"\)/);
  assert.match(menuSource, /node\.style\.setProperty\("visibility", "hidden", "important"\)/);
  assert.match(menuSource, /\.inert = true/);
  assert.match(menuSource, /\.inert = false/);
  assert.match(menuSource, /node\.style\.removeProperty\("visibility"\)/);
  assert.match(menuSource, /setCrmShellSuppression\(true\)/);
  assert.match(menuSource, /setCrmShellSuppression\(value\)/);
});

test("global CSS keeps the account overlay visually above the dashboard", () => {
  assert.match(globalsSource, /html\.nexid-account-menu-open,\s*body\.nexid-account-menu-open\s*\{[\s\S]*overflow:\s*hidden/);
  assert.match(globalsSource, /#nexid-account-menu-root\s*\{[\s\S]*z-index:\s*2147483647 !important/);
  assert.match(globalsSource, /#nexid-account-menu-root\[data-account-menu-active="true"\]/);
  assert.match(globalsSource, /\.nexid-account-dialog,\s*\.nexid-account-overlay\s*\{[\s\S]*max-width:\s*none !important/);
  assert.match(globalsSource, /\.nexid-account-dialog::backdrop\s*\{[\s\S]*backdrop-filter:\s*blur\(2px\) saturate\(0\.72\) !important/);
  assert.match(globalsSource, /\.nexid-account-scrim,\s*\.nexid-account-backdrop\s*\{[\s\S]*z-index:\s*2147483646 !important/);
  assert.match(globalsSource, /\.nexid-account-scrim,\s*\.nexid-account-backdrop\s*\{[\s\S]*backdrop-filter:\s*blur\(8px\) saturate\(0\.66\) !important/);
  assert.match(globalsSource, /\.nexid-account-scrim,\s*\.nexid-account-backdrop\s*\{[\s\S]*rgba\(2, 6, 23, 0\.96\)/);
  assert.match(globalsSource, /\.nexid-account-overlay\s*\{[\s\S]*position:\s*fixed !important/);
  assert.match(globalsSource, /\.nexid-account-overlay\s*\{[\s\S]*rgba\(2, 6, 23, 0\.98\) !important/);
  assert.match(globalsSource, /\.nexid-account-layer\s*\{[\s\S]*z-index:\s*2147483647 !important/);
  assert.match(globalsSource, /\.nexid-account-scrim,\s*\.nexid-account-backdrop\s*\{[\s\S]*z-index:\s*2147483646 !important/);
  assert.match(globalsSource, /html\.nexid-account-menu-open \.nexid-crm-shell,\s*body\.nexid-account-menu-open \.nexid-crm-shell,\s*\.nexid-crm-shell\[data-account-menu-suppressed="true"\]\s*\{[\s\S]*visibility:\s*hidden !important/);
  assert.match(globalsSource, /html\.nexid-account-menu-open \.nexid-crm-shell,\s*body\.nexid-account-menu-open \.nexid-crm-shell,\s*\.nexid-crm-shell\[data-account-menu-suppressed="true"\]\s*\{[\s\S]*opacity:\s*0 !important/);
  assert.match(globalsSource, /html\.nexid-account-menu-open \.nexid-crm-shell \[id="live-tap-map"\]/);
  assert.match(globalsSource, /\.nexid-account-dialog:not\(\[open\]\)\s*\{[\s\S]*display:\s*none !important/);
  assert.match(globalsSource, /\.nexid-crm-shell \.nexid-crm-account-menu\s*\{[^}]*isolation:\s*isolate;[^}]*pointer-events:\s*auto !important/s);
  assert.match(globalsSource, /\.nexid-crm-shell \.nexid-crm-account-menu \[data-testid="tenant-account-menu-trigger"\]\s*\{[^}]*touch-action:\s*manipulation/s);
});

test("account drawer exposes expected SaaS account actions and secure logout", () => {
  assert.match(menuSource, /Configuraci.n del workspace/);
  assert.match(menuSource, /Perfil \$\{tenantName\}/);
  assert.match(menuSource, /Usuarios y permisos/);
  assert.match(menuSource, /Seguridad de cuenta/);
  assert.match(menuSource, /API keys y webhooks/);
  assert.match(menuSource, /Plan y facturaci.n/);
  assert.match(menuSource, /Playbook comercial/);
  assert.match(menuSource, /Soporte enterprise/);
  assert.match(menuSource, /<SecureDashboardLogoutButton/);
  assert.match(menuSource, /testId="tenant-account-logout"/);
  assert.match(secureLogoutSource, /await fetch\("\/logout", \{ method: "POST", cache: "no-store" \}\)/);
  assert.match(secureLogoutSource, /const LOGOUT_REDIRECT = "\/login\?logged_out=1"/);
  assert.match(secureLogoutSource, /signOut\(\{ redirectUrl: LOGOUT_REDIRECT \}\)/);
});

test("dashboard clears stale PWA runtime before old admin CSS can mask fixes", () => {
  assert.match(layoutSource, /const staleDashboardRuntimeCleanupScript = `/);
  assert.match(layoutSource, /nexid-dashboard-runtime-cleared-v7/);
  assert.match(layoutSource, /cacheKeys\.filter\(\(key\) => key\.startsWith\(dashboardCachePrefix\)\)/);
  assert.match(layoutSource, /registrations\.map\(\(registration\) => registration\.unregister\(\)/);
  assert.match(layoutSource, /dashboardCacheKeys\.map\(\(key\) => caches\.delete\(key\)/);
  assert.match(layoutSource, /process\.env\.NEXT_PUBLIC_ENABLE_PWA !== "true"/);
  assert.match(layoutSource, /data-nexid-runtime-cleanup="v7"/);
  assert.match(pwaSetupSource, /process\.env\.NODE_ENV === "production" && process\.env\.NEXT_PUBLIC_ENABLE_PWA === "true"/);
  assert.match(pwaSetupSource, /navigator\.serviceWorker\.getRegistrations\(\)/);
  assert.match(pwaSetupSource, /registration\.unregister\(\)/);
  assert.match(pwaSetupSource, /DASHBOARD_CACHE_PREFIX = "nexid-dash-"/);
  assert.match(pwaSetupSource, /caches\.delete\(key\)/);
  assert.match(pwaSetupSource, /DASHBOARD_RUNTIME_VERSION = "v7"/);
  assert.match(pwaSetupSource, /window\.location\.reload\(\)/);
  assert.match(pwaSetupSource, /updateViaCache: "none"/);
  assert.match(pwaSetupSource, /registration\.update\(\)/);
  assert.match(pwaSetupSource, /NEXID_DASHBOARD_RUNTIME_UPDATED/);
  assert.doesNotMatch(pwaSetupSource, /NEXT_PUBLIC_ENABLE_PWA !== "false"/);
});

test("dashboard service worker refreshes shell styles before falling back to cache", () => {
  assert.match(serviceWorkerSource, /const CACHE_NAME = "nexid-dash-v7"/);
  assert.match(serviceWorkerSource, /self\.clients\.matchAll\(\{ type: "window", includeUncontrolled: true \}\)/);
  assert.match(serviceWorkerSource, /client\.postMessage\(\{ type: "NEXID_DASHBOARD_RUNTIME_UPDATED", version: CACHE_NAME \}\)/);
  assert.match(serviceWorkerSource, /request\.destination === "script" \|\| request\.destination === "style"/);
  assert.match(serviceWorkerSource, /fetchWithTimeout\(request\)\.then\(\(response\) => \{/);
  assert.match(serviceWorkerSource, /cache\.put\(request,\s*copy\)/);
  assert.match(serviceWorkerSource, /\.catch\(\(\) => caches\.match\(request\)\)/);
  assert.doesNotMatch(serviceWorkerSource, /request\.destination === "image" \|\| request\.destination === "style" \|\| request\.destination === "font"/);
});

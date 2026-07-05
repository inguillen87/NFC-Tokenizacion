import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const menuSource = await readFile(new URL("../src/components/tenant-account-menu.tsx", import.meta.url), "utf8");
const globalsSource = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("tenant account menu renders as a top-level drawer above CRM layers", () => {
  assert.match(menuSource, /createPortal\(menuPanel,\s*document\.body\)/);
  assert.match(menuSource, /const ACCOUNT_MENU_Z_INDEX = 2147483600/);
  assert.match(menuSource, /data-account-menu-portal="body"/);
  assert.match(menuSource, /document\.documentElement\.classList\.add\("nexid-account-menu-open"\)/);
  assert.match(menuSource, /document\.documentElement\.classList\.remove\("nexid-account-menu-open"\)/);
  assert.match(menuSource, /data-testid="tenant-account-menu-close"/);
  assert.match(menuSource, /aria-label="Cerrar panel de cuenta"/);
  assert.match(menuSource, /aria-haspopup="dialog"/);
  assert.match(menuSource, /role="dialog"/);
  assert.match(menuSource, /aria-modal="true"/);
  assert.match(menuSource, /aria-label="Cuenta operativa nexID"/);
  assert.doesNotMatch(menuSource, /bg-slate-950\/80/);
  assert.match(menuSource, /backgroundColor:\s*"rgba\(2, 6, 23, 0\.8\)"/);
  assert.match(menuSource, /backdrop-blur-lg/);
  assert.match(menuSource, /tenant-account-panel__header/);
  assert.match(menuSource, /top:\s*12/);
  assert.match(menuSource, /right:\s*12/);
  assert.match(menuSource, /bottom:\s*12/);
  assert.match(menuSource, /left:\s*"auto"/);
  assert.match(menuSource, /width:\s*"min\(calc\(100vw - 24px\), 30rem\)"/);
  assert.match(menuSource, /maxHeight:\s*"calc\(100dvh - 24px\)"/);
  assert.match(menuSource, /left:\s*isCompact \? 0 : "auto"/);
  assert.match(menuSource, /width:\s*isCompact \? "100vw"/);
  assert.match(menuSource, /maxHeight:\s*isCompact \? "100dvh"/);
  assert.match(menuSource, /className="tenant-account-panel isolate flex flex-col overflow-hidden/);
  assert.match(menuSource, /className="min-h-0 flex-1 overflow-y-auto p-3"/);
});

test("global CSS prevents dashboard maps from covering account drawer", () => {
  assert.match(globalsSource, /html\.nexid-account-menu-open,\s*body\.nexid-account-menu-open\s*\{[\s\S]*overflow:\s*hidden/);
  assert.match(globalsSource, /\.nexid-account-layer\s*\{[\s\S]*z-index:\s*2147483600 !important/);
  assert.match(globalsSource, /\.nexid-account-layer \.tenant-account-panel\s*\{[\s\S]*display:\s*flex !important/);
  assert.match(globalsSource, /\.nexid-account-layer \.tenant-account-panel\s*\{[\s\S]*z-index:\s*2147483602 !important/);
  assert.match(globalsSource, /html\.theme-light \.nexid-account-layer \.tenant-account-panel__header/);
  assert.match(globalsSource, /\.nexid-account-layer \.tenant-account-panel__header,[\s\S]*\{[\s\S]*color:\s*#f8fafc !important/);
  assert.match(globalsSource, /html\.theme-light \.nexid-account-layer \.tenant-account-panel__header \.text-white/);
  assert.match(globalsSource, /\.tenant-account-panel__header \.text-white,[\s\S]*\{[\s\S]*color:\s*#f8fafc !important/);
  assert.match(globalsSource, /html\.theme-light \.nexid-account-layer \.tenant-account-panel__header \.text-slate-400/);
  assert.match(globalsSource, /body\.nexid-account-menu-open \.nexid-crm-shell\s*\{[\s\S]*z-index:\s*0 !important/);
  assert.match(globalsSource, /body\.nexid-account-menu-open \.nexid-crm-shell\s*\{[\s\S]*pointer-events:\s*none !important/);
  assert.match(globalsSource, /body\.nexid-account-menu-open \.nexid-crm-shell \*\s*\{[\s\S]*pointer-events:\s*none !important/);
  assert.match(globalsSource, /html\.nexid-account-menu-open \.nexid-crm-shell \[id="live-tap-map"\]/);
  assert.match(globalsSource, /html\.nexid-account-menu-open \.nexid-crm-shell \.maplibregl-control-container/);
  assert.match(globalsSource, /body\.nexid-account-menu-open \.nexid-account-layer \*/);
  assert.match(globalsSource, /@media \(max-width:\s*640px\)\s*\{[\s\S]*\.nexid-account-layer \.tenant-account-panel\s*\{[\s\S]*inset:\s*0 !important/);
  assert.match(globalsSource, /@media \(max-width:\s*640px\)\s*\{[\s\S]*\.nexid-account-layer \.tenant-account-panel\s*\{[\s\S]*width:\s*100vw !important/);
  assert.match(globalsSource, /@media \(max-width:\s*640px\)\s*\{[\s\S]*\.nexid-account-layer \.tenant-account-panel\s*\{[\s\S]*max-height:\s*100dvh !important/);
});

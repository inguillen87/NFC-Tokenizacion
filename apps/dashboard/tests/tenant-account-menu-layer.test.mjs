import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const menuSource = await readFile(new URL("../src/components/tenant-account-menu.tsx", import.meta.url), "utf8");
const globalsSource = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("tenant account menu renders as a top-level drawer above CRM layers", () => {
  assert.match(menuSource, /createPortal\(menuPanel,\s*document\.body\)/);
  assert.match(menuSource, /const ACCOUNT_MENU_Z_INDEX = 2147483000/);
  assert.match(menuSource, /top:\s*12/);
  assert.match(menuSource, /right:\s*12/);
  assert.match(menuSource, /bottom:\s*12/);
  assert.match(menuSource, /width:\s*"min\(calc\(100vw - 24px\), 30rem\)"/);
  assert.match(menuSource, /maxHeight:\s*"calc\(100dvh - 24px\)"/);
  assert.match(menuSource, /width:\s*isCompact \? "100vw"/);
  assert.match(menuSource, /maxHeight:\s*isCompact \? "100dvh"/);
  assert.match(menuSource, /className="tenant-account-panel isolate flex flex-col overflow-hidden/);
  assert.match(menuSource, /className="min-h-0 flex-1 overflow-y-auto p-3"/);
});

test("global CSS prevents dashboard maps from covering account drawer", () => {
  assert.match(globalsSource, /\.nexid-account-layer\s*\{[\s\S]*z-index:\s*2147483000 !important/);
  assert.match(globalsSource, /\.nexid-account-layer \.tenant-account-panel\s*\{[\s\S]*display:\s*flex !important/);
  assert.match(globalsSource, /body\.nexid-account-menu-open \.nexid-crm-shell\s*\{[\s\S]*z-index:\s*0 !important/);
  assert.match(globalsSource, /@media \(max-width:\s*640px\)\s*\{[\s\S]*\.nexid-account-layer \.tenant-account-panel\s*\{[\s\S]*inset:\s*0 !important/);
  assert.match(globalsSource, /@media \(max-width:\s*640px\)\s*\{[\s\S]*\.nexid-account-layer \.tenant-account-panel\s*\{[\s\S]*width:\s*100vw !important/);
  assert.match(globalsSource, /@media \(max-width:\s*640px\)\s*\{[\s\S]*\.nexid-account-layer \.tenant-account-panel\s*\{[\s\S]*max-height:\s*100dvh !important/);
});

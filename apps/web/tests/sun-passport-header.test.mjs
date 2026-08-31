import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const headerUrl = new URL("../src/app/sun/sun-passport-header.tsx", import.meta.url);
const pageUrl = new URL("../src/app/sun/page.tsx", import.meta.url);

test("SUN passport header separates identity, status and controls into bounded rows", async () => {
  const source = await readFile(headerUrl, "utf8");

  assert.match(source, /sun-passport-header sun-topbar grid grid-cols-\[minmax\(0,1fr\)_auto\]/);
  assert.match(source, /sun-passport-brand min-w-0 overflow-hidden/);
  assert.match(source, /sun-live-tap-pill[^"]*min-w-0[^"]*max-w-full/);
  assert.match(source, /sun-topbar-actions col-span-2[^"]*min-w-0/);
  assert.match(source, /\[&_\.locale-switcher\]:w-full/);
  assert.match(source, /\[&_\.locale-switcher_select\]:min-w-0/);
  assert.doesNotMatch(source, /<header[^>]*flex items-center justify-between/);
});

test("SUN header CSS keeps locale and theme on one touch-safe utility row", async () => {
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");

  assert.match(css, /@media \(max-width: 430px\)[\s\S]*?\.sun-topbar-actions \{[\s\S]*?display: flex;[\s\S]*?align-items: center;/);
  assert.match(css, /\.sun-passport-header \.locale-switcher select \{[\s\S]*?min-width: 0;[\s\S]*?text-overflow: ellipsis;/);
  assert.match(css, /@media \(max-width: 359px\)[\s\S]*?\.sun-passport-header \.theme-toggle \{[\s\S]*?width: 2\.75rem;/);
  assert.match(css, /\.sun-passport-header \.theme-toggle span:not\(\.theme-toggle__glyph\) \{[\s\S]*?display: none;/);
});

test("SUN passport header keeps its descriptor below the lockup and exposes controls", async () => {
  const [header, page] = await Promise.all([
    readFile(headerUrl, "utf8"),
    readFile(pageUrl, "utf8"),
  ]);

  assert.match(header, /const passportLabel = isQrScan \? "Pasaporte QR" : "Pasaporte NFC"/);
  assert.match(header, /sun-passport-brand__caption mt-1 block truncate whitespace-nowrap/);
  assert.match(header, /aria-label="Controles del pasaporte"/);
  assert.match(header, /role="status"/);
  assert.match(header, /<LocaleSwitcher value=\{locale\} options=\{\[\.\.\.locales\]\} \/>/);
  assert.match(header, /<ThemeToggle \/>/);
  assert.match(page, /<SunPassportHeader[\s\S]*?pulseClass=\{pulseClass\}[\s\S]*?\/>/);
});

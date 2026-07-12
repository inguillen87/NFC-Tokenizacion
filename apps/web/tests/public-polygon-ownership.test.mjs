import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function themeVariables(css, theme) {
  const block = css.match(new RegExp(`:global\\(html\\[data-theme="${theme}"\\]\\) \\.page \\{([\\s\\S]*?)\\n\\}`));
  assert.ok(block, `missing explicit ${theme} theme block`);
  return Object.fromEntries(
    [...block[1].matchAll(/(--[a-z-]+):\s*(#[0-9a-f]{6});/gi)].map((match) => [match[1], match[2]]),
  );
}

function contrastRatio(foreground, background) {
  const luminance = (hex) => {
    const channels = hex.slice(1).match(/.{2}/g).map((channel) => Number.parseInt(channel, 16) / 255);
    const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

test("public Polygon certificate explains proof boundaries and preserves exits", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../src/app/proof/ownership/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/proof/ownership/ownership.module.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /\/public\/polygon\/ownership/);
  assert.match(page, /PUBLIC_PROOF_FETCH_TIMEOUT_MS = 6_000/);
  assert.match(page, /signal: AbortSignal\.timeout\(PUBLIC_PROOF_FETCH_TIMEOUT_MS\)/);
  assert.match(page, /Emision testnet confirmada/);
  assert.match(page, /custodia de plataforma/);
  assert.match(page, /buyer ownership exige firma de wallet/i);
  assert.match(page, /Aporta el contexto del producto/);
  assert.match(page, /Comprobaciones del certificado/);
  assert.match(page, /Metadata/);
  assert.match(page, /Privado dentro de nexID/);
  assert.match(page, /\/demo-lab\?scenario=polygon-ownership/);
  assert.match(page, /\/proof\/verify\?layer=iota#iota-proof/);
  assert.match(page, /ThemeToggle/);
  assert.match(page, /import styles from "\.\/ownership\.module\.css"/);
  assert.match(page, /<main className=\{styles\.page\}>/);
  assert.match(page, /styles\.headerInner/);
  assert.match(page, /styles\.themeControl/);
  assert.match(css, /:global\(html\[data-theme="light"\]\) \.page/);
  assert.match(css, /:global\(html\[data-theme="dark"\]\) \.page/);
});

test("ownership theme follows nexID data-theme with readable desktop and 390px navigation", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../src/app/proof/ownership/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/proof/ownership/ownership.module.css", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(css, /prefers-color-scheme/);
  assert.match(css, /\.headerInner\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) auto minmax\(0, 1fr\)/);
  assert.match(css, /@media \(max-width: 480px\)\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(7\.25rem, auto\) minmax\(0, 1fr\)/);
  assert.match(css, /@media \(max-width: 480px\)[\s\S]*\.themeControl :global\(\.theme-toggle\)[\s\S]*width:\s*2\.75rem/);
  assert.match(css, /\.themeControl :global\(\.theme-toggle\)[\s\S]*color:\s*var\(--ownership-text\)/);
  assert.match(css, /\.page \[class~="text-slate-600"\][\s\S]*color:\s*var\(--ownership-text-secondary\)/);
  assert.match(css, /\.page \[class~="bg-slate-50"\][\s\S]*background-color:\s*var\(--ownership-soft-bg\)/);
  assert.match(page, /styles\.backLink/);
  assert.match(page, /aria-label="Volver a Demo Lab"/);
  assert.match(page, /styles\.backLabel/);
  assert.match(page, /styles\.brandTitle/);
  assert.match(css, /@media \(max-width: 360px\)[\s\S]*grid-template-columns:\s*2\.75rem minmax\(0, 1fr\) 2\.75rem/);
  assert.match(css, /@media \(max-width: 360px\)[\s\S]*\.backLabel\s*\{[\s\S]*display:\s*none/);

  const mobileSideTrack = (390 - 24 - 12 - (7.25 * 16)) / 2;
  assert.ok(mobileSideTrack >= 88, `390px header side tracks are too narrow: ${mobileSideTrack}px`);
  const narrowCenterTrack = 287 - 24 - 12 - (2.75 * 16 * 2);
  assert.ok(narrowCenterTrack >= 160, `287px header center track is too narrow: ${narrowCenterTrack}px`);

  const light = themeVariables(css, "light");
  const dark = themeVariables(css, "dark");
  assert.notEqual(light["--ownership-page-bg"], dark["--ownership-page-bg"]);

  for (const [theme, variables] of [["light", light], ["dark", dark]]) {
    const pairs = [
      ["page text", "--ownership-text", "--ownership-page-bg"],
      ["header navigation", "--ownership-text-secondary", "--ownership-header-bg"],
      ["header eyebrow", "--ownership-violet", "--ownership-header-bg"],
    ];
    for (const [label, foreground, background] of pairs) {
      const ratio = contrastRatio(variables[foreground], variables[background]);
      assert.ok(ratio >= 4.5, `${theme} ${label} contrast ${ratio.toFixed(2)} is below WCAG AA`);
    }
  }
});

test("event certificate does not present invalid events as authentic", async () => {
  const page = await readFile(new URL("../src/app/certificado/[eventId]/page.tsx", import.meta.url), "utf8");

  assert.match(page, /verification\?\.authentic/);
  assert.match(page, /no confirma autenticidad/);
  assert.match(page, /Ownership.*Bloqueado/s);
  assert.doesNotMatch(page, /confirma autenticidad y origen/);
});

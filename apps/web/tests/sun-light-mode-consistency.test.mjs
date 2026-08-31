import assert from "node:assert/strict";
import test from "node:test";
import { readdir, readFile } from "node:fs/promises";

const sunDirectory = new URL("../src/app/sun/", import.meta.url);
const [fileNames, css, mapCss, consumerStatus] = await Promise.all([
  readdir(sunDirectory),
  readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
  readFile(new URL("../src/app/sun/sun-passport-map.module.css", import.meta.url), "utf8"),
  readFile(new URL("../src/app/sun/sun-consumer-status.ts", import.meta.url), "utf8"),
]);

const sunSource = (
  await Promise.all(
    fileNames
      .filter((fileName) => fileName.endsWith(".tsx"))
      .map((fileName) => readFile(new URL(fileName, sunDirectory), "utf8")),
  )
).join("\n");

const lightContractStart = css.indexOf("/* SUN is white-first in the saved light preference.");
const lightContractEnd = css.indexOf("/* Demo Lab keeps one sticky navigation", lightContractStart);
assert.notEqual(lightContractStart, -1, "SUN light-mode contract should exist");
assert.notEqual(lightContractEnd, -1, "SUN light-mode contract should have a bounded end");
const lightContract = css.slice(lightContractStart, lightContractEnd);

const darkUtilityInventory = [
  ["bg-slate-950", '[class*="bg-slate-950"]'],
  ["bg-slate-900", '[class*="bg-slate-900"]'],
  ["bg-slate-800", '[class*="bg-slate-800"]'],
  ["bg-black", '[class*="bg-black"]'],
  ["from-slate-950", '[class*="from-slate-950"]'],
  ["from-slate-900", '[class*="from-slate-900"]'],
  ["via-slate-950", '[class*="via-slate-950"]'],
  ["to-slate-950", '[class*="to-slate-950"]'],
  ["to-slate-900", '[class*="to-slate-900"]'],
  ["from-emerald-950", '[class*="from-emerald-950"]'],
  ["to-cyan-950", '[class*="to-cyan-950"]'],
  ["bg-[#0a1020]", '[class*="bg-[#0a1020]"]'],
  ["bg-[linear-gradient", '[class*="bg-[linear-gradient"]'],
  ["bg-[radial-gradient", '[class*="bg-[radial-gradient"]'],
];

test("SUN light mode owns the whole passport and remains scoped away from the landing", () => {
  assert.match(lightContract, /html\.theme-light \.sun-tap-experience,/);
  assert.match(lightContract, /html\[data-theme="light"\] \.sun-tap-experience/);
  assert.match(lightContract, /linear-gradient\(180deg, #f8fcff 0%, #eef7ff 52%, #f8fbff 100%\)/);
  assert.doesNotMatch(lightContract, /landing-root|landing-hero|demo-lab-fullscreen-root/);
});

test("every dark utility family still used by SUN has an explicit light-surface override", () => {
  for (const [sourceToken, cssSelector] of darkUtilityInventory) {
    if (!sunSource.includes(sourceToken)) continue;

    const themeClassSelector = `html.theme-light .sun-tap-experience ${cssSelector}`;
    const dataThemeSelector = `html[data-theme="light"] .sun-tap-experience ${cssSelector}`;
    assert.ok(lightContract.includes(themeClassSelector), `${sourceToken} needs a theme-light SUN override`);
    assert.ok(lightContract.includes(dataThemeSelector), `${sourceToken} needs a data-theme SUN override`);
  }

  assert.match(lightContract, /background-color: rgba\(255, 255, 255, 0\.94\) !important;/);
  assert.match(lightContract, /background-image: none !important;/);
});

test("VALID_CLOSED and VALID_OPENED keep distinct, non-dark light surfaces", () => {
  assert.match(consumerStatus, /if \(input\.isVerifiedClosedState\)[\s\S]*?tone: "closed"/);
  assert.match(consumerStatus, /if \(input\.isVerifiedOpenedState\)[\s\S]*?tone: "opened"/);
  assert.match(lightContract, /sun-summary-status\[class\*="bg-emerald-"\][\s\S]*?background: rgba\(236, 253, 245, 0\.96\) !important;/);
  assert.match(lightContract, /sun-summary-status\[class\*="bg-amber-"\][\s\S]*?background: rgba\(255, 251, 235, 0\.97\) !important;/);
  assert.match(lightContract, /sun-summary-status\[class\*="bg-rose-"\][\s\S]*?background: rgba\(255, 241, 242, 0\.97\) !important;/);
});

test("SUN light product media and map chrome use readable light containers", () => {
  const productVisualMatch = lightContract.match(
    /html\.theme-light \.sun-tap-experience \.sun-summary-product__visual,[\s\S]*?\{([\s\S]*?)\}/,
  );

  assert.ok(productVisualMatch, "SUN summary product light surface should exist");
  assert.match(productVisualMatch[1], /linear-gradient\(145deg, #ffffff, #eaf8fc\)/);
  assert.doesNotMatch(productVisualMatch[1], /#07111f|#020617|rgba\(2, 6, 23/);

  assert.match(mapCss, /:global\(html\[data-theme="light"\]\) \.shell,[\s\S]*?background: rgba\(255, 255, 255, 0\.94\)/);
  assert.match(mapCss, /:global\(html\[data-theme="light"\]\) \.locationIndex,[\s\S]*?color: #0f766e;/);
  assert.match(mapCss, /:global\(html\[data-theme="light"\]\) \.locationIndexTap,[\s\S]*?color: #1d4ed8;/);
});

test("SUN services and engagement use explicit white-first semantic surfaces", () => {
  assert.match(sunSource, /sun-services-card/);
  assert.match(sunSource, /sun-services-action/);
  assert.match(sunSource, /sun-engagement-suite/);
  assert.match(sunSource, /sun-engagement-tabs/);
  assert.match(lightContract, /\.sun-services-card,[\s\S]*?background: rgba\(255, 255, 255, 0\.97\) !important;/);
  assert.match(lightContract, /\.sun-engagement-suite,[\s\S]*?background: rgba\(255, 255, 255, 0\.97\) !important;/);
  assert.match(lightContract, /\.sun-services-action,[\s\S]*?background: rgba\(248, 250, 252, 0\.98\) !important;/);
  assert.match(lightContract, /\.sun-engagement-tabs,[\s\S]*?background: rgba\(241, 245, 249, 0\.96\) !important;/);
});

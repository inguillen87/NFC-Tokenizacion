import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  formatAnalyticsPercentage,
  resolveMobileSharePercent,
} = await import("../src/lib/analytics-percentage.ts");

const analyticsPanels = await readFile(
  new URL("../src/components/analytics-panels.tsx", import.meta.url),
  "utf8",
);

test("mobile share is derived once from 465 of 512 device buckets", () => {
  const share = resolveMobileSharePercent([
    { label: "mobile", count: 465 },
    { label: "desktop", count: 32 },
    { label: "tablet", count: 15 },
  ], 90.8);

  assert.equal(share, (465 / 512) * 100);
  assert.equal(formatAnalyticsPercentage(share), "90.8%");
});

test("mobile share fallback accepts legacy ratio and percentage-point payloads", () => {
  assert.equal(formatAnalyticsPercentage(resolveMobileSharePercent([], 0.908)), "90.8%");
  assert.equal(formatAnalyticsPercentage(resolveMobileSharePercent([], 90.8)), "90.8%");
  assert.equal(formatAnalyticsPercentage(resolveMobileSharePercent([], Number.NaN)), "0.0%");
});

test("analytics panel does not multiply reported mobile share a second time", () => {
  assert.match(analyticsPanels, /resolveMobileSharePercent\(devices\?\.deviceType \|\| \[\], devices\?\.mobileShare\)/);
  assert.match(analyticsPanels, /formatAnalyticsPercentage\(mobileSharePercent\)/);
  assert.doesNotMatch(analyticsPanels, /mobileShare[^\n]*\*\s*100/);
});

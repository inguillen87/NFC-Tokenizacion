import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [crm, globals] = await Promise.all([
  readFile(new URL("../src/components/executive-realtime-crm.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
]);

test("desktop-height constraints scroll each CRM column instead of clipping the map and insights", () => {
  assert.match(crm, /nexid-crm-kpi-column[\s\S]*?lg:overflow-y-auto[\s\S]*?lg:overscroll-contain/);
  assert.match(crm, /nexid-crm-workspace[\s\S]*?lg:overflow-y-auto[\s\S]*?lg:overscroll-contain/);
  assert.match(crm, /nexid-crm-map-stack flex min-h-0 shrink-0 flex-col/);
  assert.match(crm, /nexid-crm-insight-grid grid min-h-0 shrink-0/);
  assert.match(globals, /\.nexid-crm-kpi-column,[\s\S]*?\.nexid-crm-workspace[\s\S]*?scrollbar-gutter: stable/);
});

test("the map owns a stable canvas height and cannot collapse inside a flex remainder", () => {
  assert.match(crm, /nexid-crm-map-panel relative shrink-0/);
  assert.match(crm, /nexid-crm-map-canvas-region[\s\S]*?h-\[460px\][\s\S]*?sm:h-\[520px\][\s\S]*?2xl:h-\[560px\]/);
  assert.doesNotMatch(crm, /nexid-crm-map-canvas-region[^\n]*lg:h-full/);
  assert.doesNotMatch(crm, /rounded-2xl sm:min-h-\[560px\] lg:min-h-0/);
});

test("events and decision panels stay stacked until an actually wide workspace is available", () => {
  const insightGridLine = crm.split(/\r?\n/).find((line) => line.includes("nexid-crm-insight-grid")) || "";
  assert.match(crm, /nexid-crm-events-rail[\s\S]*?2xl:absolute[\s\S]*?2xl:w-\[282px\]/);
  assert.match(crm, /nexid-crm-map-canvas-region[\s\S]*?2xl:pr-\[300px\]/);
  assert.match(crm, /nexid-crm-map-legend[\s\S]*?2xl:bottom-20/);
  assert.match(crm, /nexid-crm-insight-grid[\s\S]*?2xl:grid-cols-\[minmax\(0,1fr\)_380px\]/);
  assert.match(crm, /nexid-crm-alerts-panel rounded-xl/);
  assert.doesNotMatch(insightGridLine, /(?:^|\s)xl:grid-cols/);
});

test("the commercial insight panel remains readable in the white-first theme", () => {
  assert.match(crm, /id="commercial-ai-panel" className="nexid-crm-commercial-panel/);
  assert.match(globals, /:where\(html\.theme-light, html\[data-theme="light"\]\) \.nexid-crm-commercial-panel\s*\{[\s\S]*?linear-gradient\(180deg, rgba\(255, 255, 255, 0\.98\), rgba\(236, 254, 255, 0\.9\)\) !important/);
});

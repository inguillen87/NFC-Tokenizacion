import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [crm, globals, map, activity] = await Promise.all([
  readFile(new URL("../src/components/executive-realtime-crm.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
  readFile(new URL("../src/components/realtime-maplibre-map.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/crm-window-activity-panel.tsx", import.meta.url), "utf8"),
]);

test("desktop-height constraints scroll each CRM column instead of clipping the map and insights", () => {
  assert.match(crm, /nexid-crm-kpi-column[\s\S]*?lg:overflow-y-auto[\s\S]*?lg:overscroll-contain/);
  assert.match(crm, /nexid-crm-workspace[\s\S]*?lg:overflow-y-auto[\s\S]*?lg:overscroll-contain/);
  assert.match(crm, /nexid-crm-map-stack flex min-h-0 shrink-0 flex-col/);
  assert.match(crm, /<CrmWindowActivityPanel/);
  assert.match(globals, /\.nexid-crm-window-activity\s*\{[^}]*min-width: 0;[^}]*flex-shrink: 0/);
  assert.match(globals, /\.nexid-crm-kpi-column,[\s\S]*?\.nexid-crm-workspace[\s\S]*?scrollbar-gutter: stable/);
});

test("the map owns a stable canvas height and cannot collapse inside a flex remainder", () => {
  assert.match(crm, /nexid-crm-map-panel relative flex shrink-0 flex-col/);
  assert.match(crm, /nexid-crm-map-canvas-region[\s\S]*?h-\[460px\][\s\S]*?sm:h-\[520px\]/);
  assert.doesNotMatch(crm, /nexid-crm-map-canvas-region[^\n]*2xl:h-\[/);
  assert.match(globals, /\.nexid-crm-map-panel:not\(\[data-map-fullscreen="true"\]\) \.nexid-crm-map-body\s*\{[^}]*height: clamp\(32rem, 62vh, 38rem\)[^}]*grid-template-rows: auto minmax\(0, 1fr\)/);
  assert.match(globals, /\.nexid-crm-map-panel:not\(\[data-map-fullscreen="true"\]\) \.nexid-crm-map-canvas-region\s*\{[^}]*height: 100%;[^}]*min-height: 0/);
  assert.doesNotMatch(crm, /nexid-crm-map-canvas-region[^\n]*lg:h-full/);
  assert.doesNotMatch(crm, /rounded-2xl sm:min-h-\[560px\] lg:min-h-0/);
});

test("the desktop shell allocates natural header and footer rows around both bounded main views", () => {
  assert.match(globals, /@media \(min-width: 1024px\)\s*\{\s*\.nexid-crm-shell\s*\{[^}]*grid-template-columns: 6rem minmax\(0, 1fr\);[^}]*grid-template-rows: auto minmax\(0, 1fr\) auto/);
  assert.equal((crm.match(/<main[^>]*className="nexid-crm-main /g) || []).length, 2);
  assert.doesNotMatch(crm, /lg:ml-24|(?:lg|2xl):(?:h|top)-\[(?:calc\(100vh-|144px|70px)/);
  assert.match(globals, /\.nexid-crm-main\s*\{[^}]*grid-row: 2;[^}]*min-height: 0;[^}]*height: auto/);
  assert.match(globals, /\.nexid-crm-shell > \.nexid-crm-rail\s*\{[^}]*grid-row: 2;[^}]*min-height: 0;[^}]*overflow-y: auto/);
  assert.match(globals, /\.nexid-crm-shell > \.nexid-crm-rail\s*\{[^}]*overflow-x: hidden/);
  assert.doesNotMatch(crm, /group-hover:opacity-100 lg:block/);
  assert.match(globals, /\.nexid-crm-shell > \.nexid-crm-footer\s*\{[^}]*grid-row: 3;[^}]*position: relative;[^}]*height: auto;[^}]*flex-wrap: wrap/);
});

test("bounded map evidence regions remain available to keyboard scrolling and focus", () => {
  assert.match(crm, /tabIndex=\{0\} role="region" aria-label="Últimos eventos visibles" data-incident-event-list/);
  assert.match(crm, /tabIndex=\{0\} role="region" aria-label="Leyenda y fuente del mapa"/);
  assert.match(globals, /\.nexid-crm-events-rail\s*\{[^}]*min-height: 0;[^}]*overscroll-behavior-y: contain;[^}]*scrollbar-gutter: stable/);
  assert.match(globals, /:is\(\.nexid-crm-events-rail, \.nexid-crm-map-legend\):focus-visible\s*\{[^}]*outline: 3px solid var\(--crm-accent\);[^}]*outline-offset: -4px/);
});

test("map summary leaves space for 44px attribution on desktop and wrapped sources on mobile", () => {
  assert.match(map, /<details className="absolute bottom-20[^"\n]*sm:bottom-16"/);
});

test("44px map attribution keeps one centered icon and reserves readable source space", () => {
  assert.match(globals, /\.nexid-realtime-map \.maplibregl-ctrl-attrib-button\s*\{[^}]*min-height: 44px;[^}]*min-width: 44px;[^}]*background-repeat: no-repeat;[^}]*background-position: center/);
  assert.match(globals, /\.nexid-realtime-map \.maplibregl-ctrl-attrib\.maplibregl-compact\s*\{[^}]*min-height: 40px;[^}]*padding: 2px 48px 2px 8px;[^}]*max-width: calc\(100% - 76px\);[^}]*overflow-wrap: anywhere/);
  assert.match(globals, /\.nexid-realtime-map \.maplibregl-ctrl-bottom-right\s*\{[^}]*max-width: calc\(100% - 1\.25rem\)/);
  assert.match(map, /new maplibre\.AttributionControl\(\{ compact: true \}\)/);
});

test("map controls and events use document flow until an actually wide workspace is available", () => {
  assert.match(crm, /nexid-crm-map-control-deck relative z-30 grid shrink-0/);
  assert.match(crm, /nexid-crm-map-body grid min-h-0[\s\S]*?2xl:grid-cols-\[minmax\(0,1fr\)_282px\][\s\S]*?2xl:grid-rows-\[auto_minmax\(0,1fr\)\]/);
  assert.match(crm, /nexid-crm-map-body[\s\S]*?nexid-crm-map-legend[\s\S]*?2xl:col-start-2[\s\S]*?nexid-crm-map-canvas-region/);
  assert.match(crm, /nexid-crm-events-rail relative z-20[\s\S]*?2xl:row-start-2[\s\S]*?2xl:max-h-none/);
  assert.doesNotMatch(crm, /nexid-crm-events-rail[^\n]*2xl:absolute/);
  assert.doesNotMatch(crm, /nexid-crm-map-canvas-region[^\n]*2xl:pr-\[300px\]/);
  assert.doesNotMatch(crm, /nexid-crm-map-legend[^\n]*(?:absolute|2xl:bottom)/);
  assert.match(globals, /\.nexid-crm-activity-columns\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(globals, /@media \(min-width: 1280px\)\s*\{\s*\.nexid-crm-activity-columns\s*\{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(crm, /nexid-crm-alerts-panel|commercial-ai-panel/);
});

test("the activity panel uses both theme palettes and bounded keyboard-accessible lists", () => {
  assert.match(activity, /id="window-activity-panel" className="nexid-crm-window-activity"/);
  assert.match(globals, /\.nexid-crm-window-activity\s*\{[^}]*background: var\(--crm-panel\);[^}]*color: var\(--crm-ink\)/);
  assert.match(globals, /\.nexid-crm-activity-list\s*\{[^}]*max-height: 15rem;[^}]*overflow-y: auto;[^}]*overscroll-behavior-y: contain/);
  assert.equal((activity.match(/className="nexid-crm-activity-list" tabIndex=\{0\} role="region" aria-label=/g) || []).length, 3);
  assert.match(globals, /\.nexid-crm-window-activity :is\(button, summary, \[tabindex\]\):focus-visible\s*\{[^}]*outline: 3px solid var\(--crm-accent\);[^}]*outline-offset: -4px/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [shell, crm, map, globals] = await Promise.all([
  readFile(new URL("../src/components/dashboard-shell.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/executive-realtime-crm.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/realtime-maplibre-map.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
]);

test("the control-center return stays visible independently of sidebar scroll and on mobile", () => {
  assert.match(shell, /href=\{DASHBOARD_DESTINATIONS\.overview\.href\}[\s\S]*?dashboard-control-return sticky top-0 z-20/);
  assert.match(shell, /aria-current=\{pathname === DASHBOARD_DESTINATIONS\.overview\.href \? "page" : undefined\}/);
  assert.match(shell, />Centro de control<\/b>[\s\S]*?>CRM en vivo<\/span>/);
  assert.match(shell, /title="Volver al Centro de control y CRM en vivo"/);
  assert.match(shell, /<nav aria-label="Navegación rápida"[\s\S]*?dashboard-mobile-dock__link/);
  assert.match(shell, /item\.destination === "overview" \|\| canOpenDestination\(item\.destination\)/);
  assert.match(shell, /label: "Control", icon: LayoutDashboard/);
  assert.match(globals, /\.dashboard-control-return\s*\{[\s\S]*?background: rgba\(255, 255, 255, 0\.94\) !important/);
  assert.match(globals, /\.dashboard-control-return\[aria-current="page"\]/);
});

test("the sidebar identity follows the authenticated session instead of fixed demo or winery decoration", () => {
  assert.match(shell, /sessionWorkspaceLabel\(\{[\s\S]*?label: currentLabel,[\s\S]*?tenantSlug: currentTenantSlug/);
  assert.match(shell, /sidebarSessionLabel = currentIsDemo \? `Demo · \$\{sessionLabel\}` : sessionLabel/);
  assert.match(shell, /label=\{sessionLabel\}/);
  assert.match(shell, /currentTenantSlug \? <Building2[\s\S]*?: <Network/);
  assert.match(shell, /currentIsDemo[\s\S]*?"Entorno demo"[\s\S]*?"Sesión tenant activa"/);
  assert.doesNotMatch(shell, /🍇|Polygon Amoy/);
});

test("the realtime map groups actions, views and base layers without duplicating controls", () => {
  assert.match(crm, /data-map-fullscreen=\{isMapFullscreen \? "true" : "false"\}/);
  assert.match(crm, /nexid-crm-map-control-deck relative z-30 grid shrink-0/);
  assert.match(crm, /role="group" aria-label="Acciones del mapa" className="nexid-crm-map-actions/);
  assert.match(crm, /className="nexid-crm-map-toolbar/);
  assert.match(crm, /role="group" aria-label="Visualización de eventos" className="nexid-crm-map-view-controls/);
  assert.match(crm, /role="group" aria-label="Capa base del mapa" className="nexid-crm-map-base-controls/);
  assert.match(crm, /nexid-crm-map-view-button flex h-11/);
  assert.match(crm, /nexid-crm-map-control grid h-11 w-11/);
  assert.match(crm, /disabled=\{valuesUnavailable \|\| !streetViewTarget\}/);
  assert.match(crm, /2xl:hidden/);
  assert.match(crm, /nexid-crm-map-base-controls hidden[\s\S]*?2xl:flex/);
  assert.doesNotMatch(crm, /Restablecer mapa[\s\S]{0,240}<Settings/);
});

test("fullscreen and narrow layouts reserve distinct responsive control regions", () => {
  assert.match(globals, /\.nexid-crm-map-control-deck\s*\{[\s\S]*?linear-gradient/);
  assert.match(globals, /\.nexid-crm-map-toolbar\s*\{[\s\S]*?min-width: 0/);
  assert.match(globals, /\.nexid-crm-map-panel\[data-map-fullscreen="true"\] \.nexid-crm-map-body[\s\S]*?flex: 1/);
  assert.match(globals, /\.nexid-crm-map-panel\[data-map-fullscreen="true"\] \.nexid-crm-map-canvas-region[\s\S]*?height: 100% !important/);
  assert.match(globals, /\.nexid-crm-map-panel\[data-map-fullscreen="true"\] \.nexid-crm-map-legend,[\s\S]*?\.nexid-crm-map-panel\[data-map-fullscreen="true"\] \.nexid-crm-events-rail[\s\S]*?display: none/);
  assert.match(globals, /@media \(max-width: 640px\)[\s\S]*?\.nexid-crm-map-view-controls[\s\S]*?justify-content: flex-start/);
  assert.match(globals, /@media \(min-width: 1536px\)[\s\S]*?\.nexid-crm-map-base-controls/);
});

test("the CRM header grows with content and adapts its columns without fixed vertical offsets", () => {
  const header = crm.match(/<header data-testid="crm-responsive-header"[^>]+>/)?.[0] || "";
  assert.match(header, /nexid-crm-header/);
  assert.doesNotMatch(header, /(?:lg|2xl):(?:h-\[|flex-nowrap)/);
  assert.doesNotMatch(crm, /2xl:w-\[(?:440|590)px\]/);
  assert.match(globals, /\.nexid-crm-header\s*\{[^}]*height: auto;[^}]*padding-block: 0\.875rem/);
  assert.match(globals, /\.nexid-crm-header \.nexid-crm-nav\s*\{[^}]*grid-column: 1 \/ -1;[^}]*grid-row: 2/);
  assert.match(globals, /@media \(min-width: 1800px\)\s*\{[\s\S]*?\.nexid-crm-header-status\s*\{[^}]*grid-column: 3;[^}]*grid-row: 1/);
  assert.match(crm, /nexid-crm-header-status[^\n]*flex-wrap/);
});

test("map and shell motion honor the user's reduced-motion preference", () => {
  assert.match(shell, /useReducedMotion\(\)/);
  assert.match(shell, /whileHover=\{shouldReduceMotion \? undefined : \{ x: 4 \}\}/);
  assert.match(map, /window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches \? 0 : duration/);
  assert.match(map, /duration: mapMotionDuration\(650\)/);
  assert.match(globals, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?transition-duration: 0\.01ms !important/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [manifest, ogImage, login, loginPanel, layoutShell, demoPage, demoControl, demoGlobe, home, content, realtime] = await Promise.all([
  read("../src/app/manifest.ts"),
  read("../src/app/og-image.tsx"),
  read("../src/app/login/page.tsx"),
  read("../src/components/login-form-panel.tsx"),
  read("../src/components/dashboard-layout-shell.tsx"),
  read("../src/app/(app)/demo/page.tsx"),
  read("../src/components/demo-control-center.tsx"),
  read("../src/app/(app)/demo-globe/page.tsx"),
  read("../src/app/(app)/page.tsx"),
  read("../src/lib/dashboard-content.ts"),
  read("../src/components/realtime-ops-monitor.tsx"),
]);

test("global dashboard surfaces do not fabricate deployment or realtime health", () => {
  const global = [manifest, ogImage, login, loginPanel, layoutShell, demoPage, demoControl, demoGlobe, home, content].join("\n");

  assert.match(manifest, /source-labelled analytics/);
  assert.match(ogImage, /procedencia de datos visible/);
  assert.match(login, /Tu cuenta define qué empresa y módulos podés consultar/);
  assert.match(login, /La demo interactiva es un recorrido separado con datos ilustrativos/);
  assert.match(loginPanel, /bodegaDemoAllowed \? "Disponible" : "Pendiente"/);
  assert.match(loginPanel, /El ingreso requiere una cuenta Google autorizada por nexID/);
  assert.match(loginPanel, /Google configurado/);
  assert.match(layoutShell, /Estado API en cada módulo/);
  assert.match(demoPage, /mapa del dataset demo/);

  assert.doesNotMatch(global, /Enterprise-grade NFC operations|API Connected|Consola lista para venta|Google live|Simulate 10 live scans|Open live map|mapa en vivo|Métricas en vivo/i);
});

test("deterministic stream summary and connection badges state what is actually known", () => {
  assert.match(realtime, /RESUMEN DETERMINISTICO DEL STREAM/);
  assert.match(realtime, /STREAM SIN CONFIRMAR/);
  assert.match(realtime, /Stream no confirmado/);
  assert.match(realtime, /CALCULANDO EL RESUMEN SOBRE LOS EVENTOS VISIBLES/);

  assert.doesNotMatch(realtime, /IA OPERATIVA SOBRE STREAM|ANALIZANDO CONDICIONES DE SEGURIDAD EN TIEMPO REAL|>LIVE FEED<|>Live stream</);
});

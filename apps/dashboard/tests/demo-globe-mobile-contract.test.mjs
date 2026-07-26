import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/app/(app)/demo-globe/page.tsx", import.meta.url), "utf8");
const globalsSource = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("the dedicated 3D lab stays interactive on mobile viewports", () => {
  assert.match(source, /<Globe3dMap[\s\S]*mode="globe"/);
  assert.doesNotMatch(source, /<Globe3dMap[\s\S]*mode="preview"/);
});

test("the 3D lab labels geography and alerts as simulated evidence", () => {
  assert.match(source, /Escenario geográfico simulado con conexiones configuradas y eventos reportados de ejemplo/);
  assert.match(source, /no prueba recorridos ni custodia física/);
  assert.match(source, /alertas de São Paulo son datos de demostración simulados/);
  assert.match(source, /no representan movimiento físico observado/);
  assert.match(source, /Emitir escaneo simulado/);
  assert.match(source, /La demo no certifica origen ni condiciones físicas/);
  assert.match(source, /No prueba contenido ni autenticidad física/);
  assert.doesNotMatch(source, /trazabilidad física en tiempo real|alertas en tiempo real|Emitir Escaneo Realtime|origen geográfico certificado|medicamentos auténticos/i);
});

test("the dashboard shell clips root overflow without disabling local scrollers", () => {
  assert.match(globalsSource, /html,\s*body\s*\{[^}]*overflow-x:\s*clip;/s);
  assert.match(globalsSource, /\.data-table-shell/);
});

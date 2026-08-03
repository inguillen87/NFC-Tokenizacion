import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../src/app/(app)/supplier-orders/[orderId]/page.tsx", import.meta.url), "utf8");
const panel = await readFile(new URL("../src/app/(app)/supplier-orders/[orderId]/packaging-lab-panel.tsx", import.meta.url), "utf8");
const policy = await readFile(new URL("../src/lib/permission-policy.ts", import.meta.url), "utf8");
const proxy = await readFile(new URL("../src/app/api/admin/[...path]/route.ts", import.meta.url), "utf8");

test("supplier order renders a non-CLI Packaging Lab from an authoritative server fetch", () => {
  assert.match(page, /getPackagingLab/);
  assert.match(page, /Promise\.all/);
  assert.match(page, /<PackagingLabPanel orderId=\{orderId\} initialData=\{packagingLab\}/);
  assert.match(panel, /Crear proyecto sin CLI/);
  assert.match(panel, /Crear Lab y plantilla de pruebas/);
  assert.doesNotMatch(panel, /npm run|psql|curl\s/i);
});

test("AGRO_SECURE_PACKAGING_PILOT is selectable and remains a physical-validation proposal", () => {
  assert.match(panel, /Preset operativo/);
  assert.match(panel, /AGRO_SECURE_PACKAGING_PILOT/);
  assert.match(panel, /preset_code: presetCode/);
  assert.match(panel, /no aprueba nada/);
  assert.match(panel, /ensayos fisicos, recibo inmutable/);
});

test("operator UX tells the physical-security truth for TT, non-TT, GS1 and UHF", () => {
  assert.match(panel, /424 sin TT/);
  assert.match(panel, /no infiere ni expone tamper/i);
  assert.match(panel, /La cola cruza la apertura real/);
  assert.match(panel, /GS1 es identidad declarada/);
  assert.match(panel, /UHF es trazabilidad logistica y nunca recibe K_META\/K_FILE SUN/);
  assert.match(panel, /tt_closed/);
  assert.match(panel, /tt_opened/);
});

test("approval separation, activation gate and client-safe reports are visible", () => {
  assert.match(panel, /Separacion de funciones/);
  assert.match(panel, /excepcion autorizada y auditada/);
  assert.match(panel, /LAB READY/);
  assert.match(panel, /BLOCKED/);
  assert.match(panel, /format=pdf/);
  assert.match(panel, /format=csv/);
  assert.match(policy, /packaging-lab\(\?:\\\/report\)\?/);
  assert.match(proxy, /response\.arrayBuffer\(\)/);
});

test("creation and approval explain every fail-closed gate instead of silently disabling actions", () => {
  assert.match(panel, /const createChecks = \[/);
  assert.match(panel, /SKU vinculado/);
  assert.match(panel, /La cola TT cruza la apertura real/);
  assert.match(panel, /const approvalChecks = \[/);
  assert.match(panel, /Pruebas obligatorias resueltas/);
  assert.match(panel, /Separacion de funciones o excepcion auditada/);
  assert.match(panel, /<GateChecklist id="packaging-lab-create-readiness"/);
  assert.match(panel, /<GateChecklist id="packaging-lab-approval-readiness"/);
  assert.match(panel, /aria-describedby="packaging-lab-create-readiness"/);
  assert.match(panel, /aria-describedby="packaging-lab-approval-readiness"/);
  assert.match(panel, /role="status" aria-live="polite"/);
});

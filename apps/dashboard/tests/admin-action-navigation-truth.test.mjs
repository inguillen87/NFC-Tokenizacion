import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/components/admin-action-forms.tsx", import.meta.url), "utf8");

test("legacy admin screen routes supplier onboarding without collecting fake credentials", () => {
  assert.match(source, /Esta tarjeta no crea nada ni recopila credenciales/);
  assert.match(source, /href="\/batches\/supplier#supplier-order-console"/);
  assert.match(source, /Abrir Supplier batches/);
  assert.doesNotMatch(source, /Nexid!2026|ops@bodega-andes\.com|Bodega Andes Pilot/);
  assert.doesNotMatch(source, /const \[pilot, setPilot\]|provisionWinePilot/);
  assert.doesNotMatch(source, /placeholder="temporary password/);
});


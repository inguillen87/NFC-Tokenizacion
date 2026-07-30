import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/components/supplier-order-console.tsx", import.meta.url), "utf8");

test("supplier order creation requires an explicit commercial purpose", () => {
  assert.match(source, /useState<SupplierPackPurpose>\(""\)/);
  assert.match(source, /<option value="" disabled>Seleccionar explícitamente<\/option>/);
  assert.match(source, /<option value="trial_integration">[^<]*NON_SELLABLE<\/option>/);
  assert.match(source, /<option value="production">[^<]*QA v2<\/option>/);
  assert.match(source, /pack_purpose:\s*packPurpose/);
  assert.match(source, /!packPurpose\s*\? "Selecciona explícitamente el propósito:/);
});

test("supplier purpose badges state the actual release contract", () => {
  assert.match(source, /badge: "NON_SELLABLE"/);
  assert.match(source, /badge: "BLOQUEADO · QA V2"/);
  assert.match(source, /badge: "PROPÓSITO SIN CLASIFICAR"/);
  assert.match(source, /Registro legado fail-closed: no permite exportar, aprobar QA ni activar/);
  assert.match(source, /return resolveSupplierPackPurpose\(\{/);
  assert.match(source, /effectivePackPurpose: order\?\.effective_pack_purpose/);
  assert.match(source, /data-testid="supplier-pack-purpose-contract"/);
});

test("purpose-specific controls fail closed before QA or activation", () => {
  assert.match(source, /activePackPurpose === "trial_integration"\s*\? "NON_SELLABLE: un trial de integración nunca puede activar tags\./);
  assert.match(source, /activePackPurpose === "production"\s*\? "Producción bloqueada: requiere un plan y recibo de aceptación QA v2/);
  assert.match(source, /El QA fijo de 10 tags es solo para trial de integración/);
  assert.match(source, /Propósito sin clasificar: el QA permanece bloqueado/);
  assert.match(source, /Propósito sin clasificar: no se exportan llaves/);
  assert.match(source, /if \(!passed && qaRejectBlockReason\)/);
});

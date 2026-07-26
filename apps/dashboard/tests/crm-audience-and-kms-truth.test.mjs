import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const crm = await readFile(new URL("../src/components/executive-realtime-crm.tsx", import.meta.url), "utf8");
const supplierPage = await readFile(new URL("../src/app/(app)/batches/supplier/page.tsx", import.meta.url), "utf8");
const supplierConsole = await readFile(new URL("../src/components/supplier-order-console.tsx", import.meta.url), "utf8");

test("CRM opportunity counts real unique valid UID signals instead of an invented audience", () => {
  assert.match(crm, /const crmReady = new Set\(/);
  assert.match(crm, /const audience = crmReady/);
  assert.match(crm, /UIDs válidos únicos/);
  assert.match(crm, /signal_source: "unique_valid_uid"/);
  assert.doesNotMatch(crm, /hotspot\.valid \* 1\.4|hotspot\.gps \* 0\.8|audience: String\(opportunity\.audience\)/);
});

test("supplier UI distinguishes the Vercel application secret from KMS and HSM", () => {
  const copy = `${supplierPage}\n${supplierConsole}`;
  assert.match(copy, /clave maestra de aplicación guardada como secreto de Vercel/);
  assert.match(copy, /No es Google Cloud KMS ni HSM/);
  assert.match(copy, /Google Cloud KMS SOFTWARE queda reservado a custodia blockchain/);
  assert.doesNotMatch(copy, /nexID conserva KMS|No se expone KMS|sin KMS expuesta/);
});

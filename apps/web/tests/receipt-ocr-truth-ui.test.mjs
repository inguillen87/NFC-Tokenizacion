import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/app/sun/cta-actions.tsx", import.meta.url), "utf8");

test("receipt UX separates OCR extraction from tenant or signed POS authorization", () => {
  assert.match(source, /mode === "live_confirmed"/);
  assert.match(source, /provenance\.confirmed === true/);
  assert.match(source, /purchaseAuthorization\.status/);
  assert.match(source, /"signed_pos", "tenant_manual_approval"/);
  assert.match(source, /disabled=\{pending \|\| !ocrVerification\?\.authorizationConfirmed/);
  assert.doesNotMatch(source, /data\.claim_eligible === true/);
});

test("receipt UX labels provider, demo and manual-review states without fake AI verification", () => {
  assert.match(source, /Datos extra.dos por OCR/);
  assert.match(source, /Extracci.n demo simulada . no habilita propiedad/);
  assert.match(source, /Revisi.n manual requerida/);
  assert.match(source, /OCR no valida pago, producto ni titularidad/);
  assert.doesNotMatch(source, /Verificado por proveedor|Verificado \(IA:/);
});

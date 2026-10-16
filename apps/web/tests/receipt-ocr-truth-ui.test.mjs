import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/app/sun/cta-actions.tsx", import.meta.url), "utf8");

test("public claim entry cannot collect a receipt for an unattended OCR review", () => {
  assert.match(source, /SunClaimPortal/);
  assert.doesNotMatch(source, /receiptFileData|purchase_authorization|authorizationConfirmed|setShowReceiptForm/);
  assert.doesNotMatch(source, /\/api\/public-cta\/(?:receipt-ocr|claim-ownership)/);
});

test("the replacement entry does not present OCR output as approval or request an upload", async () => {
  const portal = await readFile(new URL("../src/app/sun/sun-claim-portal.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(portal, /type="file"|FileReader|receiptFileData|purchase_authorization|fetch\(/);
  assert.doesNotMatch(source, /Verificado por proveedor|Verificado \(IA:/);
});

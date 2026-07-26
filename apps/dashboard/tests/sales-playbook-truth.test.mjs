import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(
  new URL("../src/app/(app)/sales-playbook/page.tsx", import.meta.url),
  "utf8",
);
const generator = await readFile(
  new URL("../../../scripts/generate-sales-playbook-pdf.py", import.meta.url),
  "utf8",
);

const pdfUrls = [
  new URL("../public/nexid_sales_playbook.pdf", import.meta.url),
  new URL("../../web/public/nexid_sales_playbook.pdf", import.meta.url),
  new URL("../../../docs/nexid_sales_playbook.pdf", import.meta.url),
];

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

test("sales playbook states the current Vercel, Neon, NFC and chain custody boundaries", () => {
  assert.match(page, /APIs y funciones en Vercel/);
  assert.match(page, /PostgreSQL administrado en Neon/);
  assert.match(page, /K_META y K_FILE cifradas en Neon/);
  assert.match(page, /KMS_MASTER_KEY_HEX permanece en el backend de Vercel/);
  assert.match(page, /Google Cloud KMS SOFTWARE envelope \(kms_wrapped\)/);
  assert.match(page, /descifra efímeramente en el executor/);
});

test("sales playbook has no legacy infrastructure, hardware custody or proprietary AI claims", () => {
  assert.doesNotMatch(page, /\b(?:Render|AWS|HSM|FIPS)\b/i);
  assert.doesNotMatch(page, /Cognitive AI Engine|Cognitive AI Suite/i);
  assert.doesNotMatch(page, /Imposible \(Firma|menos del 1\.5|0\.5s|en milisegundos|optimizadas? en tiempo real/i);
  assert.match(page, /proveedor y modelo se muestran sólo tras una respuesta confirmada/i);
  assert.match(page, /fallback determinístico/i);
});

test("sales playbook source and reproducible generator contain no mojibake", () => {
  const mojibake = /(?:Ã.|Â.|â[-¿]|�)/u;
  assert.doesNotMatch(page, mojibake);
  assert.doesNotMatch(generator, mojibake);
});

test("dashboard, web and docs publish the exact same generated playbook PDF", async () => {
  const pdfs = await Promise.all(pdfUrls.map((url) => readFile(url)));
  const hashes = pdfs.map(sha256);

  assert.ok(pdfs.every((pdf) => pdf.subarray(0, 5).toString("ascii") === "%PDF-"));
  assert.ok(hashes.every((hash) => hash === hashes[0]), `PDF hashes differ: ${hashes.join(", ")}`);
  assert.match(generator, /MIRRORS = \(/);
  assert.match(generator, /copyfile\(OUTPUT, mirror\)/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const publicExperience = await readFile(new URL("../src/components/demo-public-experience.tsx", import.meta.url), "utf8");
const demoGlobe = await readFile(new URL("../src/app/(app)/demo-globe/page.tsx", import.meta.url), "utf8");

test("public demo withholds auth rate without events and labels its realtime emission", () => {
  assert.match(publicExperience, /authRate: total > 0 \? Math\.round\(\(authOk \/ total\) \* 100\) : null/);
  assert.match(publicExperience, /metrics\.authRate === null \? "N\/D · sin eventos"/);
  assert.match(publicExperience, /Emisión demo de eventos al dashboard/);
  assert.match(publicExperience, /check-in simulado/);
  assert.doesNotMatch(publicExperience, /authRate:[^\n]*: 100|Realtime dashboard|acceso en tiempo real/);
});

test("wine demo and globe scope NFC, TT, origin and NFT to digital evidence", () => {
  assert.match(publicExperience, /evidencia del mensaje NFC, TT reportado y origen declarado/);
  assert.match(publicExperience, /El tap no prueba autenticidad, contenido, sello ni custodia física/);
  assert.match(publicExperience, /resultado backend del mensaje; no la verdad física del objeto/);
  assert.doesNotMatch(publicExperience, /autenticidad de botella|nexID aporta la verdad del objeto|AUTH OK/);

  assert.match(demoGlobe, /reporta estado TT para revisión/);
  assert.match(demoGlobe, /no certifica sello, contenido ni apertura física/);
  assert.match(demoGlobe, /titularidad digital declarada según policy, no propiedad física/);
  assert.doesNotMatch(demoGlobe, /Sellos de seguridad TagTamper|precinto anticopia/);
});

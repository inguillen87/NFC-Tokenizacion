import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const liveDemo = await readFile(new URL("../src/components/live-demo-surfaces.tsx", import.meta.url), "utf8");
const demoLab = await readFile(new URL("../src/app/(public)/demo-lab/page.tsx", import.meta.url), "utf8");
const stack = await readFile(new URL("../src/app/stack/page.tsx", import.meta.url), "utf8");
const glossary = await readFile(new URL("../src/app/glossary/page.tsx", import.meta.url), "utf8");
const sdk = await readFile(new URL("../src/app/sdk/page.tsx", import.meta.url), "utf8");
const assetBank = await readFile(new URL("../src/lib/product-asset-bank.ts", import.meta.url), "utf8");

test("live demo labels NFC evidence and never invents production telemetry", () => {
  assert.match(liveDemo, /if \(result === "VALID"\) return "NFC message valid"/);
  assert.match(liveDemo, /source: "demo_seed_or_simulated_tap"/);
  assert.match(liveDemo, />N\/D<\/p>/);
  assert.match(liveDemo, /no live device location is inferred/);
  assert.match(liveDemo, /Source: seeded demo tenant and simulated taps/);

  assert.doesNotMatch(liveDemo, /return "Authentic"|\b148\b|activeTenants \|\| 1/);
  assert.doesNotMatch(liveDemo, /latest\?\.city \|\| "Mendoza"|latest\?\.country_code \|\| "AR"/);
});

test("demo lab describes anti-replay and observed cold-chain coverage without absolutes", () => {
  assert.match(demoLab, /mensajes repetidos, copiados o reproducidos según contador y política/);
  assert.match(demoLab, /los intervalos sin evidencia quedan visibles/);
  assert.match(demoLab, /no afirma continuidad de frío fuera de los intervalos observados/);
  assert.match(demoLab, /detectar o rechazar replays; esos controles no vuelven imposible copiar el soporte físico/);

  assert.doesNotMatch(demoLab, /Cada toque es único y no se puede copiar ni reutilizar/);
  assert.doesNotMatch(demoLab, /Demostrá a tus clientes que la cadena de frío se mantuvo intacta/);
});

test("stack scopes trust to tag messages, policy and reported TT state in every locale", () => {
  assert.match(stack, /Validación del mensaje, controles anti-replay, estado TT reportado y señales de riesgo/);
  assert.match(stack, /Validação da mensagem, controles anti-replay, estado TT reportado e sinais de risco/);
  assert.match(stack, /Message validation, replay controls, reported TT state and risk signals/);
  assert.match(stack, /no autentica por sí solo el objeto físico/);
  assert.match(stack, /não autentica sozinho o objeto físico/);
  assert.match(stack, /not standalone physical-product authentication/);

  assert.doesNotMatch(stack, /el producto demuestra que es real|valida la verdad del objeto/i);
  assert.doesNotMatch(stack, /valida a verdade do objeto|trusted physical anchor|Is it genuine and intact/i);
});

test("glossary and SDK define cryptographic evidence without physical-authenticity claims", () => {
  assert.match(glossary, /no prueba por sí solo autenticidad física, contenido, origen ni custodia/);
  assert.match(glossary, /sozinho não comprova autenticidade física, conteúdo, origem ou custódia/);
  assert.match(glossary, /by itself it does not prove physical authenticity, contents, origin or custody/);
  assert.match(glossary, /controles anti-replay y estado TagTamper reportado/);
  assert.match(glossary, /controles anti-replay e estado TagTamper reportado/);
  assert.match(glossary, /replay controls and reported TagTamper state/);
  assert.doesNotMatch(glossary, /Prueba autenticidad, estado|Valida autenticidade, estado|Proves authenticity, state/);

  assert.match(sdk, /aportan evidencia criptográfica del tag y controles anti-replay/);
  assert.match(sdk, /no autentican el producto físico ni eliminan toda clonación/);
  assert.doesNotMatch(sdk, /SUN prueban autenticidad fuerte|defensa real contra clones/);
});

test("product asset defaults describe declared digital references and digital ownership", () => {
  assert.match(assetBank, /Zapatillas con identidad digital/);
  assert.match(assetBank, /Prenda premium con identidad digital/);
  assert.match(assetBank, /referencia digital cargada por la marca/);
  assert.match(assetBank, /no transfiere propiedad física por sí mismo/);
  assert.match(assetBank, /eventos de canal reportados/);
  assert.match(assetBank, /lote y origen declarados/);
  assert.match(assetBank, /no certifica por sí solo el objeto físico/);

  assert.doesNotMatch(assetBank, /Zapatillas autenticadas|Prenda premium autenticada/);
  assert.doesNotMatch(assetBank, /mismo producto real|viaja por canal autorizado|prueba de origen/);
});

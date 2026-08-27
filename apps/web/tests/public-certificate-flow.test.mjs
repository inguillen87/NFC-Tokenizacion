import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("post tap and consumer portal surfaces link to public certificate", async () => {
  const sunPage = await readFile(new URL("../src/app/sun/page.tsx", import.meta.url), "utf8");
  const postTap = await readFile(new URL("../src/app/sun/post-tap-next-step.tsx", import.meta.url), "utf8");
  const walletPage = await readFile(new URL("../src/app/me/wallet/page.tsx", import.meta.url), "utf8");
  const productsPage = await readFile(new URL("../src/app/me/products/page.tsx", import.meta.url), "utf8");

  assert.match(sunPage, /\/certificado\//);
  assert.match(sunPage, /certificateHref=\{certificateHref\}/);
  assert.match(postTap, /Ver certificado digital/);
  assert.match(walletPage, /certificateHref/);
  assert.match(productsPage, /certificateHref/);
});

test("public certificate page gives wallet marketplace and explorer exits", async () => {
  const page = await readFile(new URL("../src/app/certificado/[eventId]/page.tsx", import.meta.url), "utf8");
  const walletCard = await readFile(new URL("../src/app/me/wallet/metamask-sandbox-card.tsx", import.meta.url), "utf8");

  assert.match(page, /public\/certificates/);
  assert.match(page, /Abrir Wallet/);
  assert.match(page, /Marketplace/);
  assert.match(page, /Polygonscan/);
  assert.match(page, /Cobertura de evidencia/);
  assert.match(page, /tagMessageValidated/);
  assert.match(page, /confirmedEvidenceCount/);
  assert.doesNotMatch(page, /score \|\| 88|confirma el evento fisico|"Autenticidad"/i);
  assert.match(page, /Banco real de assets/);
  assert.match(page, /assetProfile\.primaryImageUrl/);
  assert.match(walletCard, /0xa11ce00000000000000000000000000000000424/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("post tap preserves public certificates while authenticated product and wallet actions open private readings", async () => {
  const sunPage = await readFile(new URL("../src/app/sun/page.tsx", import.meta.url), "utf8");
  const postTap = await readFile(new URL("../src/app/sun/post-tap-next-step.tsx", import.meta.url), "utf8");
  const wallet = await readFile(new URL("../src/app/me/_components/wallet-interactive-client.tsx", import.meta.url), "utf8");
  const productsPage = await readFile(new URL("../src/app/me/products/page.tsx", import.meta.url), "utf8");
  const homeModel = await readFile(new URL("../src/app/me/_components/consumer-home-model.ts", import.meta.url), "utf8");

  assert.match(sunPage, /\/certificado\//);
  assert.match(sunPage, /certificateHref=\{certificateHref\}/);
  assert.match(postTap, /Ver certificado digital/);
  assert.match(wallet, /homeReadingHref\(product\.latest_tap_event_id\)/);
  assert.match(wallet, /Abrir lectura/);
  const library=await readFile(new URL("../src/app/me/products/product-library.tsx",import.meta.url),"utf8");
  assert.match(productsPage,/ConsumerProductLibrary/);assert.match(library,/p\.readingHref/);assert.doesNotMatch(library,/\/certificado\//);
  assert.match(homeModel, /\/me\/taps\//);
  assert.doesNotMatch(wallet, /\/certificado\//);
  assert.doesNotMatch(productsPage, /\/certificado\//);
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

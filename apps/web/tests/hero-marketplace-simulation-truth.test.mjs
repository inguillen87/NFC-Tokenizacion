import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const hero = await readFile(new URL("../src/components/hero-scene.tsx", import.meta.url), "utf8");
const landing = await readFile(new URL("../src/components/landing-sections.tsx", import.meta.url), "utf8");
const marketplaceStart = landing.indexOf("export function MarketplaceNetworkSection");
const marketplaceEnd = landing.indexOf("export function WhiteLabelOperatingSystemSection");
const marketplace = landing.slice(marketplaceStart, marketplaceEnd);

test("hero labels SUN, TT and route evidence as simulations in every locale", () => {
  assert.match(hero, /Lectura SUN simulada/);
  assert.match(hero, /Leitura SUN simulada/);
  assert.match(hero, /Simulated SUN read/);
  assert.match(hero, /No confirma autenticidad física, contenido, origen, custodia ni propiedad/);
  assert.match(hero, /Não confirma autenticidade física, conteúdo, origem, custódia ou propriedade/);
  assert.match(hero, /does not confirm physical authenticity, contents, origin, custody or ownership/);
  assert.match(hero, /RUTA DECLARADA · DEMO/);
  assert.match(hero, /ROTA DECLARADA · DEMO/);
  assert.match(hero, /DECLARED ROUTE · DEMO/);
  assert.match(hero, /SUN demo · TT reporta abierto/);
  assert.match(hero, /SUN demo · TT informa aberto/);
  assert.match(hero, /SUN demo · TT reports opened/);
  assert.match(hero, /detail: "SUN DEMO"/);
  assert.match(hero, /detail: "UID DEMO"/);

  const forbiddenClaims = [
    /Producto genuino/i,
    /Produto genuino/i,
    /Genuine product/i,
    /Medicamento verificado/i,
    /Medicine verified/i,
    /Auténtico, sello abierto/i,
    /Autentico, lacre aberto/i,
    /Authentic, opened seal/i,
    /Autenticad[oa] con dueño/i,
    /Autenticado com dono/i,
    /Authenticated owner/i,
    /RUTA DEMO VERIFICADA/i,
    /ROTA DEMO VERIFICADA/i,
    /VERIFIED DEMO ROUTE/i,
    /Caso auditado/i,
    /Audited case/i,
    /OWNER_OK|AUTH_OK|COSMETIC - VERIFIED|COLD_OK|WARRANTY_OK|DPP_OK|RETURN_OK|SUN OK|UID OK/,
  ];

  for (const claim of forbiddenClaims) assert.doesNotMatch(hero, claim);
  assert.doesNotMatch(hero, /Ã|Â|�/);
});

test("marketplace network describes governed demo actions without physical-product claims", () => {
  assert.ok(marketplaceStart >= 0 && marketplaceEnd > marketplaceStart);
  assert.match(marketplace, /This simulated network shows possible passport, club, marketplace, CRM and loyalty flows/);
  assert.match(marketplace, /Esta rede simulada mostra fluxos possíveis de passaporte, clube, marketplace, CRM e fidelidade/);
  assert.match(marketplace, /Esta red simulada muestra posibles flujos de pasaporte, club, tienda, CRM y beneficios/);
  assert.match(marketplace, /it does not prove the physical product, contents, declared origin, custody or ownership/);
  assert.match(marketplace, /não comprova produto físico, conteúdo, origem declarada, custódia ou propriedade/);
  assert.match(marketplace, /no prueba producto físico, contenido, origen declarado, custodia ni propiedad/);
  assert.match(marketplace, /Simulated tag read/);
  assert.match(marketplace, /no live customer feed/);

  assert.doesNotMatch(marketplace, /Every verified product|Cada produto verificado|Cada producto verificado/i);
  assert.doesNotMatch(marketplace, /Authenticity, seal state, origin|Autenticidad, sello, origen|Autenticidade, lacre, origem/i);
  assert.doesNotMatch(marketplace, /live actions|ações live|acciones activas/i);
  assert.doesNotMatch(marketplace, /Ã|Â|�/);
});

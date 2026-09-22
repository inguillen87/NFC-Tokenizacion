import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { platformVerticals } from "../src/lib/platform-verticals.ts";

const demoPage = await readFile(new URL("../src/app/(public)/demo-lab/page.tsx", import.meta.url), "utf8");
const demoClient = await readFile(new URL("../src/app/(public)/demo-lab/demo-lab-client.tsx", import.meta.url), "utf8");
const stack = await readFile(new URL("../src/app/stack/page.tsx", import.meta.url), "utf8");
const tapAssociation = await readFile(new URL("../src/app/me/_components/tap-association-banner.tsx", import.meta.url), "utf8");
const tapAssociationCopy = await readFile(new URL("../src/app/me/_components/tap-association-copy.ts", import.meta.url), "utf8");
const marketplace = await readFile(new URL("../src/app/me/marketplace/marketplace-grid-client.tsx", import.meta.url), "utf8");
const motionPack = await readFile(new URL("../src/app/(public)/demo-lab/motion-pack/page.tsx", import.meta.url), "utf8");
const postTapNextStep = await readFile(new URL("../src/app/sun/post-tap-next-step.tsx", import.meta.url), "utf8");

test("luxury, footwear and logistics copy keeps digital evidence separate from physical truth", () => {
  const luxury = platformVerticals.find((vertical) => vertical.id === "luxury");
  const footwear = platformVerticals.find((vertical) => vertical.id === "sneaker");
  const logistics = platformVerticals.find((vertical) => vertical.id === "logistics");

  assert.ok(luxury);
  assert.ok(footwear);
  assert.ok(logistics);

  assert.match(luxury.body, /no certifica por sí sola la autenticidad física/i);
  assert.match(luxury.bodyEn, /does not by itself certify physical authenticity/i);
  assert.match(luxury.bodyPt, /não certifica, por si só, a autenticidade física/i);

  assert.match(footwear.body, /no autentica por sí sola el calzado físico/i);
  assert.match(footwear.bodyEn, /does not by itself authenticate the physical footwear/i);
  assert.match(footwear.bodyPt, /não autentica, por si só, o calçado físico/i);
  assert.equal(footwear.metric, "Drop conectado");

  assert.match(logistics.body, /no prueba ruta física ni custodia/i);
  assert.match(logistics.bodyEn, /does not prove the physical route or custody/i);
  assert.match(logistics.bodyPt, /não comprova rota física nem custódia/i);

  const copy = [
    luxury.body,
    luxury.bodyEn,
    luxury.bodyPt,
    footwear.body,
    footwear.bodyEn,
    footwear.bodyPt,
  ].join("\n");
  assert.doesNotMatch(copy, /Producto original|Original products|Produto original|drop verificado|Verified drop authenticity/i);
});

test("sneaker Demo Lab validates the tag without authenticating the physical shoe", () => {
  assert.match(demoPage, /Drop conectado \+ registro de propiedad \+ controles anti-fraude/);
  assert.match(demoPage, /valida el mensaje dinámico del tag/);
  assert.match(demoPage, /no autentica por sí sola el calzado físico/);
  assert.doesNotMatch(demoPage, /El comprador verifica la autenticidad de su par|distinguí productos originales de réplicas|Cada drop verificado genera/);

  assert.match(demoClient, /family: "Zapatilla coleccionable conectada"/);
  assert.match(demoClient, /tagTitle: "Drop conectado"/);
  assert.match(demoClient, /: "VALIDÓ TAG"/);
  assert.doesNotMatch(demoClient, /family: "Zapatilla coleccionable real"|tagTitle: "Drop verificado"/);
});

test("Demo Lab ownership and logistics describe digital evidence and reported events", () => {
  assert.match(demoPage, /después de validar el mensaje NFC, la evidencia disponible y la política tenant/);
  assert.doesNotMatch(demoPage, /despues de validar autenticidad y politica tenant/);

  assert.match(demoClient, /"Eventos de ruta reportados", "Entrega declarada"/);
  assert.match(demoClient, /"Reported route events", "Declared delivery"/);
  assert.match(demoClient, /"Eventos de rota informados", "Entrega declarada"/);
  assert.match(demoClient, /It does not prove the physical route or custody/);
  assert.match(demoClient, /Não comprova rota física nem custódia/);
  assert.match(demoClient, /No prueba la ruta física ni la custodia/);
  assert.doesNotMatch(demoClient, /Ruta auditada|Rota auditada|Audited (?:product )?route|Verified delivery|Entrega verificada/);
});

test("export, POS and customer-service claims remain conditional on evidence and legal review", () => {
  assert.match(demoPage, /eventos de fuente trazable y revisión legal o regulatoria aplicable/);
  assert.match(demoPage, /no garantiza cumplimiento ni certificación por sí solo/);
  assert.match(demoPage, /integración POS\/eventos/);
  assert.match(demoPage, /no atribuyen por sí solas el origen de una filtración/);
  assert.match(demoPage, /solicitar soporte sujeto a identidad, compra, política de marca y revisión legal aplicable/);

  assert.doesNotMatch(demoPage, /Cumplí normativas de exportación/);
  assert.doesNotMatch(demoPage, /Cada unidad vendida queda registrada/);
  assert.doesNotMatch(demoPage, /podés rastrear el origen de la filtración/);
  assert.doesNotMatch(demoPage, /El soporte post-venta se activa con un tap/);
});

test("digital transfers and sales remain future requests until receipt and settlement are real", () => {
  assert.match(stack, /transferencia, venta o NFT requiere un flujo implementado, recibo on-chain y settlement real/);
  assert.match(stack, /transferência, venda ou NFT exigem fluxo implementado, recibo on-chain e settlement real/);
  assert.match(stack, /transfer, sale or NFT require an implemented flow, on-chain receipt and real settlement/);
  assert.match(stack, /Capacidad futura de fidelización, reventa y marketplace/);
  assert.match(stack, /Capacidade futura de fidelização, revenda e marketplace/);
  assert.match(stack, /Future loyalty, resale and marketplace capability/);

  assert.doesNotMatch(stack, /Reclamar, guardar, transferir, vender, usar beneficios o crear NFT/);
  assert.doesNotMatch(stack, /Transferência, vouchers, perks e redemptions/);
  assert.doesNotMatch(stack, /Ownership transfer, perks, vouchers and redemption/);
  assert.doesNotMatch(stack, /Monetize rights on real assets|Monetize direitos/);
});

test("webhook analytics does not promise end-to-end real-time delivery", () => {
  assert.match(demoClient, /Con APIs o webhooks configurados/);
  assert.match(demoClient, /la demo no garantiza tiempo real extremo a extremo/);
  assert.match(demoClient, /Com APIs ou webhooks configurados/);
  assert.match(demoClient, /a demo nao garante tempo real ponta a ponta/);
  assert.match(demoClient, /With configured APIs or webhooks/);
  assert.match(demoClient, /does not guarantee end-to-end real time/);

  assert.doesNotMatch(demoClient, /llegan al CRM y al panel en tiempo real/);
  assert.doesNotMatch(demoClient, /chegam ao CRM e ao dashboard em tempo real/);
  assert.doesNotMatch(demoClient, /land in CRM and dashboards in real time/);
});

test("tap association treats the query as a reference and reports only server-confirmed grants", () => {
  assert.match(tapAssociationCopy, /La referencia del enlace no confirma autenticidad ni permisos/);
  assert.match(tapAssociationCopy, /Cada acción se valida con tu sesión y la política de la empresa/);
  assert.match(tapAssociationCopy, /No se ejecutó una transferencia NFT ni se activó garantía/);
  assert.match(tapAssociationCopy, /Esta respuesta no creó una solicitud de revisión ni registró titularidad/);
  assert.doesNotMatch(tapAssociation, /Mensaje NFC validado|logout|forceOtp|verifyAndAssociate/);
  assert.doesNotMatch(tapAssociation, /Tap físico verificado|El tap fue verificado/);
});

test("consumer marketplace describes the drop as connected to the tag", () => {
  assert.match(marketplace, /Drop conectado al tag/);
  assert.doesNotMatch(marketplace, /Drop verificado por tap/);
});

test("SUN next steps and motion assets never upgrade a simulation into physical proof", () => {
  assert.match(postTapNextStep, /El mensaje de la etiqueta fue analizado/);
  assert.doesNotMatch(postTapNextStep, /La botella fue analizada|La identidad fue analizada/);

  assert.match(motionPack, /Escena de producto \/ toque simulado \/ negocio/);
  assert.match(motionPack, /Product scene \/ simulated tap \/ business/);
  assert.match(motionPack, /Cena de produto \/ toque simulado \/ negocio/);
  assert.doesNotMatch(motionPack, /Producto real \/ toque vivo|Real product \/ live tap|Produto real \/ toque vivo|Tap valido|Valid tap|Toque valido/);

  assert.match(demoClient, /product scene, bounded digital evidence, risk and business/i);
  assert.match(demoClient, /Toque simulado/);
  assert.match(demoClient, /Estado TT abierto reportado/);
  assert.doesNotMatch(demoClient, /real product, physical proof|produto real, prova fisica|producto real, prueba fisica|title: "Live tap"|title: "Toque vivo"/i);
});

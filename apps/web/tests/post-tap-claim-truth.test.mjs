import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/app/sun/cta-actions.tsx", import.meta.url), "utf8");

test("post-tap copy separates contact-channel confirmation from approved purchase and ownership", () => {
  assert.match(source, /Canal de contacto confirmado/);
  assert.match(source, /El codigo solo confirma el canal de contacto/);
  assert.match(source, /Registro de comprador aprobado y asociado al tenant/);
  assert.match(source, /ownershipStatus === "claimed"/);
  assert.match(source, /La propiedad y la garantia esperan el estado aprobado del backend/);
  assert.doesNotMatch(source, /Identidad verificada/);
  assert.doesNotMatch(source, /continuar como comprador verificado/);
  assert.doesNotMatch(source, /Alta de comprador verificado/);
  assert.doesNotMatch(source, /Comprador verificado y registro asociado/);
  assert.doesNotMatch(source, /ownerClaimScore|\? 92 :|seguridad<\/span>[\s\S]{0,120}<strong[^>]*>\{[^}]*\d+/i);
  assert.match(source, /Canal confirmado/);
});

test("post-tap copy qualifies TT, GPS and on-chain evidence", () => {
  assert.match(source, /El tag reporto TT abierto/);
  assert.match(source, /Su significado fisico depende de la integracion al packaging/);
  assert.match(source, /señales auxiliares de auditoria/);
  assert.match(source, /No prueban identidad, compra ni ubicacion fisica del producto por si solos/);
  assert.match(source, /checked=\{shareApproximateLocation\}/);
  assert.match(source, /getClientMetadata\(shareApproximateLocation\)/);
  assert.match(source, /geoPrecision: shareApproximateLocation \? "approximate" : "not_requested"/);
  assert.match(source, /no guarda GPS exacto/);
  assert.match(source, /enableHighAccuracy: false/);
  assert.match(source, /Una transaccion confirmada puede registrar/);
  assert.match(source, /no prueba por si sola custodia ni contenido fisico/);
  assert.doesNotMatch(source, /Sello abierto verificado/);
  assert.doesNotMatch(source, /Tap fresco verificado/);
  assert.doesNotMatch(source, /llaves de seguridad cruzadas/);
  assert.doesNotMatch(source, /El token ancla la apertura verificada/);
  assert.doesNotMatch(source, /El token ancla propiedad/);
  assert.doesNotMatch(source, /El token ancla un lote, origen/);
  assert.doesNotMatch(source, /transferencia de propiedad validada/);
  assert.doesNotMatch(source, /anti-fraude digital/);
});

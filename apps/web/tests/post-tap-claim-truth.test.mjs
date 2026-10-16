import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/app/sun/cta-actions.tsx", import.meta.url), "utf8");

test("post-tap ownership entry preserves current policy and commercial gates", () => {
  assert.match(source, /const commercialActionsAllowed = canExecute && !isManualOpenedConsumerFlow && tapState !== "blocked" && !isDemoPreview/);
  assert.match(source, /const canStartClaim = commercialActionsAllowed && policyAllowsAction\("claimOwnership"\)/);
  assert.doesNotMatch(source, /Identidad verificada/);
  assert.doesNotMatch(source, /continuar como comprador verificado/);
  assert.doesNotMatch(source, /Alta de comprador verificado/);
  assert.doesNotMatch(source, /Comprador verificado y registro asociado/);
  assert.doesNotMatch(source, /ownerClaimScore|\? 92 :|seguridad<\/span>[\s\S]{0,120}<strong[^>]*>\{[^}]*\d+/i);
});

test("post-tap copy qualifies TT, GPS and on-chain evidence", () => {
  assert.match(source, /La etiqueta digital informó una apertura/);
  assert.match(source, /Un operador informó una apertura/);
  assert.match(source, /La etiqueta digital no la detectó automáticamente/);
  assert.match(source, /Una apertura declarada necesita revisión antes de habilitar propiedad, garantía o tokenización/);
  assert.doesNotMatch(source, /getClientMetadata|getCurrentPosition|deviceFingerprint|receiptFileData/);
  assert.match(source, /Una transaccion confirmada puede registrar/);
  assert.match(source, /no prueba por si sola custodia ni contenido fisico/);
  assert.doesNotMatch(source, /Sello abierto verificado/);
  assert.doesNotMatch(source, /MANUAL_OPENED[^\n]{0,120}(?:Apertura detectada|Sello abierto verificado)/i);
  assert.doesNotMatch(source, /Tap fresco verificado/);
  assert.doesNotMatch(source, /llaves de seguridad cruzadas/);
  assert.doesNotMatch(source, /El token ancla la apertura verificada/);
  assert.doesNotMatch(source, /El token ancla propiedad/);
  assert.doesNotMatch(source, /El token ancla un lote, origen/);
  assert.doesNotMatch(source, /transferencia de propiedad validada/);
  assert.doesNotMatch(source, /anti-fraude digital/);
});

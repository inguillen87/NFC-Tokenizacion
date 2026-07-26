import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  qualifySunStatusForPreview,
  selectSunTruthCopy,
  SUN_DEMO_BADGE,
  SUN_DEMO_COPY,
} from "../src/app/sun/sun-truth-copy.ts";

test("SUN fixture labels the first viewport as a demo without a physical tap", async () => {
  const page = await readFile(new URL("../src/app/sun/page.tsx", import.meta.url), "utf8");

  assert.equal(SUN_DEMO_BADGE, "MUESTRA DEMO · SIN TAP FÍSICO");
  assert.equal(
    qualifySunStatusForPreview(true, "SUN VÁLIDO · TT ABIERTO"),
    "SIMULACIÓN · SUN VÁLIDO · TT ABIERTO",
  );
  assert.match(page, /const livePillLabel = isDemoPreview \? "Muestra demo"/);
  assert.match(page, /\{isDemoPreview && \([\s\S]*?\{SUN_DEMO_BADGE\}[\s\S]*?\)\}/);
  assert.match(page, /const primaryStatusLabel = qualifySunStatusForPreview\(isDemoPreview, rawPrimaryStatusLabel\)/);
  assert.match(page, /const displayStatusHeadline = isDemoPreview[\s\S]*?"Simulación guiada: mensaje SUN válido y estado TT abierto\."/);
});

test("SUN real-param and snapshot statuses remain unqualified", () => {
  const authenticOpened = "SUN VÁLIDO · TT ABIERTO";
  const authenticClosed = "SUN VÁLIDO · TT CERRADO";

  assert.equal(qualifySunStatusForPreview(false, authenticOpened), authenticOpened);
  assert.equal(qualifySunStatusForPreview(false, authenticClosed), authenticClosed);
});

test("SUN demo copy never asserts a fresh physical tap or a real verification", async () => {
  const page = await readFile(new URL("../src/app/sun/page.tsx", import.meta.url), "utf8");
  const actions = await readFile(new URL("../src/app/sun/cta-actions.tsx", import.meta.url), "utf8");
  const engagement = await readFile(new URL("../src/app/sun/qr-engagement-suite.tsx", import.meta.url), "utf8");
  const demoCopy = Object.values(SUN_DEMO_COPY).join("\n");

  assert.match(demoCopy, /estado TT abierto reportado por el tag/);
  assert.match(demoCopy, /No se realizó un tap físico/);
  assert.match(demoCopy, /No verifican el sello físico, el contenido ni la custodia/);
  assert.doesNotMatch(demoCopy, /Tap físico fresco|Autenticidad confirmada|Sello abierto verificado|Se verificó|Producto real/i);
  assert.doesNotMatch(demoCopy, /SUN válido y un sello abierto|sello abierto simulado|Estado de sello y acciones simulados/i);
  assert.equal(selectSunTruthCopy(true, "SIMULADO", "Producto real"), "SIMULADO");
  assert.equal(selectSunTruthCopy(false, "SIMULADO", "Producto real"), "Producto real");

  assert.match(page, /const replayDecisionText = selectSunTruthCopy\(isDemoPreview, SUN_DEMO_COPY\.decision, realReplayDecisionText\)/);
  assert.match(page, /label: isDemoPreview \? SUN_DEMO_COPY\.passportEventLabel : isQrScan \? "Se consultó" : "Se analizó"/);
  assert.match(page, /title: isDemoPreview \? SUN_DEMO_COPY\.passportEventTitle : isQrScan \? "Ficha QR abierta" : isTechnicallyAuthentic \? "Identidad NFC validada"/);
  assert.doesNotMatch(page, /AUTÉNTICO &|Producto auténtico|Producto autentico|Autenticidad confirmada/);
  assert.doesNotMatch(page, /Auténtico, sello abierto|Autenticidad y trazabilidad visibles|autenticidad visible|Producto Verificado|Apertura verificada|Ruta de Confianza|Ver ruta de confianza/i);
  assert.doesNotMatch(page, /Riesgo bajo \| sello abierto|Sello intacto|NFT certificado en blockchain|Comprador verificado|Firma Criptográfica CMAC[\s\S]{0,160}\|\| "verificada"/i);
  assert.doesNotMatch(page, /const baseTrustScore|const stateScoreCap|isValid\s*\?\s*94|Sobre semilla certificada/);
  assert.match(page, /trustScore == null \? "No reportado" : `\$\{trustScore\}\/100`/);
  assert.match(page, /Evidencia CMAC[\s\S]{0,160}\|\| "No disponible"/);
  assert.match(page, /isDemoPreview=\{isDemoPreview\}/);
  assert.match(actions, /selectSunTruthCopy\(isDemoPreview, SUN_DEMO_COPY\.claimTapLabel, "Evidencia NFC fresca"\)/);
  assert.match(actions, /selectSunTruthCopy\(isDemoPreview, SUN_DEMO_COPY\.gatedActions, realGatedCopy\)/);
  assert.doesNotMatch(actions, /tap físico prueba acceso al producto|core: autenticidad/i);
  assert.match(engagement, /Un SUN fresco permite validar el mensaje dinámico asociado al tag y al batch\. Por sí solo no certifica contenido físico, origen, compra ni propiedad\./);
  assert.doesNotMatch(engagement, /confirma mejor la autenticidad|tap físico une producto, lote/i);
});

import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { getSunHeroTraceCopy } from "../src/app/sun/sun-hero-truth-copy.ts";

test("SUN product-first card never renders the legacy simulated route hero", async () => {
  const hero = await readFile(new URL("../src/app/sun/sun-product-hero-stage.tsx", import.meta.url), "utf8");
  const page = await readFile(new URL("../src/app/sun/page.tsx", import.meta.url), "utf8");
  const demoCopy = Object.values(getSunHeroTraceCopy(true, "opened")).join("\n");

  assert.match(hero, /isDemoPreview: boolean/);
  assert.match(hero, /getSunHeroTraceCopy\(isDemoPreview, state\)/);
  assert.doesNotMatch(page, /<SunProductHeroStage/);
  assert.match(page, /className="sun-result-card__product"/);
  assert.match(page, /Perfil oficial del piloto/);
  assert.doesNotMatch(demoCopy, /Tap actual|Tap fisico|Lectura fisica del chip|Ruta real de confianza del producto/);
  assert.match(demoCopy, /sin tap físico/);
  assert.match(demoCopy, /simulad/);
  assert.match(demoCopy, /no representa una ruta física verificada/);
});

test("SUN hero real branch keeps registered NFC evidence separate from physical movement", () => {
  assert.deepEqual(getSunHeroTraceCopy(false, "opened"), {
    originSublabel: "Origen declarado",
    originStageLabel: "Origen declarado",
    originEvidence: "Lote, productor y pasaporte registrados por el tenant",
    originPinLabel: "Origen declarado",
    tapSublabel: "Lectura NFC registrada",
    tapStageLabel: "Lectura NFC",
    tapEvidence: "Mensaje SUN válido y TT abierto reportado",
    tapPinLabel: "Lectura",
    routeLabel: "Origen declarado -> lectura",
    routeEvidence: "Segmento calculado entre registros; no prueba el recorrido físico",
  });

  assert.equal(getSunHeroTraceCopy(false, "idle").tapEvidence, "Mensaje NFC del chip validado");
  assert.equal(getSunHeroTraceCopy(false, "blocked").tapEvidence, "Mensaje NFC del chip validado");
});

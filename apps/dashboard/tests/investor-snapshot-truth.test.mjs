import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const deck = await readFile(new URL("../src/app/(app)/investor-snapshot/page.tsx", import.meta.url), "utf8");

test("investor deck documents the deployed architecture and optional tenant-scoped chains", () => {
  assert.match(deck, /RUNTIME EN VERCEL, DATOS EN NEON/);
  assert.match(deck, /validación SUN server-side/);
  assert.match(deck, /Polygon o IOTA se habilitan sólo por tenant/);
  assert.match(deck, /Las demos actuales usan testnet/);
  assert.doesNotMatch(deck, /AWS|Render|bases de datos SQL redundantes/i);
});

test("investor deck never renders a fabricated live ledger, AI provider or device", () => {
  assert.match(deck, /CONTRATO DE EVIDENCIA · EJEMPLO/);
  assert.match(deck, /PENDIENTE DE EVIDENCIA/);
  assert.match(deck, /no es telemetría live/);
  assert.match(deck, /fallback determinístico/);
  assert.doesNotMatch(deck, /LEDGER DE SEGURIDAD|VERIFICADA \(OK\)|iPhone 16 Pro|iOS 18\.2|Cognitive AI (?:Engine|Vision Suite)/);
});

test("investor deck labels illustrative metrics, votes and ownership boundaries", () => {
  assert.match(deck, /92% · hipótesis editable/);
  assert.match(deck, /28% · ejemplo, no observado/);
  assert.match(deck, /Ejemplo de encuesta · datos simulados/);
  assert.match(deck, /El tap inicial no crea propiedad automáticamente/);
  assert.match(deck, /RESULTADOS A MEDIR; NO SE PRESENTAN COMO TRACCIÓN OBSERVADA/);
  assert.doesNotMatch(deck, /Gobernanza VIP Activa|Votación en Curso|Votos reales/);
});

test("investor deck source remains valid UTF-8 without visible mojibake", () => {
  assert.doesNotMatch(deck, /Ã.|Â.|â.|�/u);
});

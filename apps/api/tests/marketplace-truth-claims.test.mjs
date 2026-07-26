import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const runtimeSchema = readFileSync(
  new URL('../src/lib/commercial-runtime-schema.ts', import.meta.url),
  'utf8',
);
const correctionMigration = readFileSync(
  new URL('../db/migrations/20260726135000_0059_marketplace_claim_truth_cleanup.sql', import.meta.url),
  'utf8',
);

test('marketplace copy separates an authenticated NFC message from physical product claims', () => {
  const releaseSurface = `${runtimeSchema}\n${correctionMigration}`;

  assert.match(releaseSurface, /mensaje fue validado/);
  assert.match(releaseSurface, /no certifica por sí sola el contenido ni la condición física/);
  assert.doesNotMatch(releaseSurface, /botella verificada con NTAG/i);
  assert.doesNotMatch(releaseSurface, /prueba de autenticidad NFC/i);
});

test('the forward-only cleanup covers the legacy active marketplace record', () => {
  assert.match(correctionMigration, /Gran Reserva Malbec - club release/);
  assert.match(correctionMigration, /lectura NFC válida/);
  assert.match(correctionMigration, /tenant\.slug = 'demobodega'/);
});

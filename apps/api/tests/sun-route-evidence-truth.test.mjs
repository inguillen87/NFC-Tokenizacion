import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const route = await readFile(new URL("../src/app/sun/route.ts", import.meta.url), "utf8");
const service = await readFile(new URL("../src/lib/sun-service.ts", import.meta.url), "utf8");

test("SUN surfaces distinguish validated tag evidence from the physical product", () => {
  const trustStart = route.indexOf("function resolveTrustState");
  const trustEnd = route.indexOf("function summarizeUserAgent", trustStart);
  assert.notEqual(trustStart, -1);
  assert.notEqual(trustEnd, -1);

  const trustSurface = route.slice(trustStart, trustEnd);
  const releaseSurface = `${route.slice(0, trustStart)}\n${route.slice(trustEnd)}\n${service}`;

  assert.match(route, /Mensaje NFC validado/);
  assert.match(route, /no certifica el producto físico/i);
  assert.doesNotMatch(route, /deterministic_policy_heuristic/);
  assert.doesNotMatch(route, /normalizeDemoBodegaSunResult/);
  assert.match(route, /NEXID_SUN_DEMO_AUTO_SEED/);
  assert.match(route, /\[process\.env\.VERCEL_ENV, process\.env\.NODE_ENV\]/);
  assert.match(route, /\.some\(\(value\) => String\(value \|\| ""\)\.trim\(\)\.toLowerCase\(\) === "production"\)/);
  assert.match(route, /la línea visual no prueba ruta física ni custodia/i);
  assert.match(trustSurface, /normalizedProductState === "VALID_AUTHENTIC"[\s\S]*Autenticidad criptográfica confirmada\. Este producto no usa sello electrónico de apertura\./);
  assert.match(trustSurface, /normalizedProductState === "VALID_CLOSED"[\s\S]*Autenticidad confirmada\. Sello intacto\.[\s\S]*TTStatus completo validado[\s\S]*construcción de empaque aprobada/);
  assert.match(trustSurface, /normalizedProductState === "VALID_OPENED"[\s\S]*Producto auténtico · sello abierto[\s\S]*TTStatus completo validado[\s\S]*no certifica por sí solo el contenido ni la custodia/);
  assert.match(trustSurface, /normalizedProductState === "VALID_OPENED_PREVIOUSLY"[\s\S]*apertura previa[\s\S]*TTStatus completo validado[\s\S]*no certifica por sí solo el contenido ni la custodia/);
  assert.doesNotMatch(trustSurface, /normalizedReason\.includes\(['"]opened['"]\)/);
  assert.doesNotMatch(releaseSurface, /Producto auténtico|Autenticidad confirmada|Sello intacto|Authentic product|Authenticity confirmed|Seal intact|Produto autêntico|Autenticidade confirmada|Selo intacto/i);
});

test("SUN passport never infers an IOTA anchor from a local event id", () => {
  assert.match(route, /Evidencia IOTA:<\/b> No expuesta por este pasaporte/);
  assert.doesNotMatch(route, /contract\.identity\.eventId \? '<span[^']*>Anclado \(Logistics Event\)/);
});

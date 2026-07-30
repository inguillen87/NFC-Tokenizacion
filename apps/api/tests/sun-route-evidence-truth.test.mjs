import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const route = await readFile(new URL("../src/app/sun/route.ts", import.meta.url), "utf8");
const service = await readFile(new URL("../src/lib/sun-service.ts", import.meta.url), "utf8");

test("SUN surfaces distinguish validated tag evidence from the physical product", () => {
  const releaseSurface = `${route}\n${service}`;

  assert.match(route, /Mensaje NFC validado/);
  assert.match(route, /no certifica el producto físico/i);
  assert.doesNotMatch(route, /deterministic_policy_heuristic/);
  assert.doesNotMatch(route, /normalizeDemoBodegaSunResult/);
  assert.match(route, /NEXID_SUN_DEMO_AUTO_SEED/);
  assert.match(route, /\[process\.env\.VERCEL_ENV, process\.env\.NODE_ENV\]/);
  assert.match(route, /\.some\(\(value\) => String\(value \|\| ""\)\.trim\(\)\.toLowerCase\(\) === "production"\)/);
  assert.match(route, /la línea visual no prueba ruta física ni custodia/i);
  assert.doesNotMatch(releaseSurface, /Producto auténtico|Autenticidad confirmada|Sello intacto|Authentic product|Authenticity confirmed|Seal intact|Produto autêntico|Autenticidade confirmada|Selo intacto/i);
});

test("SUN passport never infers an IOTA anchor from a local event id", () => {
  assert.match(route, /Evidencia IOTA:<\/b> No expuesta por este pasaporte/);
  assert.doesNotMatch(route, /contract\.identity\.eventId \? '<span[^']*>Anclado \(Logistics Event\)/);
});

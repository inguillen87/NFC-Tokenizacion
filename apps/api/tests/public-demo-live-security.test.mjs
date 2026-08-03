import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const route = await readFile(new URL("../src/app/demo/live/route.ts", import.meta.url), "utf8");
const surface = await readFile(new URL("../../web/src/components/live-demo-surfaces.tsx", import.meta.url), "utf8");

test("public demo feed is bound to the reserved synthetic demo scope", () => {
  assert.match(route, /DEMO_TENANT_SLUG/);
  assert.match(route, /requireReservedDemoBatch\(\)/);
  assert.match(route, /requestedTenant !== DEMO_TENANT_SLUG/);
  assert.match(route, /WHERE b\.id = \$\{batchScope\.batch\.id\}/);
  assert.match(route, /b\.tenant_id = \$\{batchScope\.batch\.tenantId\}/);
  assert.match(route, /LOWER\(COALESCE\(e\.source::text, ''\)\) = 'demo'/);
  assert.doesNotMatch(route, /WHERE tn\.slug = \$\{tenant\}/);
});

test("public demo feed exposes a bounded redacted projection", () => {
  assert.match(route, /enforceCriticalRateLimit/);
  assert.match(route, /Math\.min\(Math\.max\(parsed, 1\), 50\)/);
  assert.match(route, /AS uid_masked/);
  assert.match(route, /round\(COALESCE\(e\.lat, e\.geo_lat\)::numeric, 2\)/);
  assert.match(route, /round\(COALESCE\(e\.lng, e\.geo_lng\)::numeric, 2\)/);
  assert.match(route, /synthetic_demo_only/);
  assert.match(route, /cache-control/);
  assert.doesNotMatch(route, /\n\s*e\.uid_hex,\s*\n/);
  assert.doesNotMatch(route, /\n\s*e\.device_label,\s*\n/);
  assert.doesNotMatch(route, /\n\s*tn\.slug AS tenant_slug,\s*\n/);
  assert.doesNotMatch(surface, /event\.uid_hex/);
  assert.match(surface, /event\.uid_masked/);
});

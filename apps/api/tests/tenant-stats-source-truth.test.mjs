import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const route = await readFile(new URL("../src/app/admin/tenants/route.ts", import.meta.url), "utf8");

test("tenant stats filter event provenance in both scoped and global queries", () => {
  assert.match(route, /resolveTenantStatsSource\(\{[\s\S]*forcedTenantSlug,[\s\S]*requestedSource: searchParams\.get\("source"\)/);
  assert.match(route, /reason: statsSourceResolution\.reason[\s\S]*400/);
  assert.equal(
    (route.match(/LOWER\(COALESCE\(e\.source::text, 'real'\)\) = \$\{statsSource\}/g) || []).length,
    2,
  );
  assert.match(route, /stats_source: statsSource/);
});

test("tenant stats do not retain an unfiltered events join", () => {
  assert.doesNotMatch(route, /LEFT JOIN events e ON e\.batch_id = b\.id AND e\.tenant_id = tn\.id/);
});

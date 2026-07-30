import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { tsImport } from "tsx/esm/api";

const [{ resolveCanonicalTenantRisk }, { demoRuntimeSummary }] = await Promise.all([
  tsImport("../src/lib/tenant-risk.ts", import.meta.url),
  tsImport("../src/lib/demo-runtime-state.ts", import.meta.url),
]);

test("tenant dashboards consume the canonical API/core risk score", () => {
  assert.equal(resolveCanonicalTenantRisk({ risk_score: 17.4, scans: 100, duplicates: 90, tamper: 90 }), 17.4);
  assert.equal(resolveCanonicalTenantRisk({ risk_score: 250 }), 100);

  const fallback = resolveCanonicalTenantRisk({ scans: 100, valid: 95, invalid: 5, duplicates: 2, tamper: 1, revoked: 0 });
  assert.equal(fallback, 2.6);
  assert.equal(resolveCanonicalTenantRisk({ scans: 100, valid: 5 }), 0);

  const home = readFileSync(new URL("../src/app/(app)/page.tsx", import.meta.url), "utf8");
  const network = readFileSync(new URL("../src/app/(app)/superadmin-network/page.tsx", import.meta.url), "utf8");
  for (const source of [home, network]) {
    assert.match(source, /resolveCanonicalTenantRisk\(row\)/);
    assert.doesNotMatch(source, /duplicates\s*\*\s*40|duplicateRatio\s*\*\s*45/);
  }
});

test("demo summaries keep lifecycle events outside valid, invalid and risk counts", () => {
  const summary = demoRuntimeSummary([
    { result: "VALID_OPENED", reason: "opened" },
    { result: "CLAIMED", reason: "ownership_claimed" },
    { result: "INVALID", reason: "cmac mismatch" },
    { result: "REPLAY_SUSPECT", reason: "duplicate detected" },
  ]);
  assert.deepEqual(summary, {
    scans: 4,
    valid: 1,
    invalid: 1,
    duplicates: 1,
    tamper: 0,
    risk: 2,
  });
});

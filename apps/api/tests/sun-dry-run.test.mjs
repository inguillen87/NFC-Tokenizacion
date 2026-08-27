import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { shouldPersistSunScanState } from "../src/lib/sun-service.ts";

const ADMIN_DIAGNOSTIC_ROUTES = [
  ["inspect/route.ts", 1],
  ["validate/route.ts", 1],
  ["compare-tamper/route.ts", 2],
  ["compare-tamper-samples/route.ts", 1],
  ["find-ttstatus-candidates/route.ts", 1],
];

const PERSISTING_SCAN_CALLERS = [
  "../src/app/sun/route.ts",
  "../src/app/api/v1/sdk/verify/route.ts",
  "../src/app/internal/demo/scan/route.ts",
];

test("SUN scan persistence mode preserves production default and fails closed when explicit", () => {
  assert.equal(shouldPersistSunScanState(undefined), true);
  assert.equal(shouldPersistSunScanState("persist"), true);
  assert.equal(shouldPersistSunScanState("dry_run"), false);
  assert.equal(shouldPersistSunScanState("typo"), false);
  assert.equal(shouldPersistSunScanState(null), false);
});

test("admin SUN diagnostics explicitly run every processSunScan call as dry-run", async () => {
  for (const [path, expectedCalls] of ADMIN_DIAGNOSTIC_ROUTES) {
    const source = await readFile(new URL(`../src/app/admin/sun/${path}`, import.meta.url), "utf8");
    const processCalls = source.match(/processSunScan\s*\(\s*\{/g) || [];
    const dryRunOptions = source.match(/sideEffectMode:\s*["']dry_run["']/g) || [];
    assert.equal(processCalls.length, expectedCalls, `${path}: unexpected processSunScan call count`);
    assert.equal(dryRunOptions.length, expectedCalls, `${path}: every processSunScan call must be dry-run`);
  }
});

test("public, SDK, and demo scan callers retain the production persistence default", async () => {
  for (const path of PERSISTING_SCAN_CALLERS) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /processSunScan\s*\(/, `${path}: expected production processSunScan caller`);
    assert.doesNotMatch(source, /sideEffectMode:\s*["']dry_run["']/, `${path}: production caller must not opt into dry-run`);
  }
});

test("dry-run centralizes every SUN persistence sink behind the state-write gate", async () => {
  const source = await readFile(new URL("../src/lib/sun-service.ts", import.meta.url), "utf8");
  const atomicHelper = await readFile(new URL("../src/lib/sun-atomic-persistence.ts", import.meta.url), "utf8");

  assert.match(source, /const persistScanState = shouldPersistSunScanState\(input\.sideEffectMode\)/);
  assert.match(source, /if \(!persistScanState\) return \[\]/);
  assert.match(source, /if \(!persistScanState\) \{[\s\S]*?SELECT id[\s\S]*?FROM events[\s\S]*?FROM tags/);
  assert.match(source, /if \(persistScanState\) \{[\s\S]*?persistSunScanAtomically\s*\(/);
  assert.match(source, /findRegisteredSunPayload\(\{[\s\S]*?ensureSchema: persistScanState/);
  assert.match(atomicHelper, /SELECT \*[\s\S]*FROM public\.nexid_persist_sun_scan_v1/);
  assert.doesNotMatch(source, /recordTapEvent|INSERT INTO events/);

  assert.doesNotMatch(source, /CREATE TABLE IF NOT EXISTS tag_manual_tamper_overrides/);
  assert.doesNotMatch(source, /await sql\/\*sql\*\/`\s*CREATE TABLE IF NOT EXISTS sun_scan_attempts/);
  assert.doesNotMatch(source, /await sql\/\*sql\*\/`\s*INSERT INTO sun_scan_attempts/);
  assert.doesNotMatch(source, /await sql\/\*sql\*\/`\s*UPDATE tags/);

  assert.match(source, /side_effect_mode: persistScanState \? ["']persist["'] : ["']dry_run["']/);
});

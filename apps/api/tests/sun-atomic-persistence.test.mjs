import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../db/migrations/20260728120000_0062_sun_atomic_persistence.sql", import.meta.url),
  "utf8",
);
const service = await readFile(new URL("../src/lib/sun-service.ts", import.meta.url), "utf8");
const helper = await readFile(new URL("../src/lib/sun-atomic-persistence.ts", import.meta.url), "utf8");

test("SUN 0062 aborts on case-fold duplicates before adding its uniqueness guard", () => {
  const preflight = migration.indexOf("sun_atomic_tag_uid_casefold_duplicates");
  const uniqueIndex = migration.indexOf("CREATE UNIQUE INDEX IF NOT EXISTS uq_tags_batch_uid_upper");
  assert.ok(preflight >= 0 && uniqueIndex > preflight);
  assert.match(migration, /GROUP BY batch_id, UPPER\(uid_hex\)[\s\S]*HAVING COUNT\(\*\) > 1/);
  assert.doesNotMatch(migration, /DELETE FROM tags|UPDATE tags[\s\S]*SET uid_hex/);
});

test("static SUN concurrency contract serializes replay, counter, tag update and event append", () => {
  // This is source-level evidence only. A live two-connection PostgreSQL race
  // test requires an explicitly approved disposable DATABASE_URL.
  const functionStart = migration.indexOf("CREATE OR REPLACE FUNCTION public.nexid_persist_sun_scan_v1");
  const body = migration.slice(functionStart);
  const advisoryLock = body.indexOf("pg_advisory_xact_lock");
  const tagLock = body.indexOf("FOR UPDATE");
  const replayRead = body.indexOf("FROM events e");
  const tagUpdate = body.indexOf("UPDATE tags t");
  const eventInsert = body.indexOf("INSERT INTO events");
  assert.ok(functionStart >= 0);
  assert.ok(advisoryLock >= 0 && tagLock > advisoryLock);
  assert.ok(replayRead > advisoryLock && tagUpdate > replayRead && eventInsert > tagUpdate);
  assert.match(body, /hashtext\('payload:' \|\| v_picc_data_hash \|\| ':' \|\| v_cmac_hash\)/);
  assert.match(body, /hashtext\('uid:' \|\| v_uid_hex\)/);
  assert.ok(
    body.indexOf("hashtext('payload:' || v_picc_data_hash || ':' || v_cmac_hash)")
      < body.indexOf("hashtext('uid:' || v_uid_hex)"),
    "canonical payload lock must precede the optional UID lock",
  );
  assert.match(body, /v_ctr <= v_previous_last_seen_ctr/);
  assert.match(body, /v_response_result := CASE[\s\S]*WHEN v_replay_suspect THEN 'REPLAY_SUSPECT'/);
  assert.match(body, /final_result := v_event_result/);
  assert.match(body, /RETURNING events\.id, events\.created_at/);
});

test("persistent SUN scans have one fail-closed SQL boundary and consume its canonical receipt", () => {
  const calls = helper.match(/await sql\/\*sql\*\//g) || [];
  assert.equal(calls.length, 1);
  assert.match(helper, /FROM public\.nexid_persist_sun_scan_v1/);
  assert.match(helper, /rows\.length !== 1/);
  assert.doesNotMatch(helper, /catch\s*\(/);
  assert.doesNotMatch(service, /recordTapEvent|INSERT INTO events|UPDATE tags/);
  assert.match(service, /const receipt = await persistSunScanAtomically/);
  for (const assignment of [
    "result = receipt.finalResult",
    "authStatus = receipt.authStatus",
    "resolvedReason = receipt.finalReason",
    "replayOriginalEventId = receipt.replayOriginalEventId",
    "allowlisted = receipt.allowlisted",
    "tagStatus = receipt.tagStatus",
  ]) {
    assert.ok(service.includes(assignment), `${assignment} must precede the public response`);
  }
});

test("0062 delegates transaction ownership to the migration runner", () => {
  assert.doesNotMatch(migration, /^\s*(BEGIN|START\s+TRANSACTION|COMMIT|ROLLBACK)\s*;/im);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const runtimeSchema = await readFile(
  new URL("../src/lib/commercial-runtime-schema.ts", import.meta.url),
  "utf8",
);
const migration = await readFile(
  new URL("../db/migrations/20260711213000_0046_carrier_profile_family_expansion.sql", import.meta.url),
  "utf8",
);

test("carrier profile schema accepts every catalog family", () => {
  for (const family of ["qr", "gs1", "nfc", "rfid", "iot"]) {
    assert.match(runtimeSchema, new RegExp(`'${family}'`));
    assert.match(migration, new RegExp(`'${family}'`));
  }
  assert.match(migration, /DROP CONSTRAINT IF EXISTS carrier_profiles_family_check/);
  assert.match(migration, /ADD CONSTRAINT carrier_profiles_family_check/);
});

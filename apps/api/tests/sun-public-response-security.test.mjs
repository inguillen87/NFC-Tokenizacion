import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("SUN public response does not expose decrypted SDM material", async () => {
  const source = await readFile(new URL("../src/lib/sun-service.ts", import.meta.url), "utf8");

  assert.doesNotMatch(source, /picc_plain_hex\s*:/);
  assert.doesNotMatch(source, /enc_plain_hex\s*:/);
  assert.doesNotMatch(source, /picc_plain_hex_prefix\s*:/);
  assert.doesNotMatch(source, /enc_plain_hex_prefix\s*:/);
});

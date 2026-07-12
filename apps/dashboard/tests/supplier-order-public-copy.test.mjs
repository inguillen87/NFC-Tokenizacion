import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("supplier order UI uses generic enterprise examples instead of unverified company names", async () => {
  const source = await readFile(new URL("../src/components/supplier-order-console.tsx", import.meta.url), "utf8");

  assert.match(source, /placeholder="bodega-balmec o agro-enterprise-ar"/);
  assert.doesNotMatch(source, /placeholder="[^"]*syngenta/i);
  assert.doesNotMatch(source, /placeholder="[^"]*bayer/i);
});

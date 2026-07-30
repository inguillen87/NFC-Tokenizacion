import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const panel = await readFile(
  new URL("../src/app/(app)/tags/[uid]/tag-lifecycle-panel.tsx", import.meta.url),
  "utf8",
);
const page = await readFile(new URL("../src/app/(app)/tags/[uid]/page.tsx", import.meta.url), "utf8");
const proxy = await readFile(new URL("../src/app/api/admin/[...path]/route.ts", import.meta.url), "utf8");
const permissionPolicy = await readFile(new URL("../src/lib/permission-policy.ts", import.meta.url), "utf8");

test("tag passport exposes canonical lifecycle without claiming physical evidence", () => {
  assert.match(page, /<TagLifecyclePanel/);
  assert.match(panel, /No modifica las claves, el CMAC\/SDM, el contador SUN ni reemplaza la evidencia física TagTamper/);
  assert.match(panel, /expected_revision: tag\.lifecycle_revision/);
  assert.match(panel, /"idempotency-key": operationKey\(\)/);
  assert.match(panel, /tag\.allowed_transitions/);
  assert.match(panel, /Revocado es un estado final/);
});

test("dashboard admin proxy forwards explicit concurrency headers only", () => {
  assert.match(proxy, /\["idempotency-key", "x-nexid-trace-id", "if-match"\]/);
  assert.match(proxy, /forwardedHeaders\.set\(header, value\)/);
  assert.match(proxy, /Authorization: `Bearer \$\{credential\?\.bearerToken \|\| ""\}`/);
  assert.doesNotMatch(proxy, /headers:\s*req\.headers/);
});

test("dashboard proxy binds tag lifecycle reads and writes to explicit grants", () => {
  assert.match(permissionPolicy, /normalizedPath === "tags" \|\| normalizedPath\.startsWith\("tags\/"\)/);
  assert.match(permissionPolicy, /"tags:read" : "tags:write"/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../src/app/(app)/demo-lab/mobile/[tenant]/[itemId]/page.tsx", import.meta.url),
  "utf8",
);

test("mobile Demo Lab refreshes on entry, visibility and explicit user action without polling", () => {
  assert.match(source, /loadWhenVisible\(\);/);
  assert.match(source, /document\.addEventListener\("visibilitychange", onVisibilityChange\)/);
  assert.match(source, /document\.removeEventListener\("visibilitychange", onVisibilityChange\)/);
  assert.match(source, /onClick=\{\(\) => setRefreshRequest/);
  assert.match(source, />\s*Actualizar evidencia\s*</);
  assert.doesNotMatch(source, /(?:window\.)?setInterval\s*\(/);
  assert.doesNotMatch(source, /(?:window\.)?clearInterval\s*\(/);
});

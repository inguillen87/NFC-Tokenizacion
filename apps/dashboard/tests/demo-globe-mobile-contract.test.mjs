import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/app/(app)/demo-globe/page.tsx", import.meta.url), "utf8");

test("the dedicated 3D lab stays interactive on mobile viewports", () => {
  assert.match(source, /<Globe3dMap[\s\S]*mode="globe"/);
  assert.doesNotMatch(source, /<Globe3dMap[\s\S]*mode="preview"/);
});

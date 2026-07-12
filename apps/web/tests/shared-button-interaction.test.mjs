import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("shared buttons expose press, keyboard, disabled and reduced-motion states", async () => {
  const source = await readFile(new URL("../../../packages/ui/src/button.tsx", import.meta.url), "utf8");

  assert.match(source, /active:translate-y-0/);
  assert.match(source, /active:scale-\[0\.98\]/);
  assert.match(source, /focus-visible:ring-2/);
  assert.match(source, /motion-reduce:transform-none/);
  assert.match(source, /motion-reduce:transition-none/);
  assert.match(source, /disabled:pointer-events-none/);
  assert.match(source, /disabled:opacity-55/);
});

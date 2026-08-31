import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const page = fs.readFileSync(path.join(here, "../src/app/sun/page.tsx"), "utf8");

test("SUN passport prefers the public lot label and never exposes a live technical BID as a commercial lot", () => {
  assert.match(page, /displayLot\?:\s*string\s*\|\s*null/);
  assert.match(page, /lotLabel\?:\s*string\s*\|\s*null/);
  assert.match(page, /const publicLotDisplay = String\(result\.product\?\.lotLabel \|\| result\.identity\?\.displayLot \|\| ""\)\.trim\(\) \|\| null/);
  assert.match(page, /const batchDisplay = publicLotDisplay \|\| \(isDemoPreview \? bid \|\| result\.identity\?\.bid \|\| "Batch de muestra" : null\)/);
  assert.match(page, /const technicalBid = bid \|\| result\.identity\?\.bid/);
  assert.match(page, /\{batchDisplay \? \([\s\S]*?isDemoPreview \? "Batch de muestra" : "Lote"/);
  assert.match(page, /\{batchDisplay \|\| "No informado"\}/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const table = await readFile(new URL("../src/components/data-table.tsx", import.meta.url), "utf8");
const toolbar = table.slice(table.indexOf('className="data-table-toolbar'), table.indexOf("{isPending ?"));

test("table actions wrap within the available width instead of escaping a mobile viewport", () => {
  assert.match(toolbar, /data-table-toolbar flex w-full min-w-0 max-w-full flex-wrap items-center gap-2 sm:w-auto/);
  assert.doesNotMatch(toolbar, /overflow-(?:hidden|clip)|whitespace-nowrap/);
});

test("search and long status options can shrink without forcing the action row wider", () => {
  assert.match(toolbar, /<input[^\n]*className="w-full min-w-0 max-w-full[^"]*sm:w-48"/);
  assert.match(toolbar, /<select[^\n]*className="min-w-0 max-w-full /);
});

test("responsive layout preserves filtering, refresh and export callbacks", () => {
  assert.match(toolbar, /onChange=\{\(event\) => setQuery\(event\.target\.value\)\}/);
  assert.match(toolbar, /onChange=\{\(event\) => setStatus\(event\.target\.value\)\}/);
  assert.match(toolbar, /startTransition\(\(\) => router\.refresh\(\)\)/);
  assert.match(toolbar, /buildCsv\(columns, filtered\)/);
  assert.match(toolbar, /buildExcelHtml\(title, columns, filtered\)/);
  assert.match(toolbar, /window\.print\(\)/);
  assert.match(toolbar, /setQuery\(""\); setStatus\("all"\)/);
});

test("wide data cells retain their own horizontal scrolling container", () => {
  assert.match(table, /data-table-shell overflow-x-auto rounded-2xl/);
  assert.doesNotMatch(table, /data-table-shell[^"]*overflow-(?:hidden|clip)/);
});

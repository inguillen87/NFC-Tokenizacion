import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const apiRoute = new URL("../src/app/sun/route.ts", import.meta.url);
const snapshotRoute = new URL("../src/app/sun/snapshot/[diagnosticId]/route.ts", import.meta.url);
const webSunPage = new URL("../../web/src/app/sun/page.tsx", import.meta.url);

test("browser SUN taps hand off to the web passport experience with a diagnostic snapshot", async () => {
  const source = await readFile(apiRoute, "utf8");

  assert.match(source, /buildWebSunSnapshotUrl/);
  assert.match(source, /target\.searchParams\.set\("snapshot"/);
  assert.match(source, /target\.searchParams\.set\("trace"/);
  assert.match(source, /Response\.redirect\(webTarget,\s*303\)/);
  assert.match(source, /view === "api-html" \|\| view === "legacy-html"/);
});

test("web SUN page can hydrate a snapshot created by the API tap route", async () => {
  const snapshotSource = await readFile(snapshotRoute, "utf8");
  const webSource = await readFile(webSunPage, "utf8");

  assert.match(snapshotSource, /getSunDiagnosticSnapshot/);
  assert.match(snapshotSource, /snapshot_not_found/);
  assert.match(webSource, /snapshotId/);
  assert.match(webSource, /\/sun\/snapshot\//);
  assert.match(webSource, /payload\?\.contract/);
});

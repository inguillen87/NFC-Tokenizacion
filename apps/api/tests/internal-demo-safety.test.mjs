import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const resetSource = await readFile(new URL("../src/app/internal/demo/reset/route.ts", import.meta.url), "utf8");
const summarySource = await readFile(new URL("../src/app/internal/demo/summary/route.ts", import.meta.url), "utf8");

test("demo reset preserves tenant resources and deletes only demo events", () => {
  assert.doesNotMatch(resetSource, /DELETE FROM tenants/i);
  assert.match(resetSource, /DEMO_MODE/);
  assert.match(resetSource, /DEMO_ALLOW_PROD_DATA_WRITE/);
  assert.match(resetSource, /RESET \$\{DEMO_TENANT_SLUG\}\/\$\{DEMO_BATCH_ID\}/);
  assert.match(resetSource, /DELETE FROM events/);
  assert.match(resetSource, /tenant_id=\$\{tenant\.id\}/);
  assert.match(resetSource, /batch_id=\$\{batch\.id\}/);
  assert.match(resetSource, /LOWER\(COALESCE\(source, ''\)\)='demo'/);
  assert.match(resetSource, /preserved: \['tenant', 'batch', 'tags', 'crm'\]/);
});

test("demo summary never aggregates global CRM or real event rows", () => {
  assert.doesNotMatch(summarySource, /SELECT COUNT\(\*\)::int AS count FROM leads`/);
  assert.doesNotMatch(summarySource, /SELECT COUNT\(\*\)::int AS count FROM tickets`/);
  assert.doesNotMatch(summarySource, /SELECT COUNT\(\*\)::int AS count FROM order_requests`/);
  assert.match(summarySource, /leads WHERE tenant_id=\$\{tenant\.id\}/);
  assert.match(summarySource, /tickets WHERE LOWER\(source\)='demo-lab'/);
  assert.match(summarySource, /order_requests WHERE LOWER\(source\)='demo-lab'/);
  assert.match(summarySource, /LOWER\(COALESCE\(e\.source, ''\)\)='demo'/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const routeSource = await readFile(
  new URL("../src/app/admin/events/stream/route.ts", import.meta.url),
  "utf8",
);

test("SSE reconciliation queries persisted events with the original scope and a monotonic cursor", () => {
  assert.match(routeSource, /fetchRows\(\s*searchParams,\s*forcedTenantSlug,\s*sourceFilter,/);
  assert.equal((routeSource.match(/t\.slug = \$\{tenant\}/g) || []).length, 1);
  assert.equal((routeSource.match(/LOWER\(COALESCE\(e\.source::text, ''\)\)/g) || []).length, 4);
  assert.equal((routeSource.match(/e\.created_at >= now\(\) - \$\{interval\}::interval/g) || []).length, 2);
  assert.equal((routeSource.match(/e\.id > NULLIF\(\$\{afterEventId\}, ''\)::bigint/g) || []).length, 2);
  assert.match(routeSource, /reconciliationCursor = greatestPersistedEventId\(snapshotRows\)/);
  assert.match(routeSource, /reconciliationCursor = greatestPersistedEventId\(rows, startingCursor \|\| "0"\)/);
});

test("snapshot, notifications and reconciliation share one bounded event-id deduper", () => {
  assert.match(routeSource, /const seenEventIds = new Set<string>\(\)/);
  assert.match(routeSource, /seenEventIds\.size > MAX_SEEN_EVENT_IDS/);
  assert.match(routeSource, /normalizedSnapshot\.forEach\(\(row\) => rememberEvent\(row\.eventId\)\)/);
  assert.match(routeSource, /if \(!rememberEvent\(normalized\.eventId\)\) return/);
  assert.match(routeSource, /for \(const row of orderedRows\) emitTapEvent\(row\)/);
  assert.equal((routeSource.match(/emitTapEvent\(rawPayload\)/g) || []).length, 1);
});

test("reconciliation is periodic, non-overlapping and releases its guard after errors", () => {
  assert.match(routeSource, /if \(closed \|\| cancelled \|\| reconciliationInFlight\) return/);
  assert.match(routeSource, /reconciliationInFlight = true/);
  assert.match(routeSource, /finally \{\s*reconciliationInFlight = false;\s*\}/);
  assert.match(routeSource, /reconciliation = setInterval\(\(\) => \{\s*void reconcilePersistedEvents\(\);/);
  assert.match(routeSource, /REALTIME_RECONCILIATION_INTERVAL_MS/);
});

test("all SSE timers and the realtime subscription are released on shutdown", () => {
  const shutdown = routeSource.match(/const shutdown = \(closeController = true\)[\s\S]*?if \(closeController\) controller\.close\(\);\s*\};/)?.[0] || "";
  assert.match(shutdown, /clearInterval\(heartbeat\)/);
  assert.match(shutdown, /clearInterval\(reconciliation\)/);
  assert.match(shutdown, /clearTimeout\(lifetime\)/);
  assert.match(shutdown, /unsubscribe\(\)/);
  assert.match(shutdown, /removeEventListener\("abort", onAbort\)/);
});

test("database failures are logged as bounded codes without messages or connection strings", () => {
  assert.match(routeSource, /safeOperationalErrorCode\(error, "snapshot_query_failed"\)/);
  assert.match(routeSource, /safeOperationalErrorCode\(error, "reconciliation_query_failed"\)/);
  assert.doesNotMatch(routeSource, /error\.message/);
  assert.doesNotMatch(routeSource, /redacted_database_url/);
});

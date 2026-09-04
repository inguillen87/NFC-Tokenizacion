import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseAnalyticsFilters } from "../src/lib/analytics.ts";

const read = (url) => readFile(new URL(url, import.meta.url), "utf8");

test("persisted event filters map every supported window to one exact allowlisted interval", () => {
  const expected = [
    ["5m", "5 minutes"],
    ["1h", "1 hour"],
    ["24h", "24 hours"],
    ["7d", "7 days"],
    ["30d", "30 days"],
  ];

  for (const [requested, rangeSql] of expected) {
    const filters = parseAnalyticsFilters(new URLSearchParams(`range=${requested}`));
    assert.equal(filters.range, requested, requested);
    assert.equal(filters.rangeSql, rangeSql, requested);
  }

  for (const unsupported of ["", "2h", "all", "1 hour; drop table events"]) {
    const filters = parseAnalyticsFilters(new URLSearchParams({ range: unsupported }));
    assert.equal(filters.range, "30d", unsupported || "empty");
    assert.equal(filters.rangeSql, "30 days", unsupported || "empty");
  }
});

test("persisted admin events bind only the parser-produced interval across every query path", async () => {
  const [eventsRoute, streamRoute] = await Promise.all([
    read("../src/app/admin/events/route.ts"),
    read("../src/app/admin/events/stream/route.ts"),
  ]);

  assert.match(eventsRoute, /parseAnalyticsFilters\(searchParams\)/);
  assert.equal(
    (eventsRoute.match(/created_at >= now\(\) - \$\{rangeSql\}::interval/g) || []).length,
    5,
  );
  assert.doesNotMatch(eventsRoute, /\$\{\s*searchParams\.get\(["']range["']\)\s*\}/);
  assert.match(streamRoute, /"5m": "5 minutes"/);
  assert.match(streamRoute, /"1h": "1 hour"/);
  assert.match(
    streamRoute,
    /send\("snapshot", \{[\s\S]*?scope: \{ tenant: tenant \|\| "global" \},[\s\S]*?rows: normalizedSnapshot/,
  );
});

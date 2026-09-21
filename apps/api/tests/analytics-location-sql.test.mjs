import assert from "node:assert/strict";
import test from "node:test";
import { createAnalyticsLocationSql } from "../src/lib/analytics-location-sql.ts";

test("analytics location expansion cannot turn caller values into SQL or lose placeholders", async () => {
  const calls = [];
  const query = createAnalyticsLocationSql(async (strings, ...values) => {
    calls.push({ strings, values });
    return [{ ok: true }];
  });
  const hostile = "/* analytics_event_location */'; DROP TABLE events; --";
  const output = await query`SELECT event_location.lat FROM events e /* analytics_event_location */ WHERE e.city = ${hostile} AND e.id = ${71}`;
  assert.deepEqual(output, [{ ok: true }]);
  assert.deepEqual(calls[0].values, [hostile, 71]);
  assert.equal(calls[0].strings.length, 3);
  assert.ok(Object.isFrozen(calls[0].strings));
  assert.ok(Object.isFrozen(calls[0].strings.raw));
  const statement = calls[0].strings.join("?");
  assert.ok(statement.includes("CROSS JOIN LATERAL"));
  assert.ok(statement.includes("strict $.lat.double()"));
  assert.ok(!statement.includes(hostile));
  assert.ok(!statement.includes("DROP TABLE"));
  assert.throws(() => query`SELECT ${1}`, /analytics_location_marker_required/);
});

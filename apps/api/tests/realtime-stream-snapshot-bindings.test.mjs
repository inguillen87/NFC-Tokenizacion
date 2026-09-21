import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { withConsumerNetworkEventProvenance } from "../src/lib/consumer-network-provenance.ts";

import {
  REALTIME_STREAM_WINDOW_IDS,
  resolveRealtimeStreamWindow,
} from "../src/lib/realtime-stream-window.ts";

const routeSource = await readFile(
  new URL("../src/app/admin/events/stream/route.ts", import.meta.url),
  "utf8",
);
const parsedRoute = ts.createSourceFile("route.ts", routeSource, ts.ScriptTarget.ES2022, true);
const fetchRowsDeclaration = parsedRoute.statements.find(
  (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === "fetchRows",
);
assert.ok(fetchRowsDeclaration, "test the actual snapshot query builder, not a copied SQL fixture");
const compiledQueryBuilder = ts.transpileModule(fetchRowsDeclaration.getText(parsedRoute), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;

function createCapturedSnapshotQuery() {
  const calls = [];
  const sql = async (strings, ...values) => {
    calls.push({
      statement: strings.reduce((text, part, index) => text + (index ? `$${index}` : "") + part, ""),
      values,
    });
    return [];
  };
  // Only the route's private query builder is evaluated. The injected SQL
  // executor records bindings and cannot connect to PostgreSQL or the broker.
  const fetchRows = new Function("sql", "withConsumerNetworkEventProvenance", `${compiledQueryBuilder}\nreturn fetchRows;`)(sql, withConsumerNetworkEventProvenance);
  return { fetchRows, calls };
}

for (const branch of ["tenant", "global"]) {
  for (const windowId of REALTIME_STREAM_WINDOW_IDS) {
    test(`${branch} snapshot binds ${windowId} without casting an empty interval`, async () => {
      const { fetchRows, calls } = createCapturedSnapshotQuery();
      const window = resolveRealtimeStreamWindow(windowId);
      assert.ok(window);
      const forcedTenant = branch === "tenant" ? "fixture-tenant" : "";
      const rows = await fetchRows(new URLSearchParams({ limit: "18" }), window, forcedTenant, "production");

      assert.deepEqual(rows, []);
      assert.equal(calls.length, 1, "one initial read, never a polling loop");
      const { statement, values } = calls[0];
      const predicates = [...statement.matchAll(
        /AND\s+\(\$(\d+)\s*=\s*''\s+OR\s+e\.created_at\s*>=\s*now\(\)\s*-\s*NULLIF\(\$(\d+),\s*''\)::interval\)/g,
      )];
      assert.equal(predicates.length, 1, "the unlimited window must nullify its empty interval before the cast");
      const [, guardIndex, intervalIndex] = predicates[0];
      assert.equal(values[Number(guardIndex) - 1], window.interval);
      assert.equal(values[Number(intervalIndex) - 1], window.interval);
      assert.doesNotMatch(statement, /\$\d+::interval/, "no unguarded interval binding remains");
      assert.match(statement, /AND b\.tenant_id = e\.tenant_id/);
      if (branch === "tenant") {
        const tenantPredicate = statement.match(/WHERE t\.slug = \$(\d+)/);
        assert.ok(tenantPredicate);
        assert.equal(values[Number(tenantPredicate[1]) - 1], forcedTenant);
      } else {
        assert.doesNotMatch(statement, /WHERE t\.slug =/);
      }
      assert.equal(values.at(-1), 18, "the snapshot remains bounded for every window");
    });
  }
}

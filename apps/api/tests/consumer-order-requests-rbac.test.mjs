import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const route = await readFile(
  new URL("../src/app/admin/consumer-portal/order-requests/route.ts", import.meta.url),
  "utf8",
);

test("consumer order requests require the PII capability before schema or data access", () => {
  const get = route.slice(route.indexOf("export async function GET"));
  const authIndex = get.indexOf('await checkAdminWithPermission(req, "consumers.read_pii")');
  const schemaIndex = get.indexOf("await ensureConsumerPortalSchema()");
  const queryIndex = get.indexOf("await listOrderRequests(tenant)");

  assert.ok(authIndex >= 0, "missing consumers.read_pii authorization");
  assert.ok(schemaIndex > authIndex, "schema access must happen after authorization");
  assert.ok(queryIndex > schemaIndex, "order rows must be queried after authorization");
  assert.doesNotMatch(get, /await checkAdmin\(req\)/);
});

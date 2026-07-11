import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const proofSource = await readFile(new URL("../src/app/(app)/proof/page.tsx", import.meta.url), "utf8");
const batchSource = await readFile(new URL("../src/app/(app)/batches/[bid]/page.tsx", import.meta.url), "utf8");
const supplierOrderSource = await readFile(new URL("../src/app/(app)/supplier-orders/[orderId]/page.tsx", import.meta.url), "utf8");

function assertOrder(source, startMarker, firstMarker, secondMarker) {
  const start = source.indexOf(startMarker);
  const first = source.indexOf(firstMarker, start);
  const second = source.indexOf(secondMarker, start);
  assert.ok(start >= 0, `Missing start marker: ${startMarker}`);
  assert.ok(first >= start, `Missing first marker after ${startMarker}: ${firstMarker}`);
  assert.ok(second > first, `${secondMarker} must appear after ${firstMarker}`);
}

test("tenant-sensitive pages read through the authenticated dashboard BFF", () => {
  for (const source of [proofSource, batchSource, supplierOrderSource]) {
    assert.match(source, /getServerOrigin/);
    assert.match(source, /headers\(\)\)\.get\("cookie"\)/);
    assert.doesNotMatch(source, /process\.env\.ADMIN_API_KEY|\$\{API_BASE\}\/admin/);
  }

  assert.match(proofSource, /\/api\/admin\/proof\/anchors/);
  assert.match(batchSource, /\/api\/admin\/batches\/\$\{encodeURIComponent\(bid\)\}\/summary/);
  assert.match(supplierOrderSource, /\/api\/admin\/supplier-orders/);
  assert.match(proofSource, /headers: cookie \? \{ cookie \} : undefined/);
  assert.match(batchSource, /headers: cookie \? \{ cookie \} : undefined/);
  assert.match(supplierOrderSource, /headers: cookie \? \{ cookie \} : undefined/);
});

test("each page requires its dashboard session before starting its read", () => {
  assertOrder(proofSource, "export default async function ProofPage", 'await requireDashboardSession("proof:read")', "await getAnchors(");
  assertOrder(batchSource, "export default async function BatchDetailPage", 'await requireDashboardSession("batches:read")', "await getBatch(");
  assertOrder(supplierOrderSource, "export default async function SupplierOrderDetailPage", 'await requireDashboardSession("supplier_orders:read")', "await getOrderDetails(");
});

test("batch and supplier detail payloads fail closed when tenant scope does not match", () => {
  assert.match(batchSource, /session\.role === "tenant-admin" \|\| session\.role === "reseller"/);
  assert.match(batchSource, /batchTenantSlug !== normalizedTenantScope/);
  assert.match(batchSource, /isTenantScoped && !tenantScope \? null : await getBatch/);

  assert.match(supplierOrderSource, /session\.role === "tenant-admin" \|\| session\.role === "reseller"/);
  assert.match(supplierOrderSource, /orderTenantSlug !== tenantScope/);
  assert.match(supplierOrderSource, /isTenantScoped && !tenantScope \? null : await getOrderDetails/);
});

test("supplier export revalidates session and uses the same scoped BFF", () => {
  assertOrder(supplierOrderSource, '"use server"', 'await requireDashboardSession("supplier_orders:read")', "await fetch(`${actionOrigin}/api/admin/supplier-orders/");
  assert.match(supplierOrderSource, /\.\.\.\(actionCookie \? \{ cookie: actionCookie \} : \{\}\)/);
  assert.doesNotMatch(supplierOrderSource, /X-NexID-Actor|Authorization:/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { readAdminResourceResponse } = await import("../src/lib/admin-resource-read.ts");

const batchDetail = await readFile(new URL("../src/app/(app)/batches/[bid]/page.tsx", import.meta.url), "utf8");
const tagDetail = await readFile(new URL("../src/app/(app)/tags/[uid]/page.tsx", import.meta.url), "utf8");

const selectResource = (payload) => (
  payload && typeof payload === "object" && payload.ok === true && payload.resource
    ? payload.resource
    : null
);

test("admin detail response classifier reserves not_found for HTTP 404", async () => {
  const missing = await readAdminResourceResponse(
    new Response(JSON.stringify({ ok: false, reason: "missing" }), { status: 404 }),
    selectResource,
  );
  const forbidden = await readAdminResourceResponse(
    new Response(JSON.stringify({ ok: false, reason: "forbidden" }), { status: 403 }),
    selectResource,
  );
  const conflict = await readAdminResourceResponse(
    new Response(JSON.stringify({ ok: false, reason: "duplicate" }), { status: 409 }),
    selectResource,
  );

  assert.deepEqual(missing, { availability: "not_found", data: null, status: 404 });
  assert.deepEqual(forbidden, { availability: "upstream_error", data: null, status: 403 });
  assert.deepEqual(conflict, { availability: "upstream_error", data: null, status: 409 });
});

test("admin detail response classifier rejects malformed success payloads", async () => {
  const malformedJson = await readAdminResourceResponse(
    new Response("not-json", { status: 200, headers: { "content-type": "application/json" } }),
    selectResource,
  );
  const missingResource = await readAdminResourceResponse(
    new Response(JSON.stringify({ ok: true }), { status: 200 }),
    selectResource,
  );
  const ready = await readAdminResourceResponse(
    new Response(JSON.stringify({ ok: true, resource: { id: "known" } }), { status: 200 }),
    selectResource,
  );

  assert.deepEqual(malformedJson, { availability: "invalid_payload", data: null, status: 200 });
  assert.deepEqual(missingResource, { availability: "invalid_payload", data: null, status: 200 });
  assert.deepEqual(ready, { availability: "ready", data: { id: "known" }, status: 200 });
});

test("batch detail separates confirmed absence from unavailable source", () => {
  assert.match(batchDetail, /readAdminResourceResponse\(response, selectBatch\)/);
  assert.match(batchDetail, /batch-detail-not-found/);
  assert.match(batchDetail, /batch-detail-source-unavailable/);
  assert.match(batchDetail, /no significa que el BID no exista ni representa métricas en cero/);
  assert.match(batchDetail, /scope_mismatch/);
  assert.doesNotMatch(batchDetail, /if \(!response\.ok\) return null/);
});

test("tag passport withholds zero metrics when its source is unavailable", () => {
  assert.match(tagDetail, /readAdminResourceResponse\(response, selectPassport\)/);
  assert.match(tagDetail, /tag-passport-not-found/);
  assert.match(tagDetail, /tag-passport-source-unavailable/);
  assert.match(tagDetail, /No mostramos conteos, riesgo ni países como si fueran cero/);
  assert.match(tagDetail, /passportResult\.availability === "ready"/);
  assert.match(tagDetail, /const retryHref = `\/tags\/\$\{encodeURIComponent\(uid\)\}\?\$\{apiParams\.toString\(\)\}`/);
  assert.doesNotMatch(tagDetail, /if \(!response\.ok\) return null/);
});

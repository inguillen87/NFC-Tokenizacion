import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import ts from "typescript";

const code = ts.transpileModule(readFileSync(new URL("../src/app/sun/syngenta-map-geography.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const sample = { type: "FeatureCollection", features: [{ type: "Feature", properties: { name: "public geography" }, geometry: { type: "Polygon", coordinates: [] } }] };
const load = () => {
  const exports = {};
  vm.runInNewContext(code, { exports, AbortSignal, TextDecoder, Uint8Array });
  return exports.loadSyngentaMapGeography;
};

test("concurrent map/reset/theme instances share one public download without cookies or visitor coordinates", async () => {
  const request = load();
  let finish, calls = 0;
  const fetchImpl = (path, options) => {
    calls++;
    assert.equal(path, "/sun/valle-secreto/world-reference.geojson");
    assert.equal(options.credentials, "omit");
    assert.equal(options.redirect, "error");
    assert.equal(options.referrerPolicy, "no-referrer");
    assert.equal(options.cache, "force-cache");
    assert.equal(options.signal.aborted, false);
    return new Promise(resolve => { finish = resolve; });
  };
  const first = request(fetchImpl), second = request(fetchImpl);
  assert.equal(first, second);
  finish(Response.json(sample));
  assert.deepEqual(JSON.parse(JSON.stringify(await first)), sample);
  assert.equal(await request(fetchImpl), await first);
  assert.equal(calls, 1);
});

test("failed geography reads can retry and oversized or malformed payloads cannot enter the cache", async () => {
  for (const response of [Response.json({}, { status: 503 }), new Response("x".repeat(230_001)), Response.json({ type: "FeatureCollection", features: [] }), new Response("not JSON")]) {
    const request = load();
    await assert.rejects(request(async () => response));
    await assert.doesNotReject(request(async () => Response.json(sample)));
  }
});

test("a stuck response body has a bounded deadline and its reader is cancelled", async () => {
  const request = load();
  let cancelled = false;
  const keepAlive = setTimeout(() => {}, 200);
  try {
    await assert.rejects(request(async () => new Response(new ReadableStream({ start() {}, cancel() { cancelled = true; } })), 10), /reference_map_timeout/);
    assert.equal(cancelled, true);
    await assert.doesNotReject(request(async () => Response.json(sample)));
  } finally { clearTimeout(keepAlive); }
});

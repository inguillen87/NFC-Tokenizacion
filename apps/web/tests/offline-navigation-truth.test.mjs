import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
const origin = "https://web.example.test";
const sunPath = "/sun?v=1&bid=PILOT-2026-001&picc_data=0011223344556677&enc=00112233445566778899AABBCCDDEEFF&cmac=0011223344556677";

// A local IDB event/transaction simulation, not a browser persistence certificate.
// Writes become visible only on transaction completion, never on put() alone.
function worker({ storageFailure, cachedOffline = false, responseStatus, cacheNames = [] } = {}) {
  const records = new Map();
  const retainedCaches = new Set(cacheNames);
  const notifications = [];
  const handlers = new Map();
  const stats = { opens: 0, closes: 0, putAttempts: 0, commits: 0, claims: 0 };
  const database = {
    close() { stats.closes += 1; },
    transaction() {
      const transaction = new EventTarget();
      const staged = new Map();
      const request = (result) => {
        const event = new EventTarget();
        queueMicrotask(() => {
          event.result = result;
          event.dispatchEvent(new Event("success"));
          setImmediate(() => {
            if (storageFailure === "write" && staged.size) {
              transaction.error = new Error("synthetic_transaction_aborted");
              transaction.dispatchEvent(new Event("abort"));
            } else {
              for (const [id, record] of staged) records.set(id, structuredClone(record));
              stats.commits += staged.size;
              transaction.dispatchEvent(new Event("complete"));
            }
          });
        });
        return event;
      };
      transaction.objectStore = () => ({
        get: (id) => request(records.get(id)),
        getAll: () => request([...records.values()]),
        put(record) { stats.putAttempts += 1; staged.set(record.id, record); },
        delete() { throw new Error("unexpected_prune_in_fresh_fixture"); },
      });
      return transaction;
    },
  };
  const indexedDB = {
    open() {
      stats.opens += 1;
      const request = new EventTarget();
      queueMicrotask(() => {
        request.result = database;
        request.error = new Error("synthetic_storage_unavailable");
        request.dispatchEvent(new Event(storageFailure === "open" ? "error" : "success"));
      });
      return request;
    },
  };
  const context = vm.createContext({
    AbortController, Error, Promise, Request, Response, Set, TextEncoder, URL, URLSearchParams,
    clearTimeout, crypto, indexedDB, setTimeout,
    fetch: async () => {
      if (responseStatus !== undefined) return new Response("network response", { status: responseStatus });
      throw new Error("synthetic_network_unavailable");
    },
    caches: {
      match: async (path) => cachedOffline && path === "/offline" ? new Response("cached offline page") : undefined,
      keys: async () => [...retainedCaches],
      delete: async (name) => retainedCaches.delete(name),
    },
    self: {
      location: { origin },
      addEventListener: (type, handler) => handlers.set(type, handler),
      clients: { claim() { stats.claims += 1; }, matchAll: async () => [{ postMessage: (message) => notifications.push(message.type) }] },
      skipWaiting() {},
    },
  });
  vm.runInContext(source, context);
  return {
    records, stats, notifications, retainedCaches,
    currentCache: vm.runInContext("CACHE_NAME", context),
    async activate() {
      let completion;
      handlers.get("activate")({ waitUntil(value) { completion = value; } });
      await completion;
    },
    async navigate(path) {
      let response;
      handlers.get("fetch")({
        request: { method: "GET", mode: "navigate", url: new URL(path, origin).href },
        respondWith(value) { response = value; },
      });
      assert.ok(response, "the real navigation handler must answer");
      return response;
    },
  };
}

async function assertNeutralFallback(response) {
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  const html = await response.text();
  assert.match(html, /href="\/offline"/);
  assert.doesNotMatch(html, /La lectura se guardó|El tap quedó guardado|Verificación pendiente/);
}

test("unrelated failed navigations never capture a reading and use a neutral emergency page", async () => {
  for (const path of ["/me/products", "/login", "/offline", "/offline/certificate"]) {
    const runtime = worker();
    await assertNeutralFallback(await runtime.navigate(path));
    assert.equal(runtime.stats.opens, 0);
    assert.equal(runtime.records.size, 0);
  }
});

test("a cached offline page is reused without fabricating a capture", async () => {
  const runtime = worker({ cachedOffline: true });
  assert.equal(await (await runtime.navigate("/me/products")).text(), "cached offline page");
  assert.equal(runtime.stats.opens, 0);
  assert.equal(runtime.stats.commits, 0);
});

test("invalid SUN input cannot produce a saved capture", async () => {
  const runtime = worker();
  const response = await runtime.navigate("/sun?bid=PILOT-2026-001");
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), `${origin}/offline?capture=invalid`);
  assert.equal(runtime.stats.opens, 0);
  assert.equal(runtime.records.size, 0);
});

for (const storageFailure of ["open", "write"]) {
  test(`SUN storage ${storageFailure} failure never returns a successful capture`, async () => {
    const runtime = worker({ storageFailure });
    const response = await runtime.navigate(sunPath);
    assert.equal(response.headers.get("location"), `${origin}/offline?capture=invalid`);
    assert.equal(runtime.stats.opens, 1);
    assert.equal(runtime.stats.putAttempts, storageFailure === "write" ? 1 : 0);
    assert.equal(runtime.stats.commits, 0);
    assert.equal(runtime.records.size, 0);
    assert.deepEqual(runtime.notifications, []);
    assert.equal(runtime.stats.closes, storageFailure === "write" ? 1 : 0);
    await assertNeutralFallback(await runtime.navigate("/offline"));
  });
}

test("a committed SUN capture, deduplication and terminal verdict survive unchanged", async () => {
  const runtime = worker();
  const response = await runtime.navigate(sunPath);
  const target = new URL(response.headers.get("location"));
  const id = target.searchParams.get("capture");
  assert.equal(target.origin, origin);
  assert.equal(target.pathname, "/offline");
  assert.match(id, /^[0-9a-f]{64}$/);
  assert.equal(runtime.stats.commits, 1);
  assert.equal(runtime.records.size, 1);
  assert.equal(runtime.records.get(id).status, "PENDING_BACKEND_VERIFICATION");
  assert.equal(runtime.records.get(id).attempts, 0);
  assert.equal(runtime.records.get(id).duplicateCount, 0);
  assert.deepEqual(runtime.notifications, ["NEXID_OFFLINE_QUEUE_UPDATED"]);
  runtime.records.set(id, { ...runtime.records.get(id), status: "SYNCED_VALID" });
  const duplicate = await runtime.navigate(sunPath);
  assert.equal(duplicate.headers.get("location"), target.href);
  assert.equal(runtime.records.size, 1);
  assert.equal(runtime.records.get(id).status, "SYNCED_VALID");
  assert.equal(runtime.records.get(id).duplicateCount, 1);
  assert.equal(runtime.stats.closes, 2);
});

test("a successful network navigation bypasses offline capture", async () => {
  const runtime = worker({ responseStatus: 200 });
  assert.equal((await runtime.navigate(sunPath)).status, 200);
  assert.equal(runtime.stats.opens, 0);
  assert.equal(runtime.records.size, 0);
});

test("activation replaces previous app shells, retains the current cache and leaves local readings untouched", async () => {
  const runtime = worker({ cacheNames: ["nexid-v6"] });
  runtime.retainedCaches.add(runtime.currentCache);
  const stored = { id: "synthetic-existing-reading", status: "PENDING_BACKEND_VERIFICATION" };
  runtime.records.set(stored.id, stored);
  await runtime.activate();
  assert.deepEqual([...runtime.retainedCaches], [runtime.currentCache]);
  assert.equal(runtime.stats.claims, 1);
  assert.equal(runtime.stats.opens, 0);
  assert.equal(runtime.stats.commits, 0);
  assert.deepEqual([...runtime.records.values()], [stored]);
});

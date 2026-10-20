import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
function compile(source, modules, environment = {}) {
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", "navigator", "indexedDB", "window", "fetch", js)(
    (name) => Object.hasOwn(modules, name) ? modules[name] : require(name), loaded, loaded.exports,
    environment.navigator, environment.indexedDB, environment.window, environment.fetch,
  );
  return loaded.exports;
}
const contract = compile(read("../src/lib/offline-sun-contract.ts"), {});
const source = read("../src/app/offline/offline-queue-client.tsx");
const record = (status = "PENDING_BACKEND_VERIFICATION", extra = {}) => ({
  id: "a".repeat(64), schemaVersion: 1,
  params: { bid: "PILOT-2026-001", v: "1", picc_data: "0011223344556677", enc: "00112233445566778899AABBCCDDEEFF", cmac: "0011223344556677" },
  capturedAt: "2026-10-17T12:00:00.000Z", duplicateCount: 0, attempts: 0, status, ...extra,
});
const tick = () => new Promise(setImmediate);

// Execute the actual client refresh/effect and render its result with React SSR.
// Hook state, connectivity and storage are synthetic; this is not browser/IDB QA.
function client({ list = async () => [], supported = true } = {}) {
  const state = [];
  const effects = new Map();
  const messages = new Map();
  const calls = { reads: 0, writes: 0, network: 0 };
  let cursor = 0;
  let tree;
  const hooks = {
    ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial;
      return [state[index], (value) => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = { current: initial };
      return state[index];
    },
    useCallback: (callback) => callback,
    useEffect(effect) { const index = cursor++; if (!effects.has(index)) effects.set(index, effect); },
  };
  const icon = () => null;
  const { OfflineQueueClient } = compile(source, {
    react: hooks,
    "lucide-react": Object.fromEntries(["AlertTriangle", "CheckCircle2", "Clock3", "RefreshCw", "ShieldAlert", "Trash2", "Wifi", "WifiOff", "XCircle"].map((name) => [name, icon])),
    "next/link": { __esModule: true, default: ({ children, prefetch: _prefetch, ...props }) => React.createElement("a", props, children) },
    "../../components/brand-home-link": { BrandHomeLink: () => React.createElement("a", { href: "/" }, "nexID") },
    "../../lib/offline-sun-contract": contract,
    "./offline-store": {
      listOfflineSunRecords: async () => { calls.reads += 1; return list(); },
      getOfflinePublicProduct: async () => null,
      cacheOfflinePublicProduct: async () => { calls.writes += 1; },
      putOfflineSunRecord: async () => { calls.writes += 1; },
      removeOfflineSunRecord: async () => { calls.writes += 1; },
    },
  }, {
    indexedDB: supported ? {} : undefined,
    navigator: { onLine: false, serviceWorker: { addEventListener: (type, handler) => messages.set(type, handler), removeEventListener() {} } },
    window: { addEventListener() {}, removeEventListener() {} },
    fetch: async () => { calls.network += 1; throw new Error("unexpected_network"); },
  });
  const render = () => { cursor = 0; tree = OfflineQueueClient(); return renderToStaticMarkup(tree); };
  return {
    calls, render,
    get tree() { return tree; },
    async mount() { for (const effect of effects.values()) effect(); await tick(); return render(); },
    async refresh() { messages.get("message")({ data: { type: "NEXID_OFFLINE_QUEUE_UPDATED" } }); await tick(); return render(); },
  };
}

function counts(html) {
  return ["Guardados", "Por sincronizar"].map((label) => html.match(new RegExp(`<span[^>]*>${label}</span><strong[^>]*>([^<]*)</strong>`))?.[1]);
}
function assertNoReadingClaim(html) {
  assert.doesNotMatch(html, /<article|La lectura está guardada|Encontramos [1-9]|El tap quedó guardado|La información pública está disponible/);
}
function findElement(tree, predicate) {
  if (!React.isValidElement(tree)) return null;
  if (predicate(tree)) return tree;
  for (const child of React.Children.toArray(tree.props.children)) {
    const found = findElement(child, predicate);
    if (found) return found;
  }
  return null;
}

test("initial rendering reports unknown counts and no saved or pending reading before storage is read", () => {
  const subject = client();
  const html = subject.render();
  assertNoReadingClaim(html);
  assert.deepEqual(counts(html), ["—", "—"]);
  assert.match(html, /aria-busy="true"/);
  assert.equal(subject.calls.reads, 0);
});

test("an observed empty store shows zero, without claiming that a tap or public product was saved", async () => {
  const subject = client();
  subject.render();
  const html = await subject.mount();
  assertNoReadingClaim(html);
  assert.deepEqual(counts(html), ["0", "0"]);
  assert.match(html, /No hay lecturas guardadas/);
  assert.equal(subject.calls.reads, 1);
  assert.equal(subject.calls.writes, 0);
  assert.equal(subject.calls.network, 0);
});

for (const supported of [false, true]) {
  test(`${supported ? "failed" : "unsupported"} storage remains unavailable, never a confirmed empty store`, async () => {
    const subject = client({ supported, list: async () => { throw new Error("synthetic_storage_failure"); } });
    subject.render();
    const html = await subject.mount();
    assertNoReadingClaim(html);
    assert.deepEqual(counts(html), ["—", "—"]);
    assert.match(html, /No podemos confirmar si hay lecturas guardadas/);
    assert.doesNotMatch(html, /No hay lecturas guardadas|No encontramos lecturas guardadas/);
    assert.equal(subject.calls.reads, supported ? 1 : 0);
    assert.equal(subject.calls.writes, 0);
    assert.equal(subject.calls.network, 0);
  });
}

test("confirmed saved readings drive counts and status, while public information needs an actual cached product", async () => {
  let records = [record()];
  const subject = client({ list: async () => records });
  subject.render();
  const html = await subject.mount();
  assert.deepEqual(counts(html), ["1", "1"]);
  assert.equal((html.match(/<article/g) || []).length, 1);
  assert.match(html, /La lectura está guardada en este dispositivo/);
  assert.doesNotMatch(html, /Información pública guardada|La información pública está disponible/);
  records = [record("SYNCED_VALID", { publicProduct: { bid: "PILOT-2026-001", name: "Producto sintético", cachedAt: "2026-10-17T12:00:00.000Z" } })];
  const verified = await subject.refresh();
  assert.deepEqual(counts(verified), ["1", "0"]);
  assert.match(verified, /Validación online completada/);
  assert.match(verified, /Información pública guardada/);
  assert.match(verified, /Producto sintético/);
  assert.doesNotMatch(verified, /VERIFICATION_PENDING|PENDING_BACKEND_VERIFICATION|SYNCED_VALID|backend|SUN\/CMAC/);
  assert.equal(subject.calls.writes, 0);
  assert.equal(subject.calls.network, 0);
});

test("a subsequent storage read failure clears unconfirmed counts and stale reading claims", async () => {
  let fail = false;
  const subject = client({ list: async () => { if (fail) throw new Error("synthetic_read_failure"); return [record()]; } });
  subject.render();
  assert.deepEqual(counts(await subject.mount()), ["1", "1"]);
  fail = true;
  const html = await subject.refresh();
  assertNoReadingClaim(html);
  assert.deepEqual(counts(html), ["—", "—"]);
  assert.match(html, /No pudimos consultar tus lecturas/);
});

test("the storage recovery action reads again, shows progress and recovers without sync or writes", async () => {
  let finishRetry;
  let reads = 0;
  const subject = client({ list: async () => {
    reads += 1;
    if (reads === 1) throw new Error("synthetic_initial_read_failure");
    return new Promise((resolve) => { finishRetry = resolve; });
  } });
  subject.render();
  await subject.mount();
  const button = findElement(subject.tree, (node) => node.type === "button" && node.props.children === "Volver a consultar");
  assert.ok(button, "the actual rendered recovery button must expose the read action");
  button.props.onClick();
  const loading = subject.render();
  assert.match(loading, /aria-busy="true"/);
  assert.deepEqual(counts(loading), ["—", "—"]);
  assertNoReadingClaim(loading);
  assert.equal(subject.calls.reads, 2);
  finishRetry([record()]);
  await tick();
  const recovered = subject.render();
  assert.deepEqual(counts(recovered), ["1", "1"]);
  assert.equal((recovered.match(/<article/g) || []).length, 1);
  assert.doesNotMatch(recovered, /Volver a consultar/);
  assert.equal(subject.calls.writes, 0);
  assert.equal(subject.calls.network, 0);
});

test("a slow earlier read cannot overwrite a newer storage failure, and a later successful read can recover", async () => {
  let finishFirst;
  let reads = 0;
  const first = new Promise((resolve) => { finishFirst = resolve; });
  const subject = client({ list: async () => {
    reads += 1;
    if (reads === 1) return first;
    if (reads === 2) throw new Error("synthetic_newer_read_failure");
    return [record()];
  } });
  subject.render();
  assert.deepEqual(counts(await subject.mount()), ["—", "—"]);
  assertNoReadingClaim(await subject.refresh());
  finishFirst([record()]);
  await tick();
  const stale = subject.render();
  assertNoReadingClaim(stale);
  assert.deepEqual(counts(stale), ["—", "—"]);
  assert.match(stale, /No pudimos consultar tus lecturas/);
  assert.deepEqual(counts(await subject.refresh()), ["1", "1"]);
});

test("every persisted status keeps its verdict and retry classification without rendering internal codes", async () => {
  for (const status of contract.OFFLINE_SUN_STATUSES) {
    const subject = client({ list: async () => [record(status)] });
    subject.render();
    const html = await subject.mount();
    assert.deepEqual(counts(html), ["1", contract.isTerminalOfflineSunStatus(status) ? "0" : "1"]);
    assert.equal((html.match(/<article/g) || []).length, 1);
    assert.doesNotMatch(html, new RegExp(`${status}|VERIFICATION_PENDING|backend|SUN/CMAC|Offline Level 1`));
    assert.equal(subject.calls.writes, 0);
    assert.equal(subject.calls.network, 0);
  }
});

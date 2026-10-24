import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const clientSource = read("../src/app/offline/certificate/offline-certificate-client.tsx");
const verifierSource = read("../src/lib/offline-public-certificate.ts");
const RealDate = Date;
const realDelay = ms => new Promise(resolve => setTimeout(resolve, ms));
const NOW = Date.parse("2026-10-21T12:00:00.000Z");
const gtin = prefix => {
  const sum = [...prefix].reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 3 : 1), 0);
  return `${prefix}${(10 - sum % 10) % 10}`;
};
const A = { gtin: gtin("0000000000001"), lot: "QA-LOT-A", serial: "QA-SER-A" };
const B = { gtin: gtin("0000000000002"), lot: "QA-LOT-B", serial: "QA-SER-B" };
const queryFor = lookup => new URLSearchParams(lookup).toString();
const keyFor = lookup => `nexid:offline-public-certificate:v1:${lookup.gtin}:${encodeURIComponent(lookup.lot)}:${encodeURIComponent(lookup.serial)}`;

function compile(source, modules, environment = {}) {
  const loaded = { exports: {} };
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  new Function("require", "module", "exports", "navigator", "window", "document", "localStorage", "fetch", "Date", "globalThis", js)(
    name => Object.hasOwn(modules, name) ? modules[name] : require(name), loaded, loaded.exports,
    environment.navigator, environment.window, environment.document, environment.localStorage, environment.fetch,
    environment.Date || RealDate, { crypto: webcrypto },
  );
  return loaded.exports;
}

const originalVerifier = compile(verifierSource, {});
let ephemeralKey;
async function certificate(lookup = A, changes = {}) {
  // A fresh in-memory QA key signs only fictional public product data. It is
  // never loaded from environment, exported privately, persisted or sent out.
  ephemeralKey ||= webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const key = await ephemeralKey;
  const kid = "qa-ephemeral-certificate-recovery";
  const publicKey = { ...await webcrypto.subtle.exportKey("jwk", key.publicKey), kid, use: "sig", alg: "ES256", key_ops: ["verify"] };
  const payload = {
    schema_version: originalVerifier.OFFLINE_PUBLIC_CERTIFICATE_PROFILE,
    scope: "PUBLIC_PRODUCT_INFORMATION", issuer: "https://api.example.test", tenant_slug: "qa-fictional",
    product_id: `https://id.nexid.lat/01/${lookup.gtin}${lookup.lot ? `/10/${encodeURIComponent(lookup.lot)}` : ""}${lookup.serial ? `/21/${encodeURIComponent(lookup.serial)}` : ""}`,
    batch_id: "QA-FICTIONAL-BATCH", gtin: lookup.gtin,
    ...(lookup.lot ? { lot: lookup.lot } : {}), ...(lookup.serial ? { serial: lookup.serial } : {}),
    issued_at: new RealDate(NOW - 60_000).toISOString(), expires_at: new RealDate(NOW + 60_000).toISOString(),
    public_data: { display_name: `QA product ${lookup.gtin}`, brand: "QA Fictional" },
    assurance: { public_information_signature: "VERIFIABLE_OFFLINE", nfc_sun_freshness: "NOT_EVALUATED", physical_authenticity: "NOT_ASSERTED" },
    ...changes,
  };
  const canonical = originalVerifier.canonicalizeOfflineCertificateJson;
  const encode = value => Buffer.from(value).toString("base64url");
  const protectedValue = encode(canonical({ alg: "ES256", kid, typ: originalVerifier.OFFLINE_PUBLIC_CERTIFICATE_TYPE, cty: "application/json", schema: originalVerifier.OFFLINE_PUBLIC_CERTIFICATE_PROFILE }));
  const payloadJson = canonical(payload);
  const signature = await webcrypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key.privateKey, new TextEncoder().encode(`${protectedValue}.${encode(payloadJson)}`));
  const digest = await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(payloadJson));
  return {
    schemaVersion: 1, storedAt: new RealDate(NOW).toISOString(), jwks: { keys: [publicKey] },
    envelope: { schema_version: originalVerifier.OFFLINE_PUBLIC_CERTIFICATE_PROFILE, alg: "ES256", kid, jwks_url: `${payload.issuer}/public/offline-certificates/jwks`, protected: protectedValue, payload, payload_hash: `sha256-${encode(new Uint8Array(digest))}`, signature: encode(new Uint8Array(signature)) },
  };
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
function textOf(value) {
  if (value == null || typeof value === "boolean") return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(textOf).join("");
  return React.isValidElement(value) ? textOf(value.props.children) : "";
}

// Execute the original client and original ES256 verifier. React hooks, clock,
// public storage and transport are deterministic adapters; these focal tests
// do not establish browser persistence, deployed API or physical NFC operation.
function fixture({ lookup = A, online = false, saved = [], fetch: fetchImplementation, storageReadThrows = false, storageWriteThrows = false, serverRendering = false } = {}) {
  let search = new URLSearchParams(queryFor(lookup)), cursor = 0, now = NOW, disposed = false, tree;
  let timerId = 0;
  const cells = [], effects = [], queued = new Map(), timers = new Map(), windowListeners = new Map(), documentListeners = new Map();
  const values = new Map(saved.map(([requested, stored]) => [keyFor(requested), JSON.stringify(stored)]));
  const calls = { fetch: [], storageWrites: [], lateStateWrites: 0 };
  const callbackTasks = [];
  class ClockDate extends RealDate { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const memo = (create, deps) => {
    const index = cursor++, previous = cells[index];
    if (!previous || deps.some((value, offset) => !Object.is(value, previous.deps[offset]))) cells[index] = { deps, value: create() };
    return cells[index].value;
  };
  const hooks = {
    ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in cells)) cells[index] = typeof initial === "function" ? initial() : initial;
      return [cells[index], value => { if (disposed) calls.lateStateWrites += 1; cells[index] = typeof value === "function" ? value(cells[index]) : value; }];
    },
    useRef(initial) { const index = cursor++; if (!(index in cells)) cells[index] = { current: initial }; return cells[index]; },
    useMemo: memo,
    useCallback(callback, deps) {
      return memo(() => (...args) => {
        const task = callback(...args);
        if (task && typeof task.then === "function") callbackTasks.push(task);
        return task;
      }, deps);
    },
    useEffect(effect, deps) {
      const index = cursor++, previous = effects[index];
      if (!previous || deps.some((value, offset) => !Object.is(value, previous.deps[offset]))) {
        queued.set(index, () => { effects[index]?.cleanup?.(); effects[index] = { deps, cleanup: effect() }; });
      }
    },
  };
  const listen = (collection, type, handler) => { if (!collection.has(type)) collection.set(type, new Set()); collection.get(type).add(handler); };
  const navigator = { onLine: online };
  const window = {
    setTimeout(handler, delay) { const id = ++timerId; timers.set(id, { at: now + delay, handler }); return id; },
    clearTimeout(id) { timers.delete(id); },
    addEventListener: (type, handler) => listen(windowListeners, type, handler),
    removeEventListener: (type, handler) => windowListeners.get(type)?.delete(handler),
  };
  const document = {
    visibilityState: "visible",
    addEventListener: (type, handler) => listen(documentListeners, type, handler),
    removeEventListener: (type, handler) => documentListeners.get(type)?.delete(handler),
  };
  const localStorage = {
    getItem(key) { if (storageReadThrows) throw Error("synthetic_storage_read_denied"); return values.get(key) || null; },
    setItem(key, value) { calls.storageWrites.push({ key, value }); if (storageWriteThrows) throw Error("synthetic_storage_write_denied"); values.set(key, value); },
  };
  const fetch = async (url, options) => {
    calls.fetch.push({ url, options });
    if (!fetchImplementation) throw Error("unexpected_transport");
    return fetchImplementation(url, options);
  };
  const verifier = compile(verifierSource, {}, { Date: ClockDate });
  const icon = () => null;
  const { OfflineCertificateClient } = compile(clientSource, {
    react: serverRendering ? React : hooks,
    "next/navigation": { useSearchParams: () => search },
    "next/link": { __esModule: true, default: ({ children, prefetch: _prefetch, ...props }) => React.createElement("a", props, children) },
    "lucide-react": Object.fromEntries(["AlertTriangle", "CheckCircle2", "Download", "RefreshCw", "ShieldCheck", "WifiOff", "XCircle"].map(name => [name, icon])),
    "@product/config": { productUrls: { api: "https://api.example.test" } },
    "../../../components/brand-home-link": { BrandHomeLink: () => React.createElement("a", { href: "/" }, "nexID") },
    "../../../lib/offline-public-certificate": verifier,
    "./offline-certificate-client.module.css": { __esModule: true, default: { page: "qa-certificate-page", focusAction: "qa-certificate-focus-action" } },
  }, { navigator, window, document, localStorage, fetch, Date: ClockDate });
  const render = ({ flush = true } = {}) => {
    cursor = 0;
    tree = serverRendering ? React.createElement(OfflineCertificateClient) : OfflineCertificateClient();
    const html = renderToStaticMarkup(tree);
    if (flush) { const work = [...queued.values()]; queued.clear(); work.forEach(effect => effect()); }
    return html;
  };
  return {
    calls, navigator, timers, values,
    render,
    async settleCallbacks() {
      // Await the original callbacks through their finally blocks, including WebCrypto.
      for (const task of callbackTasks) await task;
    },
    async until(predicate) {
      for (let count = 0; count < 2_000; count += 1) {
        const html = render();
        if (predicate(html)) return html;
        await realDelay(1);
      }
      assert.fail("original client did not reach expected focal state");
    },
    setQuery(lookup) { search = new URLSearchParams(typeof lookup === "string" ? lookup : queryFor(lookup)); },
    setOnline(value) { navigator.onLine = value; for (const handler of windowListeners.get(value ? "online" : "offline") || []) handler(); },
    click(label) { render(); const button = findElement(tree, node => node.type === "button" && textOf(node.props.children).includes(label)); assert(button, `button ${label} must exist`); assert.notEqual(button.props.disabled, true); button.props.onClick(); },
    advance(ms) { now += ms; for (const [id, timer] of [...timers].sort((left, right) => left[1].at - right[1].at)) { if (timer.at <= now && timers.has(id)) { timers.delete(id); timer.handler(); } } },
    visibleAfter(ms) { now += ms; for (const handler of documentListeners.get("visibilitychange") || []) handler(); },
    dispose() { disposed = true; effects.forEach(effect => effect?.cleanup?.()); },
    activeListeners() { return [...windowListeners.values(), ...documentListeners.values()].reduce((total, set) => total + set.size, 0); },
  };
}

function responseFor(stored, url) {
  return new Response(JSON.stringify(url.endsWith("/jwks") ? stored.jwks : { certificate: stored.envelope }), { status: 200, headers: { "content-type": "application/json" } });
}
function assertNoVerified(html) { assert.doesNotMatch(html, /Información pública verificada|Firma digital válida|Descargar certificado/); }

test("cached query-free SSR and the first client render stay identical for every GS1 query", () => {
  const absent = { gtin: "", lot: "", serial: "" };
  const shell = fixture({ lookup: absent, serverRendering: true });
  const shellHtml = shell.render({ flush: false });
  assert.match(shellHtml, /Comprobando certificado/);
  assertNoVerified(shellHtml);
  for (const lookup of [A, B, { ...A, gtin: "invalid" }, absent]) {
    const server = fixture({ lookup, serverRendering: true });
    const client = fixture({ lookup });
    assert.equal(server.render({ flush: false }), shellHtml,
      "real React SSR must not vary the cached public markup with the query");
    assert.equal(client.render({ flush: false }), shellHtml,
      "the first adapted client render must match the query-free cached shell before mount");
    assert.equal(client.calls.fetch.length, 0);
    assert.equal(client.calls.storageWrites.length, 0);
    server.dispose(); client.dispose();
  }
  shell.dispose();
});

test("the initial invalid or missing query becomes non-busy only after mounting and never verifies", () => {
  for (const lookup of [{ gtin: "", lot: "", serial: "" }, { ...A, gtin: "invalid" }]) {
    const subject = fixture({ lookup });
    const first = subject.render({ flush: false });
    assert.match(first, /Comprobando certificado/);
    assert.doesNotMatch(first, /Identificador GS1 inválido/);
    subject.render();
    const mounted = subject.render();
    assert.match(mounted, /Identificador GS1 inválido o incompleto/);
    assertNoVerified(mounted); assert.doesNotMatch(mounted, /aria-busy="true"/);
    assert.equal(subject.calls.fetch.length, 0);
    assert.equal(subject.calls.storageWrites.length, 0);
    subject.dispose();
  }
});

test("a query changed before mount verifies only its current copy and removal clears it immediately", async () => {
  const first = await certificate(A), second = await certificate(B);
  const subject = fixture({ lookup: A, saved: [[A, first], [B, second]] });
  const firstHtml = subject.render({ flush: false });
  subject.setQuery(B);
  assert.equal(subject.render({ flush: false }), firstHtml,
    "a pre-mount query change keeps the same neutral hydration markup");
  subject.render();
  const current = await subject.until(html => html.includes(`QA product ${B.gtin}`));
  assert.doesNotMatch(current, new RegExp(`QA product ${A.gtin}`));
  assert.equal(subject.calls.fetch.length, 0);
  assert.equal(subject.calls.storageWrites.length, 0);
  subject.setQuery("");
  const removed = subject.render({ flush: false });
  assertNoVerified(removed);
  assert.match(removed, /Identificador GS1 inválido o incompleto/);
  assert.doesNotMatch(removed, new RegExp(`QA product ${B.gtin}`));
  subject.render(); subject.dispose();
});

test("a valid GS1 copy verifies with original WebCrypto offline and sends no request", async () => {
  const stored = await certificate();
  const subject = fixture({ saved: [[A, stored]] }); subject.render();
  const html = await subject.until(html => html.includes("Información pública verificada"));
  assert.equal(subject.calls.fetch.length, 0, "a verified local copy while offline must not trigger API requests");
  assert.match(html, /Sin conexión/); assert.match(html, /Comprobar copia local/);
  assert.match(html, /No comprueba el estado físico del producto ni una nueva lectura NFC/);
  assert.match(html, /Cómo se verificó/); assert.doesNotMatch(html, /Offline Level 4|SUN\/SDM y replay|backend|claim/);
  assert.equal(subject.calls.storageWrites.length, 0);
  subject.click("Comprobar copia local"); await subject.until(html => html.includes("Información pública verificada"));
  assert.equal(subject.calls.fetch.length, 0); subject.dispose(); assert.equal(subject.activeListeners(), 0); assert.equal(subject.timers.size, 0);
});

test("a missing or inaccessible local copy stays unavailable offline, without network or false verification", async () => {
  for (const storageReadThrows of [false, true]) {
    const subject = fixture({ storageReadThrows }); subject.render();
    const html = await subject.until(html => html.includes("No hay conexión ni un certificado local vigente"));
    assertNoVerified(html); assert.match(html, /Volver a comprobar/); assert.equal(subject.calls.fetch.length, 0); subject.dispose();
  }
});

test("real signature failure and real expiry remain unverified with a clear recovery message", async () => {
  const altered = await certificate(); altered.envelope.payload.public_data.brand = "QA altered after signature";
  const expired = await certificate(A, { issued_at: new RealDate(NOW - 600_000).toISOString(), expires_at: new RealDate(NOW - 360_000).toISOString() });
  for (const [stored, message] of [[altered, /No pudimos comprobar la firma/], [expired, /certificado guardado venció/]]) {
    const subject = fixture({ saved: [[A, stored]] }); subject.render();
    const html = await subject.until(html => html.includes("No hay conexión ni un certificado local vigente"));
    assertNoVerified(html); assert.match(html, message); assert.doesNotMatch(html, /signature_invalid|expired/); assert.equal(subject.calls.fetch.length, 0); subject.dispose();
  }
});

test("a genuine signature for another GTIN, lot or serial cannot satisfy this exact lookup", async () => {
  for (const [requested, signed] of [[A, { ...A, gtin: B.gtin }], [A, { ...A, lot: B.lot }], [A, { ...A, serial: B.serial }], [{ gtin: A.gtin, lot: "", serial: "" }, A]]) {
    const stored = await certificate(signed);
    const verified = await originalVerifier.verifyOfflinePublicCertificate(stored.envelope, stored.jwks, { now: new RealDate(NOW) });
    assert.equal(verified.valid, true, "the original signature is valid independently of the requested identity");
    const subject = fixture({ lookup: requested, saved: [[requested, stored]] }); subject.render();
    const html = await subject.until(html => html.includes("no corresponde al producto, lote o serie"));
    assertNoVerified(html); assert.equal(subject.calls.fetch.length, 0); assert.equal(subject.calls.storageWrites.length, 0); subject.dispose();
  }
});

test("a network certificate for a different signed identity is not displayed or saved", async () => {
  const stored = await certificate(B);
  const subject = fixture({ online: true, fetch: url => responseFor(stored, url) }); subject.render();
  const html = await subject.until(html => html.includes("no corresponde al producto, lote o serie"));
  assertNoVerified(html); assert.equal(subject.calls.fetch.length, 2); assert.equal(subject.calls.storageWrites.length, 0);
  assert(subject.calls.fetch.every(({ options }) => options.credentials === "omit" && options.redirect === "error" && options.signal instanceof AbortSignal)); subject.dispose();
});

test("a verified network certificate reports a denied local save without losing verification or download", async () => {
  const stored = await certificate();
  const saveFailureNotice = "El certificado es válido, pero no pudimos guardar esta versión en el navegador. Podés descargarlo.";
  for (const storageWriteThrows of [false, true]) {
    const subject = fixture({ online: true, storageWriteThrows, fetch: url => responseFor(stored, url) }); subject.render();
    const html = await subject.until(html => html.includes("actualizada desde nexID"));
    assert.match(html, /Información pública verificada/); assert.match(html, /Descargar certificado/);
    assert.equal(html.includes(saveFailureNotice), storageWriteThrows);
    assert.equal(subject.calls.storageWrites.length, 1);
    assert.equal(subject.calls.storageWrites[0].key, keyFor(A)); subject.dispose();
  }
});

test("query changes clear old product content immediately and ignore late responses from the abandoned lookup", async () => {
  const first = await certificate(A), second = await certificate(B), pending = [];
  const subject = fixture({ online: true, fetch: (url, options) => new Promise(resolve => pending.push({ url, options, resolve })) });
  subject.render(); await subject.until(() => pending.length === 2);
  subject.setQuery(B); assertNoVerified(subject.render({ flush: false })); subject.render();
  await subject.until(() => pending.length === 4);
  assert(pending.slice(0, 2).every(entry => entry.options.signal.aborted));
  pending.slice(2).forEach(entry => entry.resolve(responseFor(second, entry.url)));
  const current = await subject.until(html => html.includes(`QA product ${B.gtin}`)); assert.doesNotMatch(current, new RegExp(`QA product ${A.gtin}`));
  pending.slice(0, 2).forEach(entry => entry.resolve(responseFor(first, entry.url)));
  await realDelay(20); const after = subject.render(); assert.match(after, new RegExp(`QA product ${B.gtin}`)); assert.doesNotMatch(after, new RegExp(`QA product ${A.gtin}`));
  assert.deepEqual(subject.calls.storageWrites.map(entry => entry.key), [keyFor(B)]);
  subject.setQuery("gtin=invalid"); assertNoVerified(subject.render({ flush: false })); subject.render(); assert.match(subject.render(), /Identificador GS1 inválido/); subject.dispose();
});

test("unmount aborts both requests and denies late state or storage writes", { timeout: 10_000 }, async () => {
  const stored = await certificate(), pending = [];
  const subject = fixture({ online: true, fetch: (url, options) => new Promise(resolve => pending.push({ url, options, resolve })) });
  subject.render(); await subject.until(() => pending.length === 2); subject.dispose();
  assert(pending.every(entry => entry.options.signal.aborted));
  assert.equal(subject.calls.lateStateWrites, 0);
  assert.equal(subject.calls.storageWrites.length, 0);
  assert.equal(subject.activeListeners(), 0);
  assert.equal(subject.timers.size, 0, "unmount must clear the deadline before transport settles");
  pending.forEach(entry => entry.resolve(responseFor(stored, entry.url)));
  await subject.settleCallbacks();
  assert.equal(subject.calls.lateStateWrites, 0);
  assert.equal(subject.calls.storageWrites.length, 0);
  assert.equal(subject.activeListeners(), 0);
  assert.equal(subject.timers.size, 0);
});

test("removing the query during an active lookup aborts transport and clears its busy state", async () => {
  const pending = [];
  const subject = fixture({ online: true, fetch: (url, options) => new Promise(resolve => pending.push({ url, options, resolve })) });
  subject.render(); await subject.until(() => pending.length === 2);
  subject.setQuery(""); assertNoVerified(subject.render({ flush: false })); subject.render();
  const html = subject.render(); assert.match(html, /Identificador GS1 inválido/); assert.doesNotMatch(html, /aria-busy="true"/);
  assert(pending.every(entry => entry.options.signal.aborted));
  const stored = await certificate(); pending.forEach(entry => entry.resolve(responseFor(stored, entry.url)));
  await realDelay(20); assertNoVerified(subject.render()); assert.equal(subject.calls.storageWrites.length, 0); subject.dispose();
});

test("a network deadline ends progress without a retry loop and exposes an explicit retry", async () => {
  const subject = fixture({ online: true, fetch: (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(Error("synthetic_abort")), { once: true })) });
  subject.render(); await subject.until(() => subject.calls.fetch.length === 2); subject.advance(10_000);
  const html = await subject.until(html => html.includes("La consulta tardó demasiado"));
  assertNoVerified(html); assert.match(html, /Reintentar/); assert.doesNotMatch(html, /aria-busy="true"/);
  await realDelay(20); assert.equal(subject.calls.fetch.length, 2); assert.equal(subject.calls.storageWrites.length, 0); subject.dispose();
});

test("failed refresh preserves a currently valid local copy and explains that it was not updated", async () => {
  const stored = await certificate();
  const subject = fixture({ online: true, saved: [[A, stored]], fetch: async () => { throw Error("synthetic_network_failure"); } }); subject.render();
  const html = await subject.until(html => html.includes("No pudimos actualizar. Seguís viendo la copia local vigente"));
  assert.match(html, /Información pública verificada/); assert.match(html, /guardada en este dispositivo/); assert.equal(subject.calls.fetch.length, 2); assert.equal(subject.calls.storageWrites.length, 0); subject.dispose();
});

test("oversized public responses are not saved, and a retry can recover with the same valid query", async () => {
  const stored = await certificate(); let attempt = 0;
  const subject = fixture({ online: true, fetch: url => { attempt += 1; return attempt <= 2 ? new Response("{}", { headers: { "content-length": "32769" } }) : responseFor(stored, url); } }); subject.render();
  const failure = await subject.until(html => html.includes("No pudimos obtener un certificado vigente")); assertNoVerified(failure); assert.equal(subject.calls.storageWrites.length, 0);
  subject.click("Reintentar"); await subject.until(html => html.includes("actualizada desde nexID")); assert.equal(subject.calls.fetch.length, 4); assert.equal(subject.calls.storageWrites.length, 1); subject.dispose();
});

test("a kept-open certificate loses its verified badge when the original verifier observes expiry", async () => {
  const stored = await certificate(); const subject = fixture({ saved: [[A, stored]] }); subject.render();
  await subject.until(html => html.includes("Información pública verificada")); subject.advance(360_001);
  const html = await subject.until(html => html.includes("certificado guardado venció")); assertNoVerified(html); assert.equal(subject.calls.fetch.length, 0); subject.dispose();
});

test("returning to a backgrounded tab rechecks validity locally without silently renewing it", async () => {
  const stored = await certificate(); const subject = fixture({ saved: [[A, stored]] }); subject.render();
  await subject.until(html => html.includes("Información pública verificada")); subject.visibleAfter(360_001);
  const html = await subject.until(html => html.includes("certificado guardado venció")); assertNoVerified(html); assert.equal(subject.calls.fetch.length, 0); assert.equal(subject.calls.storageWrites.length, 0); subject.dispose();
});

test("restored connectivity updates the available action but does not automatically send requests", async () => {
  const stored = await certificate(); const subject = fixture({ saved: [[A, stored]], fetch: url => responseFor(stored, url) }); subject.render();
  await subject.until(html => html.includes("Comprobar copia local")); subject.setOnline(true);
  const online = subject.render(); assert.match(online, /Actualizar online/); assert.equal(subject.calls.fetch.length, 0);
  subject.click("Actualizar online"); await subject.until(html => html.includes("actualizada desde nexID")); assert.equal(subject.calls.fetch.length, 2); subject.dispose();
});

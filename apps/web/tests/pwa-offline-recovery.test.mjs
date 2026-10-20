import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import React from "react";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../../../", import.meta.url));
const currentCookies = theme => `theme=${theme}; nexid_theme_version=white-first-v2`;
const currentStorage = theme => ({ theme, "nexid-theme-version": "white-first-v2" });
const tick = () => new Promise(setImmediate);
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }

// Execute original PwaSetup effects, the original preference reader and original
// UI applyTheme with a deterministic hook/DOM adapter. No browser/SW/storage
// persistence/provider acceptance is claimed by these focal tests.
function fixture({ pathname = "/", online = false, cookies = "", storage = {}, initialTheme = "light", cookieReadThrows = false, cookieWriteThrows = false, storageReadThrows = false, storageWriteThrows = false, register = async () => ({}), registrations = async () => [], enabled, nodeEnv = "production", supported = true } = {}) {
  const effects = [], pending = [], modules = new Map(), dependencies = [], listeners = new Map();
  const calls = { register: [], getRegistrations: 0, cookieReads: 0, cookieWrites: [], storageReads: [], storageWrites: [], unregister: 0 };
  let cursor = 0, route = pathname;
  const attributes = new Map([["data-theme", initialTheme]]), classes = new Set(initialTheme === "light" ? ["theme-light"] : []);
  const metas = [0, 1].map(() => ({ name: "theme-color", content: "SSR", media: "(prefers-color-scheme: light)", removeAttribute(name) { delete this[name]; } }));
  const document = {
    documentElement: { setAttribute: (name, value) => attributes.set(name, value), getAttribute: name => attributes.get(name), classList: { toggle(name, value) { if (value) classes.add(name); else classes.delete(name); } }, style: { colorScheme: initialTheme } },
    head: { querySelectorAll: selector => { assert.equal(selector, 'meta[name="theme-color"]'); return metas; }, appendChild: meta => { metas.push(meta); return meta; } },
    createElement: name => { assert.equal(name, "meta"); return { removeAttribute(key) { delete this[key]; } }; },
  };
  Object.defineProperty(document, "cookie", { get() { calls.cookieReads += 1; if (cookieReadThrows) throw Error("blocked_cookie_read"); return cookies; }, set(value) { calls.cookieWrites.push(value); if (cookieWriteThrows) throw Error("blocked_cookie_write"); } });
  const localStorage = { getItem(key) { calls.storageReads.push(key); if (storageReadThrows) throw Error("blocked_storage_read"); return storage[key] ?? null; }, setItem(key, value) { calls.storageWrites.push([key, value]); if (storageWriteThrows) throw Error("blocked_storage_write"); storage[key] = value; } };
  const navigator = { onLine: online };
  if (supported) navigator.serviceWorker = { register: async (url, options) => { calls.register.push({ url, options }); return register(); }, getRegistrations: async () => { calls.getRegistrations += 1; return registrations(); } };
  const window = { location: { protocol: "http:", hostname: "127.0.0.1" }, addEventListener(type, handler) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(handler); }, removeEventListener(type, handler) { listeners.get(type)?.delete(handler); } };
  const hooks = { ...React, useEffect(callback, deps) { const index = cursor++, previous = effects[index]; if (!previous || deps.some((value, offset) => !Object.is(value, previous.deps[offset]))) { pending.push(() => { previous?.cleanup?.(); effects[index] = { deps, cleanup: callback() }; }); } } };
  const load = file => {
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} }; modules.set(file, module);
    const output = ts.transpileModule(readFileSync(file, "utf8"), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    const dependency = name => {
      dependencies.push(name);
      if (name === "react") return hooks;
      if (name === "react/jsx-runtime") return require(name);
      if (name === "next/navigation") return { usePathname: () => route };
      if (name.startsWith(".")) { const base = resolve(dirname(file), name), target = [base, `${base}.ts`, `${base}.tsx`].find(candidate => existsSync(candidate) && /\.tsx?$/.test(candidate)); if (target) return load(target); }
      throw Error(`Unexpected PWA dependency: ${name}`);
    };
    new Function("require", "module", "exports", "navigator", "window", "document", "localStorage", "process", output)(dependency, module, module.exports, navigator, window, document, localStorage, { env: { NODE_ENV: nodeEnv, NEXT_PUBLIC_ENABLE_PWA: enabled } });
    return module.exports;
  };
  const { PwaSetup } = load(resolve(root, "apps/web/src/components/pwa-setup.tsx"));
  return {
    calls, dependencies, listeners, navigator,
    render({ flush = true } = {}) { cursor = 0; assert.equal(PwaSetup(), null); if (flush) while (pending.length) pending.shift()(); },
    flush() { while (pending.length) pending.shift()(); },
    setPath(value) { route = value; },
    emitOnline() { for (const handler of [...(listeners.get("online") || [])]) void handler(); },
    dispose() { effects.forEach(effect => effect?.cleanup?.()); },
    view() { return { theme: attributes.get("data-theme"), lightClass: classes.has("theme-light"), colorScheme: document.documentElement.style.colorScheme, colors: metas.map(meta => meta.content), metaMediaRemoved: metas.every(meta => !Object.hasOwn(meta, "media")) }; },
  };
}

test("offline enabled setup skips registration, resumes once online and suppresses concurrent or completed repeats", async () => {
  const pending = deferred(), subject = fixture({ register: () => pending.promise }); subject.render();
  assert.equal(subject.calls.register.length, 0); assert.equal(subject.listeners.get("online").size, 1);
  subject.emitOnline(); assert.equal(subject.calls.register.length, 0, "an online event without connectivity is not permission to send");
  subject.navigator.onLine = true; subject.emitOnline(); subject.emitOnline();
  assert.deepEqual(subject.calls.register, [{ url: "/sw.js", options: { scope: "/" } }]);
  pending.resolve({}); await tick(); subject.emitOnline(); assert.equal(subject.calls.register.length, 1);
  subject.dispose(); assert.equal(subject.listeners.get("online").size, 0);
});

test("unmount denies retained late events and does not register when an in-flight promise later settles", async () => {
  const pending = deferred(), subject = fixture({ online: true, register: () => pending.promise }); subject.render();
  const late = [...subject.listeners.get("online")][0]; assert.equal(subject.calls.register.length, 1);
  subject.dispose(); pending.resolve({}); await tick(); await late();
  assert.equal(subject.calls.register.length, 1); assert.equal(subject.listeners.get("online").size, 0);
});

test("a failed attempt waits for a later real online event, with no automatic retry loop", async () => {
  let attempts = 0; const subject = fixture({ online: true, register: async () => { attempts += 1; if (attempts === 1) throw Error("synthetic_registration_failure"); return {}; } }); subject.render(); await tick();
  assert.equal(attempts, 1); await tick(); assert.equal(attempts, 1);
  subject.emitOnline(); await tick(); subject.emitOnline(); assert.equal(attempts, 2); subject.dispose();
});

test("disabled policy still unregisters existing workers and installs no online handler", async () => {
  let unregistered = 0; const subject = fixture({ enabled: "false", online: true, registrations: async () => [{ unregister: async () => { unregistered += 1; return true; } }] }); subject.render(); await tick();
  assert.equal(subject.calls.getRegistrations, 1); assert.equal(unregistered, 1); assert.equal(subject.calls.register.length, 0); assert.equal(subject.listeners.has("online"), false);
  const development = fixture({ nodeEnv: "development", online: true }); development.render(); await tick(); assert.equal(development.calls.getRegistrations, 1); assert.equal(development.calls.register.length, 0);
  const explicit = fixture({ nodeEnv: "development", enabled: "true", online: true }); explicit.render(); assert.equal(explicit.calls.register.length, 1); explicit.dispose();
});

test("disabled cleanup denies a late enumeration result; missing service-worker support stays inert", async () => {
  const pending = deferred(); let unregistered = 0;
  const subject = fixture({ enabled: "false", registrations: () => pending.promise }); subject.render(); subject.dispose();
  pending.resolve([{ unregister: async () => { unregistered += 1; return true; } }]); await tick(); assert.equal(unregistered, 0);
  const unsupported = fixture({ supported: false }); unsupported.render(); assert.equal(unsupported.calls.register.length, 0); assert.equal(unsupported.calls.getRegistrations, 0); assert.equal(unsupported.listeners.size, 0);
});

test("cached light SSR is untouched before effects; explicit cookie preference restores all dark DOM/browser indicators", () => {
  const subject = fixture({ pathname: "/offline", cookies: currentCookies("dark"), storage: currentStorage("light") }); subject.render({ flush: false });
  assert.equal(subject.view().theme, "light"); assert.equal(subject.calls.cookieWrites.length, 0); assert.equal(subject.calls.storageWrites.length, 0);
  subject.flush(); assert.deepEqual(subject.view(), { theme: "dark", lightClass: false, colorScheme: "dark", colors: ["#020617", "#020617"], metaMediaRemoved: true });
  assert.equal(subject.calls.register.length, 0);
  assert(subject.calls.cookieWrites.every(value => value.startsWith("theme=") || value.startsWith("nexid_theme_version=")));
  assert(!subject.dependencies.includes("@product/ui")); assert(!subject.dependencies.some(name => name.endsWith("/ui/src/index"))); subject.dispose();
});

for (const pathname of ["/offline", "/offline/", "/offline/certificate", "/offline/certificate/"]) {
  test(`offline preference recovery applies on ${pathname} without requiring a network request`, () => {
    const subject = fixture({ pathname, cookies: currentCookies("dark") }); subject.render();
    assert.equal(subject.view().theme, "dark"); assert.equal(subject.calls.register.length, 0); subject.dispose();
  });
}

test("unrelated routes preserve their SSR appearance and entering offline through client navigation restores once", () => {
  for (const pathname of ["/", "/sun", "/me", "/offline-guide", "/offline-tools", "/offline/certificate-other", "/offline/unknown"]) {
    const subject = fixture({ pathname, cookies: currentCookies("dark") }); subject.render();
    assert.equal(subject.view().theme, "light", pathname); assert.equal(subject.calls.cookieWrites.length, 0, pathname); subject.dispose();
  }
  const subject = fixture({ pathname: "/about", online: true, cookies: currentCookies("dark") }); subject.render(); assert.equal(subject.view().theme, "light");
  subject.setPath("/offline/certificate"); subject.render(); assert.equal(subject.view().theme, "dark"); assert.equal(subject.calls.register.length, 1); subject.dispose();
});

test("current local preference recovers stale, absent, conflicting or blocked cookies", () => {
  for (const options of [{ cookies: "" }, { cookies: "theme=light; nexid_theme_version=old" }, { cookies: "theme=dark; theme=light; nexid_theme_version=white-first-v2" }, { cookieReadThrows: true }]) {
    const subject = fixture({ pathname: "/offline", storage: currentStorage("dark"), ...options }); subject.render(); assert.equal(subject.view().theme, "dark"); subject.dispose();
  }
  const light = fixture({ pathname: "/offline", initialTheme: "dark", cookieReadThrows: true, storage: currentStorage("light") }); light.render();
  assert.deepEqual(light.view(), { theme: "light", lightClass: true, colorScheme: "light", colors: ["#ffffff", "#ffffff"], metaMediaRemoved: true }); light.dispose();
});

test("valid cookie preference survives local-storage read and write denial", () => {
  const subject = fixture({ pathname: "/offline", cookies: currentCookies("dark"), storageReadThrows: true, storageWriteThrows: true }); subject.render();
  assert.equal(subject.view().theme, "dark"); assert.equal(subject.calls.storageReads.length, 0); assert.equal(subject.calls.register.length, 0); subject.dispose();
});

test("missing, unversioned, malformed or inaccessible preferences never write a default", () => {
  for (const options of [{}, { cookies: "theme=dark" }, { cookies: "theme=other; nexid_theme_version=white-first-v2" }, { storage: { theme: "dark", "nexid-theme-version": "old" } }, { cookieReadThrows: true, storageReadThrows: true }, { cookies: "theme=dark; nexid_theme_version=old", storageReadThrows: true }]) {
    const subject = fixture({ pathname: "/offline", ...options }); subject.render();
    assert.equal(subject.view().theme, "light"); assert.deepEqual(subject.view().colors, ["SSR", "SSR"]); assert.equal(subject.calls.cookieWrites.length, 0); assert.equal(subject.calls.storageWrites.length, 0); subject.dispose();
  }
});

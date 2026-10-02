import assert from "node:assert/strict";
import test from "node:test";
import { restoreHydratedPassportFragment, focusInitialPassportFragment } from "../src/components/passport-fragment-restoration.ts";

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function fixture({ readyState = "complete", hash = "#pasaporte-digital", scrollY = 0, navigation = "navigate" } = {}) {
  const fonts = deferred();
  const frames = new Map();
  let nextFrame = 0;
  const browser = Object.assign(new EventTarget(), {
    location: { hash }, scrollY,
    performance: { getEntriesByType: () => [{ type: navigation }] },
    requestAnimationFrame: callback => { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame: id => frames.delete(id),
  });
  const calls = [];
  const target = {
    id: "pasaporte-digital", isConnected: true,
    ownerDocument: { readyState, fonts: { ready: fonts.promise } },
    getClientRects: () => [{}],
    getBoundingClientRect: () => ({ height: 1200 }),
    closest: () => null,
    scrollIntoView: options => calls.push(options),
  };
  const paint = () => { const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(); };
  return { browser, target, frames, calls, fonts, paint };
}

const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

function focusFixture(options = {}) {
  const f = fixture(options), document = f.target.ownerDocument;
  const body = {}, attributes = new Map();
  const heading = Object.assign(new EventTarget(), {
    isConnected: true,
    getClientRects: () => [{}], closest: () => null,
    hasAttribute: name => attributes.has(name),
    setAttribute: (name, value) => attributes.set(name, value),
    removeAttribute: name => attributes.delete(name),
    focus: value => { f.calls.push(value); document.activeElement = heading; },
  });
  const section = { querySelector: () => heading };
  Object.assign(document, { body, documentElement: {}, activeElement: body, getElementById: () => section });
  f.browser.location.pathname = "/";
  f.browser.document = document;
  return { ...f, document, heading, attributes, section };
}

test("initial fragment focus waits for streamed content, load and fonts before one paint", async () => {
  const f = focusFixture({ readyState: "loading" });
  f.document.getElementById = () => null;
  focusInitialPassportFragment(f.browser);
  f.fonts.resolve(); await flush(); f.paint();
  assert.equal(f.calls.length, 0);
  f.document.getElementById = () => f.section;
  f.browser.dispatchEvent(new Event("load")); await flush();
  assert.equal(f.frames.size, 1); assert.equal(f.document.activeElement, f.document.body);
  f.paint();
  assert.equal(f.document.activeElement, f.heading);
  assert.deepEqual(f.calls, [{ preventScroll: true }]);
  assert.equal(f.attributes.get("tabindex"), "-1");
  f.heading.dispatchEvent(new Event("blur"));
  assert.equal(f.attributes.has("tabindex"), false);
});

test("loaded fragment focus still waits for font layout", async () => {
  const f = focusFixture(); focusInitialPassportFragment(f.browser);
  await flush(); f.paint(); assert.equal(f.calls.length, 0);
  f.fonts.resolve(); await flush(); f.paint(); assert.equal(f.calls.length, 1);
});

test("initial fragment focus yields to a new user or navigation action", async () => {
  for (const event of ["wheel", "touchstart", "pointerdown", "keydown", "hashchange", "popstate"]) {
    const f = focusFixture({ readyState: "loading" }); focusInitialPassportFragment(f.browser);
    f.browser.dispatchEvent(new Event(event)); f.fonts.resolve(); f.browser.dispatchEvent(new Event("load"));
    await flush(); f.paint(); assert.equal(f.calls.length, 0, event);
  }
});

test("initial fragment focus respects another active control", async () => {
  const f = focusFixture(); focusInitialPassportFragment(f.browser);
  const control = {}; f.document.activeElement = control;
  f.fonts.resolve(); await flush(); f.paint();
  assert.equal(f.document.activeElement, control); assert.equal(f.calls.length, 0);
});

test("initial fragment focus leaves other routes, hashes and native Back untouched", async () => {
  for (const options of [{ hash: "#other" }, { navigation: "back_forward" }]) {
    const f = focusFixture(options); focusInitialPassportFragment(f.browser);
    f.fonts.resolve(); await flush(); f.paint(); assert.equal(f.calls.length, 0);
  }
  const f = focusFixture(); focusInitialPassportFragment(f.browser);
  f.browser.location.pathname = "/about";
  f.fonts.resolve(); await flush(); f.paint(); assert.equal(f.calls.length, 0);
});

test("initial fragment cleanup cancels a pending paint and preserves existing tabindex", async () => {
  const f = focusFixture(); const cleanup = focusInitialPassportFragment(f.browser);
  f.fonts.resolve(); await flush(); assert.equal(f.frames.size, 1);
  cleanup(); f.paint(); assert.equal(f.calls.length, 0);
  const existing = focusFixture(); existing.attributes.set("tabindex", "0");
  focusInitialPassportFragment(existing.browser); existing.fonts.resolve(); await flush(); existing.paint();
  existing.heading.dispatchEvent(new Event("blur")); assert.equal(existing.attributes.get("tabindex"), "0");
});

test("initial fragment focus skips disconnected, hidden or inert content", async () => {
  for (const kind of ["disconnected", "hidden", "inert"]) {
    const f = focusFixture();
    if (kind === "disconnected") f.heading.isConnected = false;
    else f.heading.closest = () => f.section;
    focusInitialPassportFragment(f.browser); f.fonts.resolve(); await flush(); f.paint();
    assert.equal(f.calls.length, 0, kind);
  }
});

test("waits for load, fonts and one paint before restoring a streamed fragment once", async () => {
  const f = fixture({ readyState: "loading" });
  const cleanup = restoreHydratedPassportFragment(f.target, f.browser);
  f.fonts.resolve();
  await flush();
  assert.equal(f.frames.size, 0);
  f.browser.dispatchEvent(new Event("load"));
  await flush();
  assert.equal(f.calls.length, 0);
  assert.equal(f.frames.size, 1);
  f.paint();
  assert.deepEqual(f.calls, [{ block: "start", behavior: "instant" }]);
  f.browser.dispatchEvent(new Event("load"));
  f.browser.dispatchEvent(new Event("hashchange"));
  await flush();
  f.paint();
  cleanup();
  assert.equal(f.calls.length, 1);
});

test("an already loaded document still waits for font layout", async () => {
  const f = fixture();
  restoreHydratedPassportFragment(f.target, f.browser);
  await flush();
  assert.equal(f.frames.size, 0);
  f.fonts.resolve();
  await flush();
  f.paint();
  assert.equal(f.calls.length, 1);
});

test("does not override another hash, native scrolling or history restoration", async () => {
  for (const options of [{ hash: "#other" }, { scrollY: 350 }, { navigation: "back_forward" }]) {
    const f = fixture(options);
    restoreHydratedPassportFragment(f.target, f.browser);
    f.fonts.resolve();
    await flush();
    f.paint();
    assert.equal(f.calls.length, 0);
    assert.equal(f.frames.size, 0);
  }
});

test("user input or a new destination cancels the pending restoration", async () => {
  for (const event of ["wheel", "touchstart", "pointerdown", "keydown", "hashchange", "popstate"]) {
    const f = fixture();
    restoreHydratedPassportFragment(f.target, f.browser);
    f.browser.dispatchEvent(new Event(event));
    f.fonts.resolve();
    await flush();
    f.paint();
    assert.equal(f.calls.length, 0, event);
  }
});

test("actual scrolling while layout settles takes precedence", async () => {
  const f = fixture();
  restoreHydratedPassportFragment(f.target, f.browser);
  f.browser.scrollY = 160;
  f.browser.dispatchEvent(new Event("scroll"));
  f.fonts.resolve();
  await flush();
  f.paint();
  assert.equal(f.calls.length, 0);
});

test("rechecks the hash and connected visible target immediately before scrolling", async () => {
  for (const change of [
    f => { f.browser.location.hash = "#other"; },
    f => { f.target.isConnected = false; },
    f => { f.target.getClientRects = () => []; },
    f => { f.target.closest = () => ({}); },
  ]) {
    const f = fixture();
    restoreHydratedPassportFragment(f.target, f.browser);
    f.fonts.resolve();
    await flush();
    change(f);
    f.paint();
    assert.equal(f.calls.length, 0);
  }
});

test("cleanup prevents deferred work at each stage, including Strict Mode remount", async () => {
  for (const stage of ["load", "fonts", "paint"]) {
    const f = fixture({ readyState: stage === "load" ? "loading" : "complete" });
    const cleanup = restoreHydratedPassportFragment(f.target, f.browser);
    if (stage === "paint") { f.fonts.resolve(); await flush(); }
    cleanup();
    f.browser.dispatchEvent(new Event("load"));
    f.fonts.resolve();
    await flush();
    f.paint();
    assert.equal(f.calls.length, 0, stage);
    assert.equal(f.frames.size, 0);
  }
  const f = fixture();
  restoreHydratedPassportFragment(f.target, f.browser)();
  const cleanup = restoreHydratedPassportFragment(f.target, f.browser);
  f.fonts.resolve();
  await flush();
  f.paint();
  cleanup();
  assert.equal(f.calls.length, 1);
});

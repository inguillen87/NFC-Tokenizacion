import assert from "node:assert/strict";
import test from "node:test";
import { restoreHydratedPassportFragment } from "../src/components/passport-fragment-restoration.ts";

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

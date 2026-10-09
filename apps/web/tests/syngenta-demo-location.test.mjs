import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { approximateDemoPosition, MENDOZA_DEMO_POINT } from "../src/app/sun/valle-secreto-demo-location.ts";
import { SYNGENTA_DEMO } from "../src/app/sun/syngenta-demo.ts";

const source = readFileSync(new URL("../src/app/sun/syngenta-demo-map.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { fileName: "syngenta-demo-map.tsx", compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }, reportDiagnostics: true });
assert.equal(compiled.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length ?? 0, 0);

function harness({ locale = "es-AR", available = true, throws = false } = {}) {
  const slots = [], cleanups = [], timers = new Map(), geo = [], writes = [];
  let index = 0, nextTimer = 0, initialized = false;
  const map = () => null;
  const react = {
    useState(initial) { const slot = index++; if (!(slot in slots)) slots[slot] = typeof initial === "function" ? initial() : initial; return [slots[slot], value => { slots[slot] = typeof value === "function" ? value(slots[slot]) : value; }]; },
    useRef(initial) { const slot = index++; if (!(slot in slots)) slots[slot] = { current: initial }; return slots[slot]; },
    useId() { const slot = index++; if (!(slot in slots)) slots[slot] = `qa-${slot}`; return slots[slot]; },
    useEffect(effect) { index++; if (!initialized) cleanups.push(effect()); },
  };
  const jsx = (type, props) => ({ type, props });
  const exports = {};
  const context = vm.createContext({
    exports, require(name) {
      if (name === "react") return react;
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "lucide-react") return new Proxy({}, { get: () => () => null });
      if (name === "./sun-passport-map") return { SunPassportMap: map };
      if (name === "./valle-secreto-demo-location") return { MENDOZA_DEMO_POINT, approximateDemoPosition };
      if (name === "./syngenta-demo") return { SYNGENTA_DEMO };
      if (name.endsWith(".module.css")) return { default: new Proxy({}, { get: (_, key) => key }) };
      throw new Error(`Unexpected dependency ${name}`);
    },
    navigator: available ? { geolocation: { getCurrentPosition(success, failure, options) { if (throws) throw Error("unavailable"); geo.push({ success, failure, options }); } } } : {},
    window: { setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; }, clearTimeout(id) { timers.delete(id); } },
    fetch() { writes.push("fetch"); throw Error("Unexpected API request"); },
    localStorage: { setItem() { writes.push("storage"); throw Error("Unexpected persistence"); } },
    encodeURIComponent,
  });
  vm.runInContext(compiled.outputText, context);
  const render = () => { index = 0; const tree = exports.SyngentaDemoMap({ locale }); initialized = true; return tree; };
  const walk = (node, predicate) => {
    if (!node || typeof node !== "object") return null;
    if (node && typeof node === "object" && !Array.isArray(node) && predicate(node)) return node;
    const children = Array.isArray(node) ? node : node?.props?.children;
    for (const child of Array.isArray(children) ? children : [children]) { const result = walk(child, predicate); if (result) return result; }
    return null;
  };
  const get = id => walk(render(), node => node.props?.["data-testid"] === id);
  return {
    geo, timers, writes, render, get,
    map: () => walk(render(), node => node.type === map),
    request: () => get("syngenta-demo-location-request").props.onClick(),
    reset: () => get("syngenta-demo-location-reset").props.onClick(),
    state: () => get("syngenta-demo-map").props["data-demo-location-state"],
    dispose: () => cleanups.forEach(cleanup => cleanup?.()),
  };
}

test("Syngenta map starts with explicitly separate office reference and Mendoza sample, no route or device request", () => {
  for (const locale of ["es-AR", "en", "pt-BR"]) {
    const h = harness({ locale });
    const props = h.map().props;
    assert.equal(h.state(), "idle"); assert.equal(h.geo.length, 0); assert.equal(h.writes.length, 0);
    assert.equal(props.origin.source, "public_producer_reference");
    assert.equal(props.origin.lat, -34.5152755); assert.equal(props.origin.lng, -58.4756685);
    assert.equal(props.tap.source, "demo"); assert.equal(props.tap.lat, MENDOZA_DEMO_POINT.lat); assert.equal(props.tap.lng, MENDOZA_DEMO_POINT.lng);
    assert.equal(props.showRoute, false); assert.equal(props.distanceLabel, "");
    assert.equal(props.cartography, "reference"); assert.equal(props.referenceContext, "agro"); assert.equal(props.locale, locale);
    const url = new URL(h.get("syngenta-office-map-link").props.href);
    assert.equal(url.origin, "https://www.google.com"); assert.equal(url.pathname, "/maps/search/");
    assert.equal(url.searchParams.get("api"), "1"); assert.match(url.searchParams.get("query"), /Libertador 1855.*Vicente López/);
    assert.equal([...url.searchParams.keys()].length, 2);
    h.dispose();
  }
});

test("only an explicit action asks once with bounded low-accuracy options and displays rounded consented coordinates", () => {
  const h = harness(); h.request(); h.request();
  assert.equal(h.state(), "pending"); assert.equal(h.geo.length, 1);
  assert.equal(h.get("syngenta-demo-location-request").props.disabled, true);
  assert.deepEqual({ ...h.geo[0].options }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 });
  h.geo[0].success({ coords: { latitude: -32.891234567, longitude: -68.843456789, accuracy: 8 } });
  assert.equal(h.state(), "shared"); assert.equal(h.timers.size, 0); assert.equal(h.writes.length, 0);
  assert.equal(h.map().props.tap.lat, -32.89); assert.equal(h.map().props.tap.lng, -68.84);
  assert.equal(h.map().props.tap.accuracyM, 150);
  assert.equal(h.map().props.tap.source, "demo_browser_approximate_consent");
  h.reset(); assert.equal(h.state(), "idle"); assert.equal(h.map().props.tap.source, "demo"); h.dispose();
});

test("permission rejection and native geolocation timeout keep the sample available and permit retry", () => {
  for (const [code, expected] of [[1, "denied"], [2, "unavailable"], [3, "timeout"]]) {
    const h = harness(); h.request(); h.geo[0].failure({ code });
    assert.equal(h.state(), expected); assert.equal(h.map().props.tap.source, "demo"); assert.equal(h.timers.size, 0);
    assert.equal(h.get("syngenta-demo-location-request").props.disabled, false);
    h.request(); assert.equal(h.geo.length, 2); h.dispose();
  }
});

test("one 8.5 second watchdog resolves a transport that never calls back and ignores its later success", () => {
  const h = harness(); h.request();
  assert.equal(h.timers.size, 1); const timer = [...h.timers.values()][0]; assert.equal(timer.delay, 8500);
  timer.callback(); assert.equal(h.state(), "timeout"); assert.equal(h.timers.size, 0);
  h.geo[0].success({ coords: { latitude: -34.55, longitude: -58.44, accuracy: 8 } });
  assert.equal(h.state(), "timeout"); assert.equal(h.map().props.tap.source, "demo"); h.dispose();
});

test("reset and a newer request cannot be overwritten by an older position or error", () => {
  const h = harness(); h.request(); h.reset(); h.request();
  h.geo[0].success({ coords: { latitude: -34.55, longitude: -58.44, accuracy: 8 } });
  h.geo[0].failure({ code: 1 }); assert.equal(h.state(), "pending");
  h.geo[1].success({ coords: { latitude: -33.912345, longitude: -68.723456, accuracy: 200 } });
  assert.equal(h.state(), "shared"); assert.equal(h.map().props.tap.lat, -33.91); assert.equal(h.map().props.tap.lng, -68.72); h.dispose();
});

test("unmount cancels the watchdog and makes captured callbacks harmless", () => {
  const h = harness(); h.request(); h.dispose(); assert.equal(h.timers.size, 0);
  h.geo[0].success({ coords: { latitude: -34.55, longitude: -58.44, accuracy: 8 } });
  h.geo[0].failure({ code: 1 }); assert.equal(h.state(), "pending"); assert.equal(h.writes.length, 0);
});

test("missing, throwing or malformed geolocation does not invent a location", () => {
  for (const options of [{ available: false }, { throws: true }]) {
    const h = harness(options); h.request(); assert.equal(h.state(), "unavailable"); assert.equal(h.map().props.tap.source, "demo"); h.dispose();
  }
  for (const coords of [{ latitude: NaN, longitude: 0, accuracy: 5 }, { latitude: 91, longitude: 0, accuracy: 5 }, { latitude: -32, longitude: 181, accuracy: 5 }, { latitude: -32, longitude: -68, accuracy: -1 }, { latitude: -32, longitude: -68, accuracy: 1000001 }]) {
    const h = harness(); h.request(); h.geo[0].success({ coords }); assert.equal(h.state(), "unavailable"); assert.equal(h.map().props.tap.source, "demo"); h.dispose();
  }
});

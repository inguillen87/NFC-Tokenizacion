import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

// Real current component compiled in this process; the hook scheduler, router,
// response bodies and DOM references are fixtures. This is not Next or a browser.
const source = readFileSync(new URL("../src/app/(app)/loyalty/rewards/rewards-client.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const createProps = () => ({ initialRewards: [], tenantScope: "tenant-a", isDemo: false, canWrite: true, dataSource: "production", availability: "ready_empty", sourceReason: "" });
function fixture() {
  const slots = [], effects = new Map(), calls = [], pending = [];
  let cursor = 0, props = createProps(), refreshes = 0, closes = 0, focusCalls = 0;
  const hooks = {
    useRef(value) { const index = cursor++; if (!slots[index]) slots[index] = { current: value }; return slots[index]; },
    useState(value) { const index = cursor++; if (!slots[index]) slots[index] = { value: typeof value === "function" ? value() : value };
      return [slots[index].value, update => { slots[index].value = typeof update === "function" ? update(slots[index].value) : update; }]; },
    useEffect(effect, deps) { const index = cursor++; if (!slots[index]) slots[index] = { effect: true, deps: null, cleanup: null };
      const slot = slots[index], previous = slot.next || slot.deps;
      if (!previous || previous.length !== deps.length || previous.some((value, position) => !Object.is(value, deps[position]))) { slot.next = deps; effects.set(index, { slot, effect, deps }); }
    },
  };
  const jsx = (type, props, key) => ({ type, props: props || {}, key });
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(name => {
    if (name === "react") return { ...hooks, default: {} };
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: Symbol.for("fixture.fragment") };
    if (name === "next/navigation") return { useRouter: () => ({ refresh: () => { refreshes++; } }) };
    if (name.endsWith("reward-reservation-notices")) return { rewardProgramConfigurationLink: () => null };
    return new Proxy({}, { get: () => () => null });
  }, module, module.exports);
  const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node && typeof node === "object" && node.props ? [node, ...nodes(node.props.children)] : [];
  const text = node => (Array.isArray(node) ? node.map(text).join(" ") : typeof node === "string" || typeof node === "number" ? String(node) : node?.props ? text(node.props.children) : "").replace(/\s+/g, " ").trim();
  const dialog = { open: false, showModal() { this.open = true; }, close() { this.open = false; closes++; } };
  const fetch = (url, init) => new Promise(resolve => calls.push({ url, init, release: (status, body) => resolve(new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": typeof body === "string" ? "text/html" : "application/json" } })) }));
  const h = { calls, fetch, nodes, text, event: { preventDefault() {} },
    track(value) { pending.push(value); return value; },
    render(next = props) { props = next; cursor = 0; const tree = module.exports.default(props);
      for (const node of nodes(tree)) if (node.props.ref) node.props.ref.current = node.type === "dialog" ? dialog : { focus() { focusCalls++; } };
      return tree;
    },
    flush() { const queued = [...effects.values()]; effects.clear(); for (const { slot, effect, deps } of queued) { slot.cleanup?.(); slot.deps = deps; slot.next = null; slot.cleanup = effect() || null; } },
    button(tree, name) { const node = nodes(tree).find(node => node.type === "button" && text(node) === name); assert.ok(node, name); return node; },
    field(tree, id) { const node = nodes(tree).find(node => node.props.id === id); assert.ok(node, id); return node; },
    form(tree) { const node = nodes(tree).find(node => node.type === "form"); assert.ok(node, "current form"); return node; },
    props: () => props, refreshes: () => refreshes, closes: () => closes, focusCalls: () => focusCalls,
    cleanup() { effects.clear(); for (const slot of slots) if (slot?.effect) { slot.cleanup?.(); slot.cleanup = null; } },
    async finish() { for (const call of calls) call.release(409, { ok: false, error: "reward_create_conflict" }); h.cleanup(); await Promise.allSettled(pending); },
  };
  return h;
}
function open(h) { h.render(); h.flush(); h.button(h.render(), "Nuevo Beneficio").props.onClick(); let tree = h.render(); h.flush();
  for (const [id, value] of [["reward-edit-code", "DUPLICATE"], ["reward-edit-title", "Título conservado"], ["reward-edit-points", "40"], ["reward-edit-stock", "12"]]) h.field(tree, id).props.onChange({ target: { value } });
  return h.render();
}

test("the same-turn submit callback can issue only one request for its dialog owner", async t => {
  const h = fixture(); t.mock.method(globalThis, "fetch", h.fetch); let pending;
  try { const tree = open(h), submit = h.form(tree).props.onSubmit; pending = h.track(submit(h.event)); const duplicate = h.track(submit(h.event));
    assert.equal(h.calls.length, 1); assert.equal(h.calls[0].url, "/api/admin/loyalty/rewards/create");
    h.calls[0].release(409, { ok: false, error: "reward_create_conflict" }); await Promise.all([pending, duplicate]);
  } finally { await h.finish(); }
});

test("retained submit callbacks cannot write after source replacement before effects or after unmount", async t => {
  const h = fixture(); t.mock.method(globalThis, "fetch", h.fetch);
  try { const oldSubmit = h.form(open(h)).props.onSubmit;
    h.render({ ...h.props(), tenantScope: "tenant-b", initialRewards: [] });
    const ignored = h.track(oldSubmit(h.event)); assert.equal(h.calls.length, 0, "new scope is fenced before passive cleanup"); await ignored;
    h.flush(); const current = open(h), afterUnmount = h.form(current).props.onSubmit; h.cleanup();
    const ignoredUnmount = h.track(afterUnmount(h.event)); assert.equal(h.calls.length, 0, "unmounted owner cannot start a write"); await ignoredUnmount;
  } finally { await h.finish(); }
});

test("an unsupported strict create route preserves the form and never falls back to legacy upsert", async t => {
  const h = fixture(); t.mock.method(globalThis, "fetch", h.fetch); let pending;
  try { pending = h.track(h.form(open(h)).props.onSubmit(h.event)); assert.equal(h.calls.length, 1); h.calls[0].release(404, "<html>old deployment</html>"); await pending;
    let tree = h.render(); h.flush(); tree = h.render();
    assert.equal(h.field(tree, "reward-edit-code").props.value, "DUPLICATE"); assert.equal(h.field(tree, "reward-edit-title").props.value, "Título conservado");
    assert.match(h.text(tree), /creación segura no está disponible/); assert.doesNotMatch(h.text(tree), /old deployment|creado con éxito/);
    assert.equal(h.calls.length, 1); assert.equal(h.calls[0].url, "/api/admin/loyalty/rewards/create"); assert.equal(h.closes(), 0); assert.equal(h.refreshes(), 0); assert.ok(h.focusCalls() > 0);
  } finally { await h.finish(); }
});

test("a success arriving after unmount cannot schedule a timer that refreshes or closes another view", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] }); const h = fixture(); t.mock.method(globalThis, "fetch", h.fetch); let pending;
  try { pending = h.track(h.form(open(h)).props.onSubmit(h.event)); assert.equal(h.calls.length, 1); h.cleanup(); h.calls[0].release(200, { ok: true, reward: { id: "synthetic" } }); await pending;
    t.mock.timers.tick(2000); assert.equal(h.refreshes(), 0); assert.equal(h.closes(), 0);
  } finally { await h.finish(); }
});

test("read-only and demo page props cannot write through retained client callbacks", async t => {
  for (const [label, patch] of [["read-only", { canWrite: false }], ["demo", { isDemo: true, canWrite: false, dataSource: "demo" }]]) {
    await t.test(label, async t => {
      const h = fixture(); t.mock.method(globalThis, "fetch", h.fetch);
      try {
        let tree = h.render({ ...h.props(), ...patch }); h.flush(); tree = h.render();
        assert.equal(h.nodes(tree).some(node => node.type === "button" && h.text(node) === "Nuevo Beneficio"), false);
        assert.equal(h.nodes(tree).some(node => node.type === "form"), false); assert.equal(h.calls.length, 0);
        h.render({ ...h.props(), isDemo: false, canWrite: true, dataSource: "production" }); h.flush();
        tree = open(h); const retainedSubmit = h.form(tree).props.onSubmit, retainedCreate = h.button(tree, "Nuevo Beneficio").props.onClick;
        h.render({ ...h.props(), ...patch });
        await h.track(retainedSubmit(h.event)); retainedCreate();
        tree = h.render(); h.flush(); tree = h.render();
        assert.equal(h.calls.length, 0, "permission/demo replacement fences old callbacks before effects without any POST");
        assert.equal(h.nodes(tree).some(node => node.type === "form"), false);
      } finally { await h.finish(); }
    });
  }
});

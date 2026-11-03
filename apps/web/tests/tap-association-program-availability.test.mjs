import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import * as model from "../src/app/me/_components/tap-association-model.ts";

// Actual component/model code, with a synthetic hook scheduler, DOM, session and
// controlled transport. No browser, Next server, real identity or TAP is claimed.
const bannerSource = readFileSync(new URL("../src/app/me/_components/tap-association-banner.tsx", import.meta.url), "utf8");
const copySource = readFileSync(new URL("../src/app/me/_components/tap-association-copy.ts", import.meta.url), "utf8");
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
const ctx = (event = "715", tenant = "brand-a", action = "rewards") => model.tapAssociationContext(new URLSearchParams({ fromTap: "1", eventId: event, tenant, tapAction: action }));
const payload = (tenant = "brand-a", program = true, status = "published") => ({ ok: true, configuration: {
  version: "nexid.tenant-actions.v1", status, allowedActions: [], tenantSlug: tenant, catalogAvailable: false, trivia: null,
  program: program ? { id: "program-a", name: "Programa publicado", pointsName: "Puntos", pointsPerValidTap: 0 } : null,
} });

function fixture(t, initial = ctx()) {
  const slots = [], effects = new Map(), calls = [], reads = [], writes = [], saved = new Map();
  let cursor = 0, context = initial, setterCalls = 0, refreshes = 0;
  const replace = (key, value) => { saved.set(key, { own: Object.hasOwn(globalThis, key), value: globalThis[key] }); globalThis[key] = value; };
  const body = {}, document = { body, activeElement: body, documentElement: { lang: "es-AR" }, addEventListener() {}, removeEventListener() {} };
  replace("document", document); replace("window", { addEventListener() {}, removeEventListener() {} });
  replace("MutationObserver", class { observe() {} disconnect() {} });
  const hooks = {
    useState(initial) { const i = cursor++; if (!slots[i]) slots[i] = { value: typeof initial === "function" ? initial() : initial };
      return [slots[i].value, update => { setterCalls++; slots[i].value = typeof update === "function" ? update(slots[i].value) : update; }]; },
    useRef(initial) { const i = cursor++; if (!slots[i]) slots[i] = { current: initial }; return slots[i]; },
    useEffect(effect, deps) { const i = cursor++; if (!slots[i]) slots[i] = { effect: true, deps: null, cleanup: null };
      const slot = slots[i], prior = slot.next || slot.deps;
      if (!prior || prior.length !== deps.length || prior.some((v, index) => !Object.is(v, deps[index]))) { slot.next = deps; effects.set(i, { slot, effect, deps }); }
    },
  };
  const jsx = (type, props, key) => ({ type, props: props || {}, key });
  const fetch = (url, init = {}) => new Promise(resolve => calls.push({ url: String(url), init,
    release(status, value) { resolve({ ok: status >= 200 && status < 300, status, json: async () => value, body: { cancel: async () => {} } }); },
  }));
  t.mock.method(globalThis, "fetch", fetch);
  const observedModel = { ...model,
    createTapAssociationProgramReader(...args) {
      const reader = model.createTapAssociationProgramReader(...args), read = reader.read;
      reader.read = () => { const pending = read(); reads.push(pending); return pending; }; return reader;
    },
    createTapAssociationRunner(...args) {
      const runner = model.createTapAssociationRunner(...args), run = runner.run;
      runner.run = (...args) => { const pending = run(...args); writes.push(pending); return pending; }; return runner;
    },
  };
  const copyModule = { exports: {} }; new Function("module", "exports", compile(copySource))(copyModule, copyModule.exports);
  const module = { exports: {} };
  new Function("require", "module", "exports", compile(bannerSource + "\nexport const __testAssociationCard = AssociationCard;"))(name => {
    if (name === "react") return { ...hooks, default: {} };
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: Symbol.for("fixture.fragment") };
    if (name === "next/navigation") return { useRouter: () => ({ refresh() { refreshes++; } }) };
    if (name === "next/link") return { __esModule: true, default: "a" };
    if (name === "./tap-association-model") return observedModel;
    if (name === "./tap-association-copy") return copyModule.exports;
    if (name.endsWith(".module.css")) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
    throw Error("Unexpected component import: " + name);
  }, module, module.exports);
  const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node && typeof node === "object" && node.props ? [node, ...nodes(node.props.children)] : [];
  const text = node => (Array.isArray(node) ? node.map(text).join(" ") : typeof node === "string" || typeof node === "number" ? String(node) : node?.props ? text(node.props.children) : "").replace(/\s+/g, " ").trim();
  const h = { calls, reads, writes, nodes, text, setterCalls: () => setterCalls, refreshes: () => refreshes,
    render(next = context) { context = next; cursor = 0; const tree = module.exports.__testAssociationCard({ context, destination: "/me" });
      for (const node of nodes(tree)) if (node.props.ref) node.props.ref.current = { focus() {}, scrollIntoView() {} }; return tree; },
    flush() { const queued = [...effects.values()]; effects.clear(); for (const { slot, effect, deps } of queued) { slot.cleanup?.(); slot.deps = deps; slot.next = null; slot.cleanup = effect() || null; } },
    async turn() { await new Promise(resolve => setImmediate(resolve)); },
    byTestId(tree, id) { const node = nodes(tree).find(n => n.props["data-testid"] === id); assert.ok(node, id); return node; },
    programCalls(event = context.eventId) { return calls.filter(c => c.url === `/api/public/passport/${event}/configuration`); },
    posts() { return calls.filter(c => c.init.method === "POST"); },
    readySession() { const call = calls.find(c => c.url === "/api/consumer/session"); assert.ok(call); call.release(200, { ok: true, authenticated: true }); },
    clickConfirm(tree) { const trigger = { contains: value => value === trigger }; document.activeElement = trigger; h.byTestId(tree, "tap-association-confirm").props.onClick({ currentTarget: trigger }); },
    cleanup() { effects.clear(); for (const slot of slots) if (slot?.effect) { slot.cleanup?.(); slot.cleanup = null; } },
    async finish() { for (const call of calls) call.release(503, { ok: false, reason: "fixture_cleanup" }); h.cleanup(); await Promise.allSettled([...reads, ...writes]); await h.turn(); for (const [key, old] of saved) { if (old.own) globalThis[key] = old.value; else delete globalThis[key]; } },
  };
  h.render(); h.flush(); return h;
}

test("loading and no-program configuration cannot send enrollment, while intent stays selected", async t => {
  const h = fixture(t);
  try {
    h.readySession(); await h.turn(); let tree = h.render();
    h.clickConfirm(tree); await h.turn(); assert.equal(h.posts().length, 0, "old UI can POST before any programme read; guarded UI cannot");
    const get = h.programCalls()[0]; assert.ok(get, "one event-bound configuration GET"); assert.equal(h.programCalls().length, 1);
    assert.equal(get.init.cache, "no-store"); assert.equal(get.init.credentials, "same-origin"); assert.equal(get.init.body, undefined);
    assert.equal(h.byTestId(tree, "tap-association-option-rewards").props.checked, true);
    assert.equal(h.byTestId(tree, "tap-association-confirm").props.disabled, true);
    get.release(200, payload("brand-a", false)); await h.reads[0]; await h.turn(); tree = h.render(); h.flush();
    assert.match(h.text(tree), /no tiene un programa de beneficios activo/);
    assert.equal(h.byTestId(tree, "tap-association-option-rewards").props.disabled, true);
    assert.equal(h.byTestId(tree, "tap-association-option-rewards").props.checked, true);
    h.clickConfirm(tree); await h.turn(); assert.equal(h.posts().length, 0); assert.equal(h.refreshes(), 0);
  } finally { await h.finish(); }
});

test("unpublished profile plus active programme permits only explicit enrollment; POST denial after GET stays authoritative", async t => {
  const h = fixture(t);
  try {
    h.readySession(); h.programCalls()[0]?.release(200, payload("brand-a", true, "unpublished"));
    assert.ok(h.programCalls()[0]); await h.reads[0]; await h.turn(); let tree = h.render(); h.flush();
    assert.equal(h.posts().length, 0, "GET never auto-enrolls"); assert.equal(h.byTestId(tree, "tap-association-confirm").props.disabled, false);
    h.clickConfirm(tree); assert.equal(h.posts().length, 1); const post = h.posts()[0];
    assert.equal(post.url, "/api/mobile/passport/715/loyalty/enroll"); assert.deepEqual(JSON.parse(post.init.body), { tenantSlug: "brand-a", locale: "es-AR" });
    post.release(404, { ok: false, reason: "no_active_program" }); await h.writes[0]; await h.turn(); tree = h.render(); h.flush();
    assert.match(h.text(tree), /La empresa no tiene un programa de beneficios activo/); assert.doesNotMatch(h.text(tree), /Inscripción confirmada/);
    assert.equal(h.byTestId(tree, "tap-association-confirm").props.disabled, true); h.clickConfirm(tree); await h.turn();
    assert.equal(h.posts().length, 1, "an available GET cannot override the non-retryable server result"); assert.equal(h.refreshes(), 0);
  } finally { await h.finish(); }
});

test("old event/tenant replies, mismatched tenant responses and post-unmount reads cannot enable another card", async t => {
  const h = fixture(t);
  try {
    h.readySession(); await h.turn(); const old = h.programCalls()[0]; assert.ok(old);
    let tree = h.render(ctx("716", "brand-b")); old.release(200, payload("brand-a")); await h.reads[0]; await h.turn();
    tree = h.render(); h.clickConfirm(tree); await h.turn(); assert.equal(h.posts().length, 0, "latest event/tenant fences the prior available response before effects");
    assert.equal(h.byTestId(tree, "tap-association-confirm").props.disabled, true); h.flush();
    const wrong = h.programCalls("716")[0]; assert.ok(wrong); wrong.release(200, payload("brand-a")); await h.reads.at(-1); await h.turn(); tree = h.render();
    assert.match(h.text(tree), /No pudimos consultar/); assert.equal(h.byTestId(tree, "tap-association-confirm").props.disabled, true);
    h.byTestId(tree, "tap-association-program-retry").props.onClick(); h.programCalls("716")[1].release(200, payload("brand-b")); await h.reads.at(-1); await h.turn(); tree = h.render();
    assert.equal(h.byTestId(tree, "tap-association-confirm").props.disabled, false); assert.equal(h.posts().length, 0);
    h.render(ctx("717", "brand-b")); h.flush(); const late = h.programCalls("717")[0]; assert.ok(late); h.cleanup(); const setters = h.setterCalls();
    late.release(200, payload("brand-b")); await h.reads.at(-1); await h.turn(); assert.equal(h.setterCalls(), setters); assert.equal(h.posts().length, 0);
  } finally { await h.finish(); }
});

test("explicit retry is singleflight and preserves another selected action and its unsubmitted PIN", async t => {
  const h = fixture(t, ctx("715", "brand-a", "claim"));
  try {
    h.readySession(); const failed = h.programCalls()[0]; assert.ok(failed); failed.release(503, { ok: false }); await h.reads[0]; await h.turn(); let tree = h.render();
    const pin = h.nodes(tree).find(n => n.props.id === "tap-association-claim-pin"); assert.ok(pin); pin.props.onChange({ target: { value: "OWNED-PIN" } }); tree = h.render();
    const retry = h.byTestId(tree, "tap-association-program-retry").props.onClick; retry(); retry();
    assert.equal(h.programCalls().length, 2, "one initial GET plus one deliberately retried GET");
    assert.equal(h.byTestId(tree, "tap-association-option-claim").props.checked, true);
    assert.equal(h.nodes(h.render()).find(n => n.props.id === "tap-association-claim-pin").props.value, "OWNED-PIN");
    h.programCalls()[1].release(200, payload("brand-a", false)); await h.reads.at(-1); await h.turn(); tree = h.render();
    assert.equal(h.byTestId(tree, "tap-association-option-claim").props.checked, true); assert.equal(h.byTestId(tree, "tap-association-confirm").props.disabled, false);
    assert.equal(h.nodes(tree).find(n => n.props.id === "tap-association-claim-pin").props.value, "OWNED-PIN"); assert.equal(h.posts().length, 0);
  } finally { await h.finish(); }
});

test("failed, unavailable, malformed and foreign configuration never mean no programme", async t => {
  for (const [status, body] of [[503, { ok: false }], [400, { ok: false }], [200, payload("brand-a", false, "unavailable")],
    [200, { ok: true, configuration: {} }], [200, payload("brand-b", false)], [200, { ...payload(), ok: "true" }],
    ...[["published"], ["unpublished"], ["unavailable"]].flatMap(status => [
      [200, payload("brand-a", false, status)], [200, payload("brand-a", true, status)],
    ])]) {
    const h = fixture(t);
    try {
      h.readySession(); const call = h.programCalls()[0]; assert.ok(call, "actual UI must initiate its advisory read");
      call.release(status, JSON.parse(JSON.stringify(body))); await h.reads[0]; await h.turn(); const tree = h.render();
      assert.match(h.text(tree), /No pudimos consultar los beneficios/);
      assert.doesNotMatch(h.text(tree), /no tiene un programa de beneficios activo/);
      assert.equal(h.byTestId(tree, "tap-association-confirm").props.disabled, true);
      h.clickConfirm(tree); await h.turn(); assert.equal(h.posts().length, 0); assert.equal(h.refreshes(), 0);
    } finally { await h.finish(); }
  }
});

test("adjacent large event ids reach the browser read and explicit POST as their exact strings", async t => {
  for (const eventId of ["9007199254740992", "9007199254740993", "9223372036854775806", "9223372036854775807"]) {
    const h = fixture(t, ctx(eventId));
    try {
      h.readySession(); const get = h.programCalls(eventId)[0]; assert.ok(get, "canonical large event must have its own GET");
      assert.equal(get.url, `/api/public/passport/${eventId}/configuration`);
      get.release(200, payload()); await h.reads[0]; await h.turn(); let tree = h.render();
      assert.equal(h.posts().length, 0); assert.equal(h.byTestId(tree, "tap-association-confirm").props.disabled, false);
      h.clickConfirm(tree); const post = h.posts()[0]; assert.ok(post);
      assert.equal(post.url, `/api/mobile/passport/${eventId}/loyalty/enroll`);
      assert.deepEqual(JSON.parse(post.init.body), { tenantSlug: "brand-a", locale: "es-AR" });
      post.release(409, { ok: false, error: "fresh_tap_capability_required", fresh_token_status: "fresh_token_already_used" });
      await h.writes[0]; await h.turn(); tree = h.render();
      assert.equal(h.byTestId(tree, "tap-association-result-rewards").props["data-outcome"], "fresh_used");
      h.clickConfirm(tree); await h.turn(); assert.equal(h.posts().length, 1, "exact identity never grants or renews a capability");
    } finally { await h.finish(); }
  }
});

test("late programme read and stale retry cannot replace a pending claim or its terminal receipt", async t => {
  const h = fixture(t, ctx("715", "brand-a", "claim"));
  try {
    h.readySession(); const first = h.programCalls()[0]; assert.ok(first); first.release(503, { ok: false });
    await h.reads[0]; await h.turn(); let tree = h.render();
    const retry = h.byTestId(tree, "tap-association-program-retry").props.onClick;
    retry(); const late = h.programCalls()[1]; assert.ok(late);
    h.nodes(tree).find(n => n.props.id === "tap-association-claim-pin").props.onChange({ target: { value: "OWNED-PIN" } });
    tree = h.render(); h.clickConfirm(tree); assert.equal(h.posts().length, 1);
    const post = h.posts()[0]; assert.equal(post.url, "/api/mobile/passport/715/consumer/claim");
    assert.equal(JSON.parse(post.init.body).pin, "OWNED-PIN");
    retry(); assert.equal(h.programCalls().length, 2, "stale retry handler cannot read while a writer is pending");
    late.release(200, payload()); await h.reads[1]; await h.turn(); tree = h.render();
    assert.equal(h.byTestId(tree, "tap-association-option-claim").props.checked, true);
    assert.equal(h.byTestId(tree, "tap-association-confirm").props.disabled, true);
    assert.equal(h.nodes(tree).find(n => n.props.id === "tap-association-claim-pin").props.value, "");
    assert.equal(h.nodes(tree).find(n => n.props["data-testid"] === "tap-association-result-claim"), undefined);
    post.release(200, { ok: true, eventId: "715", ownership_scope: "nexid_off_chain_digital_title", ownership: { status: "claimed" } });
    await h.writes[0]; await h.turn(); tree = h.render();
    assert.equal(h.byTestId(tree, "tap-association-result-claim").props["data-outcome"], "claimed");
    const refreshes = h.refreshes(); retry(); assert.equal(h.programCalls().length, 3);
    h.programCalls()[2].release(200, payload("brand-a", false)); await h.reads.at(-1); await h.turn(); tree = h.render();
    assert.equal(h.byTestId(tree, "tap-association-result-claim").props["data-outcome"], "claimed");
    assert.equal(h.byTestId(tree, "tap-association-confirm").props.disabled, true);
    h.clickConfirm(tree); await h.turn(); assert.equal(h.posts().length, 1); assert.equal(h.refreshes(), refreshes);
  } finally { await h.finish(); }
});

test("explicit programme recheck never renews consumed or no-programme enrollment results", async t => {
  for (const [httpStatus, body, outcome] of [[404, { ok: false, error: "no_active_program" }, "no_program"],
    [409, { ok: false, error: "fresh_tap_capability_required", fresh_token_status: "fresh_token_already_used" }, "fresh_used"]]) {
    const h = fixture(t);
    try {
      h.readySession(); const first = h.programCalls()[0]; assert.ok(first); first.release(503, { ok: false });
      await h.reads[0]; await h.turn(); let tree = h.render();
      const retry = h.byTestId(tree, "tap-association-program-retry").props.onClick; retry(); retry();
      assert.equal(h.programCalls().length, 2); h.programCalls()[1].release(200, payload());
      await h.reads.at(-1); await h.turn(); tree = h.render(); h.clickConfirm(tree);
      assert.equal(h.posts().length, 1); h.posts()[0].release(httpStatus, body);
      await h.writes[0]; await h.turn(); tree = h.render();
      assert.equal(h.byTestId(tree, "tap-association-result-rewards").props["data-outcome"], outcome);
      retry(); assert.equal(h.programCalls().length, 3); h.programCalls()[2].release(200, payload());
      await h.reads.at(-1); await h.turn(); tree = h.render();
      assert.equal(h.byTestId(tree, "tap-association-result-rewards").props["data-outcome"], outcome);
      assert.equal(h.byTestId(tree, "tap-association-confirm").props.disabled, true);
      h.clickConfirm(tree); await h.turn(); assert.equal(h.posts().length, 1); assert.equal(h.refreshes(), 0);
    } finally { await h.finish(); }
  }
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import * as proxyPolicy from "../src/lib/admin-proxy-policy.ts";
import * as permissionPolicy from "../src/lib/permission-policy.ts";
import * as tenantPolicy from "../src/lib/dashboard-tenant-scope-policy.ts";
import { dashboardRoleToScope } from "../src/lib/enterprise-runtime-rbac.ts";
import { parseTicketLookupResponse } from "../src/lib/ticket-reference-lookup.ts";

const ID = "81000000-0000-8000-8000-000000000009";
const TENANT_ID = "10000000-0000-4000-8000-000000000001";
const API_BASE = "https://api.example.invalid";
const SERVER_BEARER = "synthetic-resolved-session";
const OPERATION_ID = "81000000-0000-8000-8000-000000000019";
const command = { request_id: OPERATION_ID, expected_revision: "a".repeat(64), status: "pending", reason: "Synthetic support review" };
const source = await readFile(new URL("../src/app/api/admin/[...path]/route.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("route.ts", source, ts.ScriptTarget.Latest, true);
const names = ["isDemoSession", "markDemoData", "dashboardSessionUnavailableResponse", "annotatePayload", "safeParseJson", "readBoundedAdminProxyBody", "forward", "forwardPrivateTicketRequest", "GET", "PATCH"];
const declarations = names.map(name => {
  const node = ast.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === name);
  assert.ok(node, `The actual admin proxy must still define ${name}`);
  return node.getText(ast).replace(/^export\s+/, "");
});
const compiled = ts.transpileModule(declarations.join("\n"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

function session(patch = {}) {
  return { role: "tenant-admin", tenantId: TENANT_ID, tenantSlug: "qa-a", permissions: ["leads.manage"], deniedPermissions: [], mfaVerified: true, isDemo: false, ...patch };
}

function payload(tenantSlug = "qa-a", global = false) {
  return {
    ok: true, protocol: "nexid.support-ticket-lookup.v1",
    scope: global ? { mode: "global", tenantId: null, tenantSlug: null } : { mode: "tenant", tenantId: TENANT_ID, tenantSlug },
    ticket: { id: ID, title: "Synthetic historical support ticket", detail: "Synthetic customer detail", detail_state: "available", status: "open", contact: null,
      created_at: "2020-01-02T03:04:05.000Z", source: "sun_public_report", category: "other", locale: "es-AR", bid: "QA-ONLY", tap_event_id: "715",
      tenant_id: TENANT_ID, tenant_slug: tenantSlug, tenant_name: "Synthetic tenant" },
  };
}

// Session resolution, fetch and Next's response adapter are explicit test boundaries.
// GET/PATCH/forward and all permission, tenant and demo policies execute the actual source.
// No process environment is changed and no request can reach a network or database.
function harness(options = {}) {
  const state = { requests: [], resolutions: [], demos: 0 };
  const bindings = {
    ...proxyPolicy, ...permissionPolicy, ...tenantPolicy, dashboardRoleToScope,
    API_BASE, MAX_ADMIN_PROXY_BODY_BYTES: 512 * 1024,
    NextResponse: Response,
    process: { env: { NODE_ENV: "production", REQUIRE_SCOPED_ADMIN_AUTH: "true", DEMO_MODE: "true", DEMO_FALLBACK_ALLOWED: "true", ...options.env } },
    console: { info() {}, warn() {}, error() {} },
    getDashboardSessionCredential: async configuration => {
      state.resolutions.push(configuration);
      if (options.sessionError) throw options.sessionError;
      const resolvedSession = options.session === undefined ? session() : options.session;
      return resolvedSession ? { session: resolvedSession, bearerToken: options.bearer === undefined ? SERVER_BEARER : options.bearer } : null;
    },
    isDashboardSessionUpstreamUnavailable: error => error?.code === "SYNTHETIC_SESSION_UNAVAILABLE",
    fetch: async (url, init) => {
      state.requests.push({ url, init });
      if (options.fetchError) throw options.fetchError;
      return options.upstream ? options.upstream() : Response.json(payload());
    },
    demoAdminResponse: () => {
      state.demos++;
      return Response.json({ ...payload(), demoMode: true, dataSource: "demo" });
    },
  };
  const { GET, PATCH } = new Function(...Object.keys(bindings), compiled + "\nreturn { GET, PATCH };")(...Object.values(bindings));
  const context = suffix => ({ params: Promise.resolve({ path: ["tickets", ID, ...suffix] }) });
  return {
    state,
    get: (query = "", headers = {}) => GET(new Request(`https://dashboard.example.invalid/api/admin/tickets/${ID}${query}`, { headers }), context([])),
    history: (query = "", headers = {}) => GET(new Request(`https://dashboard.example.invalid/api/admin/tickets/${ID}/history${query}`, { headers }), context(["history"])),
    patch: (body = JSON.stringify(command), query = "", overrides = {}) => {
      const headers = new Headers({ origin: "https://dashboard.example.invalid", "sec-fetch-site": "same-origin", "content-type": "application/json", "idempotency-key": OPERATION_ID });
      for (const [name, value] of Object.entries(overrides)) { if (value === null) headers.delete(name); else headers.set(name, value); }
      return PATCH(new Request(`https://dashboard.example.invalid/api/admin/tickets/${ID}${query}`, { method: "PATCH", body, headers, ...(body instanceof ReadableStream ? { duplex: "half" } : {}) }), context([]));
    },
  };
}

function privateResponse(response) {
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
}

async function outcome(response, tenant = "qa-a") {
  let body = null;
  try { body = await response.json(); } catch { /* A malformed upstream body is not a found ticket. */ }
  return parseTicketLookupResponse(response.status, body, ID, tenant, response.headers.get("x-nexid-data-mode"));
}

test("real GET forwards only the resolved bearer and canonical tenant, with no-store and no caller auth headers", async () => {
  const run = harness({ upstream: () => Response.json(payload(), { headers: { "cache-control": "public, max-age=3600" } }) });
  const response = await run.get("?tenant=%20QA-A%20", { authorization: "Bearer caller-forgery", cookie: "unrelated=private", "x-admin-tenant": "qa-b", "x-admin-role": "super-admin" });
  assert.equal(response.status, 200); privateResponse(response);
  assert.equal((await outcome(response)).status, "found");
  assert.deepEqual(run.state.resolutions, [{ persistRotation: true }]);
  assert.equal(run.state.requests.length, 1); assert.equal(run.state.demos, 0);
  const { url, init } = run.state.requests[0];
  assert.equal(url, `${API_BASE}/admin/tickets/${ID}?tenant=qa-a`);
  assert.equal(init.method, "GET"); assert.equal(init.cache, "no-store"); assert.equal(init.body, undefined);
  assert.equal(init.headers.get("authorization"), `Bearer ${SERVER_BEARER}`);
  for (const name of ["cookie", "x-admin-tenant", "x-admin-role"]) assert.equal(init.headers.get(name), null);
});

test("superadmin selected dotted tenant and global scope propagate exactly without invented tenant authority", async () => {
  for (const [query, slug] of [["?tenant=%20QA.ONLY%20", "qa.only"], ["", ""]]) {
    const run = harness({ session: session({ role: "super-admin", tenantId: null, tenantSlug: null }), upstream: () => Response.json(payload(slug || "qa-a", !slug)) });
    const response = await run.get(query); assert.equal(response.status, 200); privateResponse(response);
    const target = new URL(run.state.requests[0].url);
    assert.deepEqual(target.searchParams.getAll("tenant"), slug ? [slug] : []);
    assert.equal((await outcome(response, slug)).status, "found"); assert.equal(run.state.demos, 0);
  }
});

test("tenant-bound lookup injects its session tenant and rejects a foreign tenant without querying upstream", async () => {
  const valid = harness(); const success = await valid.get();
  assert.equal(success.status, 200); assert.equal(new URL(valid.state.requests[0].url).searchParams.get("tenant"), "qa-a");
  const invalid = harness(); const denied = await invalid.get("?tenant=qa-b");
  assert.equal(denied.status, 404); privateResponse(denied);
  assert.equal((await outcome(denied)).status, "not_found");
  assert.equal(invalid.state.requests.length, 0); assert.equal(invalid.state.demos, 0);
});

test("duplicate tenant selectors are rejected even when equal or the first value is empty", async () => {
  for (const query of ["?tenant=qa-a&tenant=qa-a", "?tenant=qa-a&tenant=qa-b", "?tenant=&tenant=qa-a"]) {
    for (const role of ["tenant-admin", "super-admin"]) {
      const run = harness({ session: session({ role }) }); const response = await run.get(query);
      assert.equal(response.status, 400); privateResponse(response);
      assert.equal((await response.json()).reason, "ticket_tenant_invalid");
      assert.equal(run.state.requests.length, 0); assert.equal(run.state.demos, 0);
    }
  }
});

test("invalid or missing session tenant and malformed global selector fail before upstream", async () => {
  for (const [patch, query] of [[{ tenantSlug: null }, ""], [{ tenantSlug: "bad/tenant" }, ""], [{ role: "super-admin", tenantId: null, tenantSlug: null }, "?tenant=bad%2Ftenant"]]) {
    const run = harness({ session: session(patch) }); const response = await run.get(query);
    assert.equal(response.status, 403); privateResponse(response); assert.equal(run.state.requests.length, 0);
  }
});

test("production auth failures and explicit high-impact permission denies are private and never reach the API", async () => {
  for (const [resolvedSession, status] of [
    [null, 401], [session({ permissions: [] }), 403], [session({ deniedPermissions: ["leads.manage"] }), 403],
    [session({ role: "super-admin", tenantId: null, tenantSlug: null, permissions: [] }), 403],
    [session({ role: "super-admin", tenantId: null, tenantSlug: null, permissions: [], deniedPermissions: ["leads.manage"] }), 403],
    [session({ role: "viewer" }), 403], [session({ role: "api-integration" }), 403], [session({ role: "unsupported-role" }), 403],
  ]) {
    const run = harness({ session: resolvedSession }); const response = await run.get();
    assert.equal(response.status, status); privateResponse(response);
    assert.equal((await outcome(response)).status, "forbidden");
    assert.equal(run.state.requests.length, 0); assert.equal(run.state.demos, 0);
  }
});

test("missing bearer, session unavailability and unexpected session exceptions cannot become demo success", async () => {
  for (const [options, status] of [
    [{ bearer: "" }, 502],
    [{ sessionError: Object.assign(new Error("Synthetic session outage"), { code: "SYNTHETIC_SESSION_UNAVAILABLE" }) }, 503],
    [{ sessionError: new Error("Synthetic unexpected private resolver failure") }, 503],
  ]) {
    const run = harness(options); const response = await run.get();
    assert.equal(response.status, status); privateResponse(response);
    assert.equal((await outcome(response)).status, "unconfirmed");
    assert.equal(run.state.requests.length, 0); assert.equal(run.state.demos, 0);
  }
});

test("demo sessions, demo cookie and explicit sandbox selectors are rejected before private API or demo fallback", async () => {
  for (const [options, query, headers] of [
    [{ session: session({ isDemo: true }) }, "", {}],
    [{}, "", { cookie: "nexid_dashboard_session=demo.synthetic" }],
    [{}, "?sandbox=1", {}], [{}, "?demoFallback=true", {}], [{}, "?sandbox=sandbox", {}],
  ]) {
    const run = harness(options); const response = await run.get(query, headers);
    assert.equal(response.status, 403); privateResponse(response);
    assert.equal((await response.json()).reason, "ticket_lookup_demo_unavailable");
    assert.equal(run.state.requests.length, 0); assert.equal(run.state.demos, 0);
  }
});

test("404 and 503 remain authoritative absence or uncertainty with demo fallback flags enabled", async () => {
  for (const status of [404, 503]) {
    const body = { ok: false, reason: status === 404 ? "ticket_not_found" : "ticket_lookup_unavailable" };
    const run = harness({ upstream: () => Response.json(body, { status, headers: { "cache-control": "public, max-age=3600" } }) });
    const response = await run.get();
    assert.equal(response.status, status); privateResponse(response);
    assert.equal(response.headers.get("x-nexid-data-mode"), "production");
    assert.equal((await outcome(response)).status, status === 404 ? "not_found" : "unconfirmed");
    assert.equal(run.state.requests.length, 1); assert.equal(run.state.demos, 0);
  }
});

test("upstream permission denial, resolver outage and transport failure stay private and never fake a ticket", async () => {
  for (const [options, expectedStatus, expectedOutcome] of [
    [{ upstream: () => Response.json({ ok: false }, { status: 401 }) }, 401, "forbidden"],
    [{ upstream: () => Response.json({ ok: false }, { status: 403 }) }, 403, "forbidden"],
    [{ upstream: () => Response.json({ ok: false }, { status: 503, headers: { "x-nexid-auth-outcome": "session-resolver-unavailable" } }) }, 503, "unconfirmed"],
    [{ fetchError: new Error("Synthetic transport failure") }, 502, "unconfirmed"],
  ]) {
    const run = harness(options); const response = await run.get();
    assert.equal(response.status, expectedStatus); privateResponse(response);
    assert.equal((await outcome(response)).status, expectedOutcome);
    assert.equal(run.state.requests.length, 1); assert.equal(run.state.demos, 0);
  }
});

test("malformed or mismatched upstream 200 is passed privately and the real lookup model cannot promote it to found", async () => {
  for (const upstream of [
    () => new Response("<html>synthetic failure</html>", { headers: { "content-type": "text/html" } }),
    () => Response.json({ ok: true }),
    () => Response.json({ ...payload(), demoMode: true }),
    () => Response.json(payload("qa-b")),
    () => Response.json({ ...payload(), ticket: { ...payload().ticket, id: "81000000-0000-8000-8000-000000000010" } }),
  ]) {
    const run = harness({ upstream }); const response = await run.get();
    assert.equal(response.status, 200); privateResponse(response);
    assert.equal((await outcome(response)).status, "unconfirmed");
    assert.equal(run.state.requests.length, 1); assert.equal(run.state.demos, 0);
  }
});

test("history GET forwards the selected tenant and opaque pagination cursor without changing scope", async () => {
  const body = { ok: true, protocol: "nexid.support-ticket-workflow.v1", items: [], nextCursor: null };
  const run = harness({ session: session({ role: "super-admin", tenantId: null, tenantSlug: null }), upstream: () => Response.json(body) });
  const response = await run.history("?tenant=QA.ONLY&cursor=915");
  assert.equal(response.status, 200); privateResponse(response); assert.deepEqual(await response.json(), body);
  const target = new URL(run.state.requests[0].url);
  assert.equal(target.pathname, `/admin/tickets/${ID}/history`);
  assert.equal(target.searchParams.get("tenant"), "qa.only"); assert.equal(target.searchParams.get("cursor"), "915");
  assert.equal(run.state.requests[0].init.method, "GET"); assert.equal(run.state.requests[0].init.cache, "no-store");
  assert.equal(run.state.demos, 0);
});

test("history and PATCH both enforce existing session, permission and tenant guards before API access", async () => {
  for (const action of ["history", "patch"]) {
    for (const [options, query, status] of [
      [{ session: null }, "", 401], [{ session: session({ permissions: [] }) }, "", 403],
      [{ session: session({ deniedPermissions: ["leads.manage"] }) }, "", 403],
      [{ session: session({ role: "super-admin", tenantId: null, tenantSlug: null, deniedPermissions: ["leads.manage"] }) }, "", 403],
      [{ session: session({ role: "viewer" }) }, "", 403], [{ session: session({ role: "api-integration" }) }, "", 403],
      [{}, "?tenant=qa-b", 404], [{}, "?tenant=qa-a&tenant=qa-a", 400], [{}, "?tenant=&tenant=qa-a", 400],
    ]) {
      const run = harness(options); const response = action === "history" ? await run.history(query) : await run.patch(undefined, query);
      assert.equal(response.status, status, `${action}: ${query || options.session?.role || "anonymous"}`); privateResponse(response);
      assert.equal(run.state.requests.length, 0); assert.equal(run.state.demos, 0);
    }
  }
});

test("history and PATCH never route demo sessions or explicit sandbox requests to private records", async () => {
  for (const action of ["history", "patch"]) {
    for (const [options, query, headers] of [
      [{ session: session({ isDemo: true }) }, "", {}], [{}, "", { cookie: "nexid_dashboard_session=demo.synthetic" }],
      [{}, "?sandbox=1", {}], [{}, "?demoFallback=true", {}],
    ]) {
      const run = harness(options); const response = action === "history" ? await run.history(query, headers) : await run.patch(undefined, query, headers);
      assert.equal(response.status, 403); privateResponse(response);
      assert.equal((await response.json()).reason, "ticket_lookup_demo_unavailable");
      assert.equal(run.state.requests.length, 0); assert.equal(run.state.demos, 0);
    }
  }
});

test("PATCH requires an exact same origin and rejects cross-site or sibling-site fetch metadata", async () => {
  for (const headers of [
    { origin: null }, { origin: "null" }, { origin: "https://attacker.example.invalid" },
    { origin: "https://dashboard.example.invalid.evil.invalid" }, { origin: "https://dashboard.example.invalid/" },
    { "sec-fetch-site": "cross-site" }, { "sec-fetch-site": "same-site" }, { "sec-fetch-site": "none" },
  ]) {
    const run = harness(); const response = await run.patch(undefined, "", headers);
    assert.equal(response.status, 403); privateResponse(response);
    assert.equal((await response.json()).reason, "ticket_transition_origin_forbidden");
    assert.equal(run.state.requests.length, 0); assert.equal(run.state.demos, 0);
  }
  const allowed = harness(); assert.equal((await allowed.patch(undefined, "", { "sec-fetch-site": null })).status, 200);
  assert.equal(allowed.state.requests.length, 1);
});

test("PATCH forwards the identical command and operation key using only the server-resolved bearer", async () => {
  const receipt = { ok: true, protocol: "nexid.support-ticket-workflow.v1", receipt: { operationId: OPERATION_ID, replayed: true } };
  const run = harness({ upstream: () => Response.json(receipt, { headers: { "cache-control": "public, max-age=300" } }) });
  const raw = JSON.stringify(command, null, 2);
  const response = await run.patch(raw, "?tenant=QA-A", { authorization: "Bearer caller-forgery", cookie: "unrelated=private", "x-admin-tenant": "qa-b", "x-admin-role": "super-admin", "x-nexid-trace-id": "synthetic-trace" });
  assert.equal(response.status, 200); privateResponse(response); assert.deepEqual(await response.json(), receipt);
  assert.equal(run.state.requests.length, 1); const { url, init } = run.state.requests[0];
  assert.equal(url, `${API_BASE}/admin/tickets/${ID}?tenant=qa-a`);
  assert.equal(init.method, "PATCH"); assert.equal(init.body, raw); assert.equal(init.cache, "no-store");
  assert.equal(init.headers.get("idempotency-key"), OPERATION_ID);
  assert.equal(init.headers.get("authorization"), `Bearer ${SERVER_BEARER}`);
  assert.equal(init.headers.get("x-nexid-trace-id"), "synthetic-trace");
  for (const name of ["cookie", "x-admin-tenant", "x-admin-role"]) assert.equal(init.headers.get(name), null);
  assert.equal(run.state.demos, 0);
});

test("PATCH requires JSON and an object before forwarding, while API remains command authority", async () => {
  for (const type of [null, "text/plain", "application/x-www-form-urlencoded", "application/jsonp"]) {
    const run = harness(); const response = await run.patch(undefined, "", { "content-type": type });
    assert.equal(response.status, 415); privateResponse(response); assert.equal(run.state.requests.length, 0);
  }
  for (const body of ["", "{broken", "null", "false", "7", '"string"', "[]"]) {
    const run = harness(); const response = await run.patch(body);
    assert.equal(response.status, 400); privateResponse(response); assert.equal(run.state.requests.length, 0);
  }
  // The proxy does not grant caller-supplied actor/tenant fields authority or turn
  // the API's explicit invalid-command rejection into a synthetic success.
  const run = harness({ upstream: () => Response.json({ ok: false, reason: "ticket_transition_invalid" }, { status: 400 }) });
  const response = await run.patch(JSON.stringify({ ...command, actorId: "forged", tenantId: "forged" }), "", { "content-type": "application/json; charset=utf-8" });
  assert.equal(response.status, 400); privateResponse(response); assert.equal((await response.json()).ok, false);
  assert.equal(run.state.requests.length, 1); assert.equal(run.state.demos, 0);
});

test("PATCH enforces a 16 KiB byte limit using declared and actual streamed content", async () => {
  const overlong = JSON.stringify({ reason: "x".repeat(16 * 1024) });
  const multibyte = JSON.stringify({ reason: "é".repeat(9000) });
  assert.ok(multibyte.length < 16 * 1024); assert.ok(Buffer.byteLength(multibyte) > 16 * 1024);
  for (const [body, headers] of [[JSON.stringify(command), { "content-length": String(16 * 1024 + 1) }], [overlong, {}], [overlong, { "content-length": "1" }], [multibyte, {}]]) {
    const run = harness(); const response = await run.patch(body, "", headers);
    assert.equal(response.status, 413); privateResponse(response); assert.equal(run.state.requests.length, 0); assert.equal(run.state.demos, 0);
  }
  const streamed = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{"reason":"')); controller.enqueue(new Uint8Array(16 * 1024).fill(120)); controller.close(); } });
  const run = harness(); const response = await run.patch(streamed);
  assert.equal(response.status, 413); privateResponse(response); assert.equal(run.state.requests.length, 0);
});

test("PATCH read failure is private and does not send a partial command", async () => {
  const body = new ReadableStream({ start(controller) { controller.error(new Error("Synthetic input stream failure")); } });
  const run = harness(); const response = await run.patch(body);
  assert.equal(response.status, 400); privateResponse(response); assert.equal((await response.json()).reason, "admin_proxy_body_read_failed");
  assert.equal(run.state.requests.length, 0); assert.equal(run.state.demos, 0);
});

test("history and PATCH preserve upstream conflicts and failures with private headers and no fallback", async () => {
  for (const action of ["history", "patch"]) {
    for (const status of [401, 403, 404, 409, 429, 503]) {
      const body = { ok: false, reason: status === 409 ? "ticket_revision_conflict" : "synthetic_upstream_denial" };
      const run = harness({ upstream: () => Response.json(body, { status, headers: { "cache-control": "public, max-age=300" } }) });
      const response = action === "history" ? await run.history() : await run.patch();
      assert.equal(response.status, status); privateResponse(response); assert.deepEqual(await response.json(), body);
      assert.equal(run.state.requests.length, 1); assert.equal(run.state.demos, 0);
    }
  }
});

test("history and PATCH session and transport failures cannot produce a successful receipt", async () => {
  for (const action of ["history", "patch"]) {
    for (const [options, status, requests] of [
      [{ sessionError: new Error("Synthetic private resolver failure") }, 503, 0],
      [{ sessionError: Object.assign(new Error("Synthetic resolver unavailable"), { code: "SYNTHETIC_SESSION_UNAVAILABLE" }) }, 503, 0],
      [{ fetchError: new Error("Synthetic uncertain network outcome") }, 502, 1],
    ]) {
      const run = harness(options); const response = action === "history" ? await run.history() : await run.patch();
      assert.equal(response.status, status); privateResponse(response); const body = await response.json();
      assert.equal(body.ok, false); assert.equal(body.receipt, undefined);
      assert.equal(run.state.requests.length, requests); assert.equal(run.state.demos, 0);
    }
  }
});

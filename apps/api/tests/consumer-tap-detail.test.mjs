import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const CONSUMER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_CONSUMER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TENANT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OTHER_TENANT = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const BATCH = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const PRODUCT = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const EVENT_ID = "9001";
const EVENT_TIME = "2026-09-03T10:04:00.000Z";
const HISTORY_TIME = "2026-09-04T12:00:00.000Z";
const UID = "04A1B2C3D4E5F6";
const PRIVATE_TOKEN = "private-fixture-session-token";
const PRIVATE_ERROR = `private database error ${UID} ${PRIVATE_TOKEN}`;
const PUBLIC_KEYS = ["tap_event_id", "verdict", "risk_level", "city", "country", "created_at", "tenant_slug", "tenant_name"];
const modules = {
  detail: "../src/lib/consumer-tap-detail.ts",
  route: "../src/app/consumer/taps/[eventId]/route.ts",
};
const compiled = Object.fromEntries(Object.entries(modules).map(([name, path]) => [name,
  ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    fileName: `${name}.ts`,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText,
]));

const event = (overrides = {}) => ({
  id: EVENT_ID, tenant_id: TENANT, batch_id: BATCH,
  result: "VALID_CLOSED", risk_level: "low", city: "Mendoza", country_code: "AR", created_at: EVENT_TIME,
  uid_hex: UID, tag_id: "shared-fixture-tag", raw_query: { token: PRIVATE_TOKEN }, meta: { private: PRIVATE_TOKEN },
  lat: -32.123456, lng: -68.654321, ...overrides,
});
const history = (overrides = {}) => ({
  id: "5001", consumer_id: CONSUMER, tenant_id: TENANT, tap_event_id: EVENT_ID,
  verdict: "SAVED_VERDICT", risk_level: "medium", city: "Godoy Cruz", country: "Argentina", created_at: HISTORY_TIME,
  ...overrides,
});
const product = (overrides = {}) => ({
  id: PRODUCT, consumer_id: CONSUMER, tenant_id: TENANT, first_tap_event_id: EVENT_ID, latest_tap_event_id: "9002",
  ownership_status: "viewed", product_name: "Vino de la colección", brand_name: "Bodega de prueba",
  tag_id: "shared-fixture-tag", product_passport_id: UID, updated_at: HISTORY_TIME, ...overrides,
});

function assertSqlBoundary(statement, values) {
  const sql = statement.replace(/\s+/g, " ").trim();
  assert.match(sql, /^SELECT /);
  assert.match(sql, /FROM events event JOIN tenants tenant ON tenant\.id = event\.tenant_id/);
  assert.match(sql, /LEFT JOIN consumer_tap_history history ON history\.consumer_id = \?::uuid AND history\.tenant_id = event\.tenant_id AND history\.tap_event_id = event\.id/);
  assert.match(sql, /FROM consumer_products cp WHERE cp\.consumer_id = \?::uuid AND cp\.tenant_id = event\.tenant_id AND \(cp\.first_tap_event_id = event\.id OR cp\.latest_tap_event_id = event\.id\)/);
  assert.match(sql, /LEFT JOIN batches batch ON batch\.id = event\.batch_id AND batch\.tenant_id = event\.tenant_id/);
  assert.match(sql, /WHERE event\.id = \?::bigint AND \(history\.id IS NOT NULL OR product\.id IS NOT NULL\) LIMIT 2$/);
  assert.match(sql, /CASE WHEN history\.id IS NOT NULL THEN history\.risk_level ELSE event\.risk_level::text END AS risk_level/);
  assert.match(sql, /CASE WHEN history\.id IS NOT NULL THEN history\.created_at ELSE event\.created_at END AS created_at/);
  assert.doesNotMatch(sql, /\*|\b(?:uid_hex|tag_id|product_passport_id|raw_query|raw_url|metadata_json|meta|lat|lng|geo_lat|geo_lng|session_token|token|ip|user_agent)\b/i);
  assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE)\b/i);
  assert.doesNotMatch(sql, /cp\.ownership_status/);
  const projection = sql.slice(0, sql.indexOf(" FROM events event"));
  for (const key of PUBLIC_KEYS) assert.match(projection, new RegExp(`\\bAS ${key}\\b`));
  assert.match(projection, /product\.product_name, product\.brand_name, batch\.bid$/);
  assert.equal(values.length, 3);
  assert.equal(values[0], values[1], "history and product must use the same authenticated consumer binding");
  assert.equal(typeof values[2], "string", "bigint event identifiers must never pass through JS Number");
  return { consumerId: values[0], eventId: values[2] };
}

// This executor first checks the actual production SQL's authorization and
// projection, then evaluates fixtures using the same explicit predicates. A
// missing SQL tenant/owner guard fails before the model can hide the regression.
function fixtureExecutor(options = {}) {
  const queries = [];
  const events = options.events ?? [event()];
  const histories = options.histories ?? [history()];
  const products = options.products ?? [];
  const tenants = options.tenants ?? [{ id: TENANT, slug: "bodega-prueba", name: "Bodega Prueba" }, { id: OTHER_TENANT, slug: "other-tenant", name: "Other Tenant" }];
  const batches = options.batches ?? [{ id: BATCH, tenant_id: TENANT, bid: "BID-PRUEBA" }];
  const executor = async (strings, ...values) => {
    const statement = strings.join("?");
    queries.push({ statement, values });
    const { consumerId, eventId } = assertSqlBoundary(statement, values);
    if (options.queryError) throw options.queryError;
    const rows = [];
    for (const currentEvent of events.filter((item) => String(item.id) === eventId)) {
      const tenant = tenants.find((item) => item.id === currentEvent.tenant_id);
      if (!tenant) continue;
      const ownHistory = histories.find((item) => item.consumer_id === consumerId && item.tenant_id === currentEvent.tenant_id && String(item.tap_event_id) === eventId);
      const ownProduct = products.filter((item) => item.consumer_id === consumerId && item.tenant_id === currentEvent.tenant_id
        && [item.first_tap_event_id, item.latest_tap_event_id].some((id) => id != null && String(id) === eventId))
        .sort((left, right) => right.updated_at.localeCompare(left.updated_at) || right.id.localeCompare(left.id))[0];
      if (!ownHistory && !ownProduct) continue;
      const batch = batches.find((item) => item.id === currentEvent.batch_id && item.tenant_id === currentEvent.tenant_id);
      rows.push({
        tap_event_id: String(currentEvent.id),
        verdict: ownHistory ? ownHistory.verdict : currentEvent.result,
        risk_level: ownHistory ? ownHistory.risk_level : currentEvent.risk_level,
        city: ownHistory ? ownHistory.city : currentEvent.city,
        country: ownHistory ? ownHistory.country : currentEvent.country_code,
        created_at: ownHistory ? ownHistory.created_at : currentEvent.created_at,
        tenant_slug: tenant.slug, tenant_name: tenant.name,
        product_name: ownProduct?.product_name ?? null, brand_name: ownProduct?.brand_name ?? null,
        bid: batch?.bid ?? null, ...options.extraReturnedColumns,
      });
    }
    return rows.slice(0, 2);
  };
  return { executor, queries };
}

function harness(options = {}) {
  const fixture = fixtureExecutor(options);
  const events = [], logs = [];
  const loaded = {};
  const bindings = {
    process: { env: {} }, fetch: () => { throw new Error("unexpected_network_blocked"); },
    console: Object.fromEntries(["log", "info", "warn", "error", "debug"].map((level) => [level, (...args) => logs.push({ level, args })])),
  };
  const fakeRequire = (name) => {
    if (name === "./db") return { sql: fixture.executor };
    if (name.endsWith("/consumer-tap-detail")) return loaded.detail;
    if (name.endsWith("/consumer-auth")) return { getConsumerFromRequest: async () => {
      events.push("authenticate");
      if (options.authError) throw options.authError;
      return options.unauthenticated ? null : { id: options.consumerId || CONSUMER };
    } };
    if (name.endsWith("/http")) return { json: (body, status = 200, headers = {}) => Response.json(body, { status, headers }) };
    throw new Error(`Unexpected private tap dependency blocked: ${name}`);
  };
  for (const name of Object.keys(modules)) {
    const module = { exports: {} };
    new Function("require", "module", "exports", ...Object.keys(bindings), compiled[name])(
      fakeRequire, module, module.exports, ...Object.values(bindings),
    );
    loaded[name] = module.exports;
  }
  return {
    ...loaded, ...fixture, events, logs,
    get: (eventId = EVENT_ID, headers = {}) => loaded.route.GET(new Request(`https://api.nexid.test/consumer/taps/${encodeURIComponent(String(eventId))}`, { headers }), {
      params: { then(resolve, reject) {
        events.push("params");
        if (options.paramsError) reject(options.paramsError);
        else resolve({ eventId });
      } },
    }),
  };
}

async function responseBody(h, status, eventId = EVENT_ID, headers = {}) {
  const response = await h.get(eventId, headers);
  assert.equal(response.status, status);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const body = await response.json();
  const output = JSON.stringify(body);
  for (const value of [UID, PRIVATE_TOKEN, PRIVATE_ERROR]) assert.equal(output.includes(value), false, "private detail leaked in API output");
  assert.equal(h.logs.length, 0);
  return body;
}

test("consumer authentication precedes awaiting parameters and all tap queries, including malformed IDs", async () => {
  for (const id of [EVENT_ID, "invalid", "01", "9223372036854775808"]) {
    const h = harness({ unauthenticated: true, paramsError: new Error(PRIVATE_ERROR) });
    assert.deepEqual(await responseBody(h, 401, id), { ok: false, error: "unauthorized" });
    assert.deepEqual(h.events, ["authenticate"]);
    assert.equal(h.queries.length, 0);
  }
});

test("event IDs are canonical positive PostgreSQL bigint strings without precision loss", async () => {
  const h = harness();
  for (const id of ["1", EVENT_ID, "9007199254740993", "9223372036854775807"]) {
    assert.equal(h.detail.canonicalConsumerTapEventId(id), id);
    const matching = harness({ events: [event({ id })], histories: [history({ tap_event_id: id })] });
    const body = await responseBody(matching, 200, id);
    assert.equal(body.item.tap_event_id, id);
    assert.equal(matching.queries[0].values[2], id);
  }
  for (const id of [undefined, null, 1, 1n, "", "0", "01", " 1", "1 ", "+1", "-1", "1.0", "1e3", "1\n", "abc", "9223372036854775808", "99999999999999999999"]) {
    assert.equal(h.detail.canonicalConsumerTapEventId(id), null);
    const rejected = harness();
    // Pass null/non-string parameters directly to exercise runtime validation.
    const body = await responseBody(rejected, 400, id === undefined ? null : id);
    assert.deepEqual(body, { ok: false, error: "invalid_event_id" });
    assert.equal(rejected.queries.length, 0);
  }
});

test("own history supplies all saved fields and its timestamp, without falling back over explicit nulls", async () => {
  const h = harness();
  assert.deepEqual(await responseBody(h, 200), { ok: true, item: {
    tap_event_id: EVENT_ID, verdict: "SAVED_VERDICT", risk_level: "medium", city: "Godoy Cruz", country: "Argentina",
    created_at: HISTORY_TIME, tenant_slug: "bodega-prueba", tenant_name: "Bodega Prueba", bid: "BID-PRUEBA",
  } });
  const nullHistory = harness({ histories: [history({ verdict: null, risk_level: null, city: null, country: null, created_at: null })] });
  const { item } = await responseBody(nullHistory, 200);
  for (const key of ["verdict", "risk_level", "city", "country", "created_at"]) assert.equal(item[key], null);
});

test("own viewed product authorizes only its exact first or latest reference when no history exists", async () => {
  for (const reference of ["first_tap_event_id", "latest_tap_event_id"]) {
    const ownProduct = product({ first_tap_event_id: "8000", latest_tap_event_id: "9002", [reference]: EVENT_ID });
    const h = harness({ histories: [], products: [ownProduct] });
    assert.deepEqual(await responseBody(h, 200), { ok: true, item: {
      tap_event_id: EVENT_ID, verdict: "VALID_CLOSED", risk_level: "low", city: "Mendoza", country: "AR", created_at: EVENT_TIME,
      tenant_slug: "bodega-prueba", tenant_name: "Bodega Prueba", product_name: ownProduct.product_name,
      brand_name: ownProduct.brand_name, bid: "BID-PRUEBA",
    } });
  }
});

test("another consumer's history or product reference is indistinguishable from a missing event", async () => {
  const missing = await responseBody(harness({ events: [] }), 404);
  assert.deepEqual(missing, { ok: false, error: "tap_not_found" });
  for (const options of [
    { histories: [history({ consumer_id: OTHER_CONSUMER })] },
    { histories: [], products: [product({ consumer_id: OTHER_CONSUMER })] },
  ]) {
    const h = harness(options);
    assert.deepEqual(await responseBody(h, 404, EVENT_ID, { "x-consumer-id": OTHER_CONSUMER, "x-tenant-id": OTHER_TENANT }), missing);
    assert.deepEqual(h.queries[0].values.slice(0, 2), [CONSUMER, CONSUMER]);
  }
});

test("a history or product reference with the wrong tenant cannot grant access", async () => {
  for (const options of [
    { histories: [history({ tenant_id: OTHER_TENANT })] },
    { histories: [], products: [product({ tenant_id: OTHER_TENANT })] },
    { histories: [history()], products: [product()], events: [event({ tenant_id: OTHER_TENANT })] },
  ]) assert.deepEqual(await responseBody(harness(options), 404), { ok: false, error: "tap_not_found" });
});

test("batch tenant mismatch omits bid while preserving the authorized event", async () => {
  const h = harness({ batches: [{ id: BATCH, tenant_id: OTHER_TENANT, bid: "OTHER-TENANT-PRIVATE-BID" }] });
  const body = await responseBody(h, 200);
  assert.equal(Object.hasOwn(body.item, "bid"), false);
  assert.equal(JSON.stringify(body).includes("OTHER-TENANT-PRIVATE-BID"), false);
});

test("sharing a tag, UID or batch without an exact first/latest reference never grants tap access", async () => {
  const h = harness({ histories: [], products: [product({ first_tap_event_id: "8000", latest_tap_event_id: "9002" })] });
  assert.deepEqual(await responseBody(h, 404), { ok: false, error: "tap_not_found" });
});

test("two authorized partitioned event rows with the same ID are rejected as ambiguous", async () => {
  const h = harness({ events: [event(), event({ created_at: "2026-09-05T10:04:00.000Z", city: "Ambiguous" })] });
  assert.deepEqual(await responseBody(h, 404), { ok: false, error: "tap_not_found" });
  assert.equal(h.queries.length, 1);
});

test("a duplicate ID in a tenant with no owned reference cannot supply data or create ambiguity", async () => {
  const h = harness({ events: [event(), event({ tenant_id: OTHER_TENANT, city: "PRIVATE OTHER TENANT" })] });
  const body = await responseBody(h, 200);
  assert.equal(body.item.tenant_slug, "bodega-prueba");
  assert.equal(JSON.stringify(body).includes("PRIVATE OTHER TENANT"), false);
});

test("optional product and brand names only come from an exact owned product reference in the same tenant", async () => {
  for (const unrelated of [
    product({ consumer_id: OTHER_CONSUMER }), product({ tenant_id: OTHER_TENANT }),
    product({ first_tap_event_id: "8000", latest_tap_event_id: "9002" }),
  ]) {
    const h = harness({ products: [unrelated], events: [event({ product_name: "EVENT-PRIVATE-LABEL" })] });
    const body = await responseBody(h, 200);
    assert.equal(Object.hasOwn(body.item, "product_name"), false);
    assert.equal(Object.hasOwn(body.item, "brand_name"), false);
    assert.equal(JSON.stringify(body).includes("EVENT-PRIVATE-LABEL"), false);
  }
});

test("legacy product names containing the full UID fallback are omitted", async () => {
  for (const name of [`Producto ${UID}`, `  producto   ${UID.toLowerCase()}  `]) {
    const h = harness({ products: [product({ product_name: name })] });
    const body = await responseBody(h, 200);
    assert.equal(Object.hasOwn(body.item, "product_name"), false);
    assert.equal(body.item.brand_name, "Bodega de prueba");
  }
});

test("response projection ignores unexpected private fields even if returned by the database adapter", async () => {
  const h = harness({ products: [product()], extraReturnedColumns: {
    uid_hex: UID, product_passport_id: UID, token: PRIVATE_TOKEN, raw_query: { secret: PRIVATE_TOKEN },
    metadata_json: { private: PRIVATE_TOKEN }, lat: -32.123456, lng: -68.654321, geo_lat: -32.123456, geo_lng: -68.654321,
    tenant_id: TENANT, consumer_id: CONSUMER, session_token: PRIVATE_TOKEN,
  } });
  const body = await responseBody(h, 200);
  assert.deepEqual(Object.keys(body.item).sort(), [...PUBLIC_KEYS, "product_name", "brand_name", "bid"].sort());
  assert.doesNotMatch(JSON.stringify(body), /-32\.123456|-68\.654321/);
});

test("invalid timestamps and non-text optional values are normalized without exposing arbitrary objects", async () => {
  const h = harness({ extraReturnedColumns: {
    created_at: "not-a-date", verdict: { raw: PRIVATE_TOKEN }, risk_level: 7, city: null,
    country: " AR ", product_name: {}, brand_name: 123, bid: [],
  } });
  const { item } = await responseBody(h, 200);
  assert.equal(item.created_at, null);
  assert.equal(item.verdict, null);
  assert.equal(item.risk_level, null);
  assert.equal(item.country, "AR");
  for (const key of ["product_name", "brand_name", "bid"]) assert.equal(Object.hasOwn(item, key), false);
});

test("authentication, parameter and database exceptions produce the same sanitized private 503 without logs", async () => {
  for (const options of [{ authError: new Error(PRIVATE_ERROR) }, { paramsError: new Error(PRIVATE_ERROR) }, { queryError: new Error(PRIVATE_ERROR) }]) {
    const h = harness(options);
    assert.deepEqual(await responseBody(h, 503), { ok: false, error: "unavailable" });
  }
});

test("helper rejects invalid consumer identity and mismatched database event identity", async () => {
  const h = harness();
  assert.equal(await h.detail.getPrivateConsumerTapDetail("not-a-consumer-uuid", EVENT_ID, h.executor), null);
  assert.equal(h.queries.length, 0);
  const mismatched = harness({ extraReturnedColumns: { tap_event_id: "9002" } });
  assert.deepEqual(await responseBody(mismatched, 404), { ok: false, error: "tap_not_found" });
});

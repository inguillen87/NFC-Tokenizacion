import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";
import ts from "typescript";
import { createAnalyticsLocationSql } from "../src/lib/analytics-location-sql.ts";
import { postTapBrowserLocation } from "../src/lib/post-tap-location-projection.ts";
import * as analytics from "../src/lib/analytics.ts";
import * as core from "../../../packages/core/src/index.ts";
import { SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE } from "../src/lib/sun-automated-fetch.ts";

function qaTarget(value) {
  const target = new URL(value || "http://missing.invalid");
  assert.ok(["postgres:", "postgresql:"].includes(target.protocol), "Explicit PostgreSQL QA URL required");
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(target.hostname), "Only loopback PostgreSQL is allowed");
  assert.equal(decodeURIComponent(target.pathname), "/nexid_e2e_s7");
  assert.equal(decodeURIComponent(target.username), "nexid_e2e");
  assert.equal(target.search, "", "Connection option overrides are not permitted");
  assert.equal(target.hash, "");
  return target.toString();
}

test("analytics PostgreSQL harness rejects missing, remote and non-QA targets", () => {
  for (const value of [undefined, "postgres://nexid_e2e@remote.example/nexid_e2e_s7", "postgres://nexid_e2e@localhost/production", "postgres://postgres@localhost/nexid_e2e_s7", "postgres://nexid_e2e@localhost/nexid_e2e_s7?options=anything"]) {
    assert.throws(() => qaTarget(value));
  }
});

function observation(overrides = {}) {
  return { source: "browser_geolocation_approximate_consent", consent: true, precision: "approximate",
    lat: -32.891234, lng: -68.841234, accuracyM: 150, city: "Consented town", countryCode: "CL", ...overrides };
}

// Real PostgreSQL, actual route SQL and helper; authorization alone is a local
// inert adapter. All fixtures live in one generated schema rolled back at exit.
test("analytics geography uses the same consented event observation across real SQL reads", {
  skip: !process.env.NEXID_S7_QA_DATABASE_URL ? "Set the explicit loopback nexid_e2e_s7 QA target" : false,
  timeout: 90_000,
}, async () => {
  const client = new pg.Client({ connectionString: qaTarget(process.env.NEXID_S7_QA_DATABASE_URL), connectionTimeoutMillis: 10000, query_timeout: 20000 });
  const schema = `analytics_location_qa_${randomUUID().replaceAll("-", "")}`;
  assert.match(schema, /^analytics_location_qa_[a-f0-9]{32}$/);
  const tenantA = "10000000-0000-4000-8000-000000000001";
  const tenantB = "10000000-0000-4000-8000-000000000002";
  const batchA = "20000000-0000-4000-8000-000000000001";
  const batchB = "20000000-0000-4000-8000-000000000002";
  let reads = 0;
  let binding;
  try {
    await client.connect();
    const identity = (await client.query("SELECT current_database() AS db, current_user AS role")).rows[0];
    assert.equal(identity.db, "nexid_e2e_s7");
    assert.equal(identity.role, "nexid_e2e");
    await client.query("BEGIN");
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET LOCAL search_path TO "${schema}", pg_catalog`);
    await client.query("SET LOCAL statement_timeout='15000'; SET LOCAL lock_timeout='5000'");
    await client.query(`
      CREATE TABLE tenants(id uuid PRIMARY KEY, slug text);
      CREATE TABLE batches(id uuid PRIMARY KEY, tenant_id uuid, bid text, status text);
      CREATE TABLE events(id bigint PRIMARY KEY, tenant_id uuid, batch_id uuid, tag_id text, uid_hex text,
        event_type text, result text, verdict text, reason text, cmac_ok boolean, allowlisted boolean,
        source text, created_at timestamptz DEFAULT now(), city text, country_code text, lat float8, lng float8,
        geo_city text, geo_country text, geo_lat float8, geo_lng float8,
        location_source text, location_accuracy_m float8, post_tap_location_observation jsonb,
        device_label text, user_agent text, meta jsonb DEFAULT '{}'::jsonb);
      CREATE TABLE tags(id uuid PRIMARY KEY, batch_id uuid, uid_hex text);
      CREATE TABLE tag_profiles(tag_id uuid, product_name text, sku text, winery text, region text, vintage text);
      CREATE TABLE product_passports(tag_id uuid, product_name text, winery_name text, region text, vintage text,
        winery_lat float8, winery_lng float8, winery_address text, provenance_text text);
      CREATE TABLE tokenization_requests(batch_id uuid, uid_hex text, status text, network text, tx_hash text, token_id text, requested_at timestamptz);
    `);
    await client.query("INSERT INTO tenants VALUES($1,'qa-location-a'),($2,'qa-location-b')", [tenantA, tenantB]);
    await client.query("INSERT INTO batches VALUES($1,$2,'QA-A','active'),($3,$4,'QA-B','active')", [batchA, tenantA, batchB, tenantB]);
    await client.query("INSERT INTO tags VALUES('30000000-0000-4000-8000-000000000001',$1,'SYNTHETIC_QA_UNIT')", [batchA]);
    const original = { city: "Original IP town", country_code: "AR", lat: -34.6, lng: -58.38,
      geo_city: "Original edge town", geo_country: "AR", geo_lat: -35, geo_lng: -59,
      location_source: "edge_ip_approx", location_accuracy_m: null };
    await client.query(`INSERT INTO events(id,tenant_id,batch_id,tag_id,uid_hex,event_type,result,verdict,cmac_ok,allowlisted,source,city,country_code,lat,lng,geo_city,geo_country,geo_lat,geo_lng,location_source,device_label,user_agent)
      VALUES(715,$1,$2,'30000000-0000-4000-8000-000000000001','SYNTHETIC_QA_UNIT','TAP_VALID','VALID_OPENED','valid',true,true,'real',$3,$4,$5,$6,$7,$8,$9,$10,$11,'QA browser','Mozilla/5.0')`,
      [tenantA, batchA, ...Object.values(original).slice(0,9)]);
    const execute = async (strings, ...values) => {
      const statement = strings.reduce((out, part, index) => out + (index ? `$${index}` : "") + part, "");
      assert.match(statement.trim(), /^(SELECT|WITH)\b/i);
      assert.doesNotMatch(statement, /\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE)\b|\bpublic\s*\./i);
      reads++;
      return (await client.query(statement, values)).rows;
    };
    const locationSql = createAnalyticsLocationSql(execute);
    const project = async () => (await locationSql`SELECT event_location.* FROM events e /* analytics_event_location */ WHERE e.id = ${715}`)[0];
    const cases = [
      null, [], "malformed", true, {}, observation(), observation({ source: "browser_gps_approximate_consent" }),
      observation({ city: null, countryCode: null }), observation({ city: {}, countryCode: [] }),
      observation({ consent: false }), observation({ consent: "true" }), observation({ precision: "exact" }),
      observation({ source: "edge_ip_approx" }), observation({ lat: null }), observation({ lng: "" }),
      observation({ lat: [1] }), observation({ accuracyM: { value: 150 } }), observation({ lat: 91 }),
      observation({ lng: -181 }), observation({ accuracyM: 149 }), observation({ accuracyM: 50001 }),
      observation({ accuracyM: 50000 }), observation({ lat: -90, lng: 180 }),
      observation({ lat: " -32.89 ", lng: "-6.884e1", accuracyM: "150" }),
      observation({ lat: "bad" }), observation({ lat: "1e999999" }), observation({ accuracyM: "Infinity" }),
      observation({ lat: "NaN" }), observation({ lat: -32.8905, lng: -68.8405 }),
      observation({ lat: 0, lng: 0 }), observation({ lat: -0.0001, lng: 0.0001 }),
      observation({ source: " BROWSER_GPS_APPROXIMATE_CONSENT ", precision: " APPROXIMATE " }),
      observation({ city: 0, countryCode: 0 }),
    ];
    for (const [index, value] of cases.entries()) {
      await client.query("UPDATE events SET post_tap_location_observation=$1::jsonb WHERE id=715", [JSON.stringify(value)]);
      const projected = await project();
      const expected = postTapBrowserLocation({ post_tap_location_observation: value });
      assert.equal(projected.post_tap_observation_applied, Boolean(expected), `case ${index} admission`);
      assert.deepEqual(JSON.parse(JSON.stringify({ city: projected.city, country: projected.country_code, lat: projected.lat, lng: projected.lng, source: projected.location_source, accuracyM: projected.location_accuracy_m })), JSON.parse(JSON.stringify(expected
        ? { city: expected.city, country: expected.country, ...expected.coordinate, source: expected.source, accuracyM: expected.accuracyM }
        : { city: original.city, country: original.country_code, lat: original.lat, lng: original.lng, source: original.location_source, accuracyM: null })), `case ${index} projection`);
    }

    // Execute the actual handler's queries and response projection. Only auth and
    // the separately tested physical reader are inert local adapters.
    const route = await readFile(new URL("../src/app/admin/analytics/route.ts", import.meta.url), "utf8");
    const parsed = ts.createSourceFile("route.ts", route, ts.ScriptTarget.ES2022, true);
    const code = ts.transpileModule(parsed.statements.filter(node => !ts.isImportDeclaration(node)).map(node => node.getText(parsed).replace(/^export\s+/, "")).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
    binding = {
      sql: execute, analyticsLocationSql: locationSql,
      checkAdminWithPermission: async () => null, checkAdminPermission: () => null,
      getAdminTenantAccess: (_request, requested) => ({ effectiveTenantSlug: requested }),
      json: data => Response.json(data), ...analytics,
      aggregateTenantMetrics: core.aggregateTenantMetrics, EVENT_TAXONOMY_VERSION: core.EVENT_TAXONOMY_VERSION,
      SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE,
      classifyPhysicalTapSealState: value => value === "VALID_OPENED" ? "opened" : "other",
      isAuthenticatedNfcMessage: () => true,
      listAdminPhysicalTaps: async () => ({ availability: "unavailable", summary: null, rows: [] }),
    };
    const get = new Function(...Object.keys(binding), `${code}\nreturn GET;`)(...Object.values(binding));
    const read = async (tenant = "qa-location-a", country = "") => (await get(new Request("http://127.0.0.1/admin/analytics?" + new URLSearchParams({ tenant, country, source: "real", range: "24h" })))).json();
    await client.query("UPDATE events SET post_tap_location_observation=$1::jsonb WHERE id=715", [JSON.stringify(observation())]);
    await client.query(`INSERT INTO events SELECT 716,$1,$2,tag_id,'OTHER_TENANT_UNIT',event_type,result,verdict,reason,cmac_ok,allowlisted,source,created_at,city,country_code,lat,lng,geo_city,geo_country,geo_lat,geo_lng,location_source,location_accuracy_m,$3::jsonb,device_label,user_agent,meta FROM events WHERE id=715`, [tenantB, batchB, JSON.stringify(observation({ city: "Other tenant town" }))]);
    const before = (await client.query("SELECT md5(string_agg(to_jsonb(e)::text,'' ORDER BY id)) AS digest FROM events e")).rows[0].digest;
    const data = await read();
    assert.equal(data.kpis.scans, 1, "location enrichment does not create a second scan");
    assert.ok(!JSON.stringify(data).includes("Other tenant town"), "tenant geometry cannot cross into another tenant");
    const geo = data.geoPoints;
    assert.equal(geo.length, 1);
    assert.equal(geo[0].city, "Consented town");
    assert.equal(geo[0].lat, -32.891);
    assert.equal(geo[0].coordinateSource, "browser_approximate_consent");
    assert.equal(geo[0].coordinateAccuracyMeters, 150);
    assert.equal(data.geography.countries[0].country, "CL");
    assert.equal(data.geography.cities[0].city, "Consented town");
    assert.equal(data.feed[0].city, "Consented town");
    assert.equal(data.products[0].lastVerifiedCity, "Consented town");
    assert.equal(data.tagJourney[0].current.city, "Consented town");
    assert.equal(data.tagJourney[0].current.lat, -32.891);
    const accepted = await read("qa-location-a", "CL");
    const excluded = await read("qa-location-a", "AR");
    assert.equal(accepted.feed.length, 1);
    assert.equal(excluded.feed.length, 0, "country filter uses the consented observation rather than stale IP");
    assert.equal(accepted.geography.cities.length, 1);
    assert.equal(excluded.geography.cities.length, 0);
    assert.equal(accepted.deviceSignals.length, 1);
    assert.equal(excluded.deviceSignals.length, 0);
    assert.equal(accepted.trend.length, 1);
    assert.equal(excluded.trend.length, 0);
    const global = await read("");
    assert.equal(global.kpis.scans, 2);
    assert.equal(global.geoPoints.length, 2);
    assert.equal((await client.query("SELECT md5(string_agg(to_jsonb(e)::text,'' ORDER BY id)) AS digest FROM events e")).rows[0].digest, before, "production SELECTs preserve all original event evidence");

    // Denial/malformed observations retain original IP evidence. Valid consent
    // without reverse-geocoded labels never borrows the original IP city.
    for (const value of [observation({ consent: false }), observation({ accuracyM: "broken" })]) {
      await client.query("UPDATE events SET post_tap_location_observation=$1::jsonb WHERE id=715", [JSON.stringify(value)]);
      const fallback = await read();
      assert.equal(fallback.kpis.scans, 1);
      assert.equal(fallback.geoPoints[0].city, original.city);
      assert.equal(fallback.geoPoints[0].lat, original.lat);
      assert.equal(fallback.geoPoints[0].coordinateSource, "ip_approx");
      assert.equal(fallback.geoPoints[0].coordinateAccuracyMeters, null);
      assert.equal((await read("qa-location-a", "CL")).feed.length, 0);
    }
    await client.query("UPDATE events SET post_tap_location_observation=$1::jsonb WHERE id=715", [JSON.stringify(observation({ city: null, countryCode: null }))]);
    const unlabeled = await read();
    assert.equal(unlabeled.geoPoints[0].city, "Unknown");
    assert.equal(unlabeled.geoPoints[0].country, "--");
    assert.equal(unlabeled.geoPoints[0].coordinateSource, "browser_approximate_consent");
    assert.ok(!JSON.stringify(unlabeled).includes(original.city));
    await client.query("UPDATE events SET post_tap_location_observation=NULL,lat=91,lng=NULL WHERE id=715");
    const edge = await read();
    assert.equal(edge.geoPoints[0].lat, original.geo_lat, "invalid direct pair falls back to the intact edge pair");
    assert.equal(edge.geoPoints[0].lng, original.geo_lng);
    assert.equal(edge.geoPoints[0].coordinateSource, "ip_approx");
    await client.query("UPDATE events SET geo_lat=NULL,geo_lng=NULL WHERE id=715");
    const absent = await read();
    assert.equal(absent.kpis.scans, 1);
    assert.equal(absent.geoPoints.length, 0, "missing coordinate evidence never invents a map point");
    assert.equal(absent.geography.cities[0].lat, null);
    assert.equal(absent.geography.cities[0].coordinateSource, "unknown");
    assert.ok(reads > 50, "actual analytics branches were executed, not a reconstructed aggregate");
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    await client.end();
  }
});

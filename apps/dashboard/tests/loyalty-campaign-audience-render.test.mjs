import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { demoConsumerNetworkResource } from "../src/lib/demo-consumer-network.ts";
import {
  CampaignAudienceIdentity,
  campaignAudienceIsDemo,
  campaignAudienceRowKey,
  parseCampaignAudienceRows,
} from "../src/app/(app)/loyalty/campaigns/loyalty-campaign-audience.tsx";
import LoyaltyCampaignsClient from "../src/app/(app)/loyalty/campaigns/loyalty-campaigns-client.tsx";

// Existing local demo adapter, not a replacement audience or a live API request.
const fixture = demoConsumerNetworkResource("GET", "consumer-network/members", "demobodega", new Date("2026-09-05T12:00:00Z"));
const client = await readFile(new URL("../src/app/(app)/loyalty/campaigns/loyalty-campaigns-client.tsx", import.meta.url), "utf8");

test("the real demo fixture reproduces the original absent consumer ID crash", () => {
  assert.equal(fixture.status, 200);
  assert.equal(fixture.body.dataSource, "demo");
  assert.equal(fixture.body.items.length, 3);
  assert.ok(fixture.body.items.every((member) => member.consumer_id === undefined && member.email_masked === null));
  assert.throws(() => fixture.body.items.map((member) => member.email_masked || member.consumer_id.slice(0, 8)), /slice/);
});

test("both real identity presentations render all existing demo profiles without inventing consumer IDs", () => {
  const before = structuredClone(fixture.body.items);
  const rows = parseCampaignAudienceRows(fixture.body.items);
  assert.ok(rows);
  assert.equal(new Set(rows.map(campaignAudienceRowKey)).size, 3);
  for (const layout of ["mobile", "desktop"]) {
    const cells = rows.map((member, index) => React.createElement(
      layout === "mobile" ? "div" : "tr",
      { key: campaignAudienceRowKey(member, index) },
      layout === "mobile"
        ? React.createElement(CampaignAudienceIdentity, { member })
        : React.createElement("td", null, React.createElement(CampaignAudienceIdentity, { member })),
    ));
    const html = renderToStaticMarkup(layout === "mobile"
      ? React.createElement("div", null, cells)
      : React.createElement("table", null, React.createElement("tbody", null, cells)));
    for (const member of rows) assert.ok(html.includes(member.display_name));
    assert.equal([...html.matchAll(/Identificador de contacto no disponible/g)].length, 3);
    assert.doesNotMatch(html, /audience-row:|undefined/);
  }
  assert.deepEqual(fixture.body.items, before);
  assert.equal([...client.matchAll(/<CampaignAudienceIdentity member=\{member\} \/>/g)].length, 2);
  assert.equal([...client.matchAll(/key=\{campaignAudienceRowKey\(member, index\)\}/g)].length, 2);
  assert.doesNotMatch(client, /member\.consumer_id\.slice/);
});

test("optional IDs and masked contacts have safe presentation with strict runtime field types", () => {
  const cases = [
    [{}, "Identificador de contacto no disponible"],
    [{ consumer_id: null }, "Identificador de contacto no disponible"],
    [{ consumer_id: "   " }, "Identificador de contacto no disponible"],
    [{ consumer_id: "local-id-123" }, "local-id"],
    [{ consumer_id: "local-id-123", email_masked: "l***@example.invalid" }, "l***@example.invalid"],
  ];
  for (const [member, expected] of cases) {
    assert.ok(parseCampaignAudienceRows([member]));
    assert.ok(renderToStaticMarkup(React.createElement(CampaignAudienceIdentity, { member })).includes(expected));
  }
  for (const invalid of [null, 42, {}, [null], [{ consumer_id: {} }], [{ display_name: [] }], [{ whatsapp_opt_in: "true" }], [{ tap_count: NaN }]]) {
    assert.equal(parseCampaignAudienceRows(invalid), null);
  }
  for (const invalidCount of [Infinity, "Infinity", "NaN", "", " ", "not-a-number"]) {
    assert.equal(parseCampaignAudienceRows([{ tap_count: invalidCount }]), null);
  }
  assert.deepEqual(parseCampaignAudienceRows([{ tap_count: "0", points_balance: "420" }]), [{ tap_count: "0", points_balance: "420" }]);
  assert.deepEqual(parseCampaignAudienceRows([]), []);
});

test("successful demo responses retain demo provenance and production cannot accept them", () => {
  assert.equal(campaignAudienceIsDemo(new Response(), fixture.body), true);
  assert.equal(campaignAudienceIsDemo(new Response(null, { headers: { "x-nexid-data-mode": "demo" } }), {}), true);
  assert.equal(campaignAudienceIsDemo(new Response(), { demoMode: true }), true);
  assert.equal(campaignAudienceIsDemo(new Response(), { dataSource: "production" }), false);
  assert.equal(campaignAudienceIsDemo(new Response(), { dataSource: "production", items: fixture.body.items }), true);
  assert.equal(campaignAudienceIsDemo(new Response(), { items: [{ data_provenance: "operational_tap" }, { data_provenance: "declared_demo" }] }), true);
  assert.equal(campaignAudienceIsDemo(new Response(), { items: [{ data_provenance: "operational_tap" }] }), false);
  assert.match(client, /const audienceDataIsDemo = audienceUsesDemo \|\| audienceIsDeclaredDemo/);
  assert.match(client, /if \(declaredDemo && !allowDemoData\) throw new Error\("demo_audience_not_allowed"\)/);
  assert.match(client, /setAudienceMembers\(members\);\s*setAudienceIsDeclaredDemo\(declaredDemo\)/);
  assert.match(client, /audienceDataIsDemo[\s\S]*Datos demo · no son audiencia real/);
  assert.match(client, /audienceDataIsDemo \? "Perfiles ficticios de demostración" : "Perfiles reportados por la fuente"/);
});

test("the complete campaign client initially renders in demo and tenant modes without requests", () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = () => { requests += 1; throw new Error("SSR test must not make requests"); };
  try {
    for (const [tenantScope, allowDemoData] of [["demobodega", true], ["local-tenant-test", false], ["", false]]) {
      const html = renderToStaticMarkup(React.createElement(LoyaltyCampaignsClient, { tenantScope, allowDemoData }));
      assert.ok(html.includes("Clientes &amp; campañas"));
      if (tenantScope) assert.ok(html.includes("Consultando audiencia"));
      if (!allowDemoData) assert.doesNotMatch(html, /Vendimia Passport \(Seasonal\)|Turista Brasil \(Localizado\)/);
    }
    assert.equal(requests, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("unavailable and mismatched sources keep the existing tenant boundary and no demo substitution in production", () => {
  const denied = demoConsumerNetworkResource("GET", "consumer-network/members", "local-tenant-test");
  assert.equal(denied.status, 403);
  assert.equal(denied.body.reason, "demo_tenant_required");
  assert.equal(parseCampaignAudienceRows(denied.body.items), null);
  assert.match(client, /if \(!response\.ok \|\| !Array\.isArray\(payload\?\.items\)\)/);
  assert.match(client, /String\(payload\?\.tenant \|\| ""\)\.trim\(\)\.toLowerCase\(\) !== tenantScope/);
  assert.match(client, /const audienceUsesDemo = allowDemoData && Boolean\(audienceError\)/);
  assert.match(client, /setAudienceMembers\(\[\]\);\s*setAudienceError/);
  assert.match(client, /loyalty-audience-unavailable/);
});

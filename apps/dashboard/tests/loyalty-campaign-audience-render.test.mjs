import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { demoConsumerNetworkResource } from "../src/lib/demo-consumer-network.ts";
import {
  CampaignAudienceIdentity,
  CampaignConsentAudiencePanel,
  buildCampaignAudienceUrl,
  campaignAudienceErrorCopy,
  campaignAudienceIsDemo,
  campaignAudienceRowKey,
  loadCampaignConsentAudience,
  parseCampaignConsentAudience,
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
  assert.match(client, /const audienceDataIsDemo = allowDemoData/);
  assert.match(client, /const audience = audienceDataIsDemo \? DEMO_AUDIENCE : \[\]/);
  assert.match(client, /audienceDataIsDemo[\s\S]*Datos demo · no son audiencia real/);
  assert.match(client, /Perfiles ficticios de demostración/);
});

test("the complete campaign client initially renders in demo and tenant modes without requests", () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = () => { requests += 1; throw new Error("SSR test must not make requests"); };
  try {
    for (const [tenantScope, allowDemoData] of [["demobodega", true], ["local-tenant-test", false], ["", false]]) {
      const html = renderToStaticMarkup(React.createElement(LoyaltyCampaignsClient, { tenantScope, allowDemoData }));
      assert.ok(html.includes("Clientes &amp; campañas"));
      if (tenantScope && !allowDemoData) assert.ok(html.includes("Consultando audiencia"));
      if (allowDemoData) assert.ok(html.includes("Datos demo · no son audiencia real"));
      if (!allowDemoData) assert.doesNotMatch(html, /Vendimia Passport \(Seasonal\)|Turista Brasil \(Localizado\)/);
      if (!allowDemoData) assert.doesNotMatch(html, /Perfiles ficticios|Clientes registrados|Ciudad \/ ejemplo demo|Lecturas acumuladas/);
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
  assert.match(client, /if \(allowDemoData\) return/);
  assert.match(client, /loadCampaignConsentAudience\(audienceRequest/);
  assert.doesNotMatch(client, /consumer-network\/members|parseCampaignAudienceRows|setAudienceMembers/);
  assert.match(client, /const confirmedAudience = audienceContextMatches \? audienceState.result : null/);
});

const request = { tenant: "local-tenant-test", channel: "whatsapp", purpose: "marketing" };
const maskedMember = {
  actorRef: "actor-0123456789abcdef0123",
  contactMasked: "+549***1234",
  consentedAt: "2026-09-01T12:00:00.000Z",
  lastActivityAt: null,
};
function consentPayload(overrides = {}) {
  return { ok: true, audience: { ...request, requiredScope: "whatsapp_marketing", count: 1, items: [{ ...maskedMember }], truncated: false, ...overrides } };
}
function renderConsentPanel(overrides = {}) {
  return renderToStaticMarkup(React.createElement(CampaignConsentAudiencePanel, {
    request, audience: null, loading: false, error: null, onChannelChange() {}, onRefresh() {}, ...overrides,
  }));
}

test("consent audience requests use the existing least-privilege GET with explicit context and no body", async () => {
  const expected = "/api/admin/campaigns/audience?tenant=local-tenant-test&channel=whatsapp&purpose=marketing&limit=100";
  assert.equal(buildCampaignAudienceUrl(request), expected);
  const controller = new AbortController();
  let calls = 0;
  const result = await loadCampaignConsentAudience(request, {
    signal: controller.signal,
    fetcher: async (url, options) => {
      calls += 1;
      assert.equal(url, expected);
      assert.deepEqual(options, { cache: "no-store", signal: controller.signal });
      return Response.json(consentPayload());
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.requiredScope, "whatsapp_marketing");
  for (const invalid of [{ ...request, tenant: "" }, { ...request, tenant: "tenant?scope=all" }, { ...request, channel: "sms" }, { ...request, purpose: "utility" }]) {
    assert.equal(buildCampaignAudienceUrl(invalid), null);
    await assert.rejects(loadCampaignConsentAudience(invalid, { fetcher: () => { throw new Error("must not fetch"); } }), /tenant_scope_required/);
  }
});

test("masked contract supports each exact scope and strips unsupported personal/CRM fields", () => {
  for (const channel of ["whatsapp", "email", "phone"]) {
    const expected = { ...request, channel };
    const contactMasked = channel === "email" ? "te***@example.invalid" : "+549***1234";
    const payload = consentPayload({ channel, requiredScope: `${channel}_marketing`, items: [{ ...maskedMember, contactMasked, email: "do-not-display@example.invalid", phone: "+5492610000000", consumer_id: "private-id", city: "Private City", points_balance: 42 }] });
    const result = parseCampaignConsentAudience(payload, expected);
    assert.deepEqual(result.items, [{ ...maskedMember, contactMasked }]);
    const html = renderConsentPanel({ audience: result, request: expected });
    assert.ok(html.includes(contactMasked));
    assert.doesNotMatch(html, /do-not-display|5492610000000|private-id|Private City|actor-0123456789abcdef0123/);
    assert.match(html, /Fuente: consentimientos persistidos/);
  }
});

test("all request dimensions must match and legacy/success-like malformed envelopes fail closed", () => {
  for (const [field, value] of [["tenant", "other-tenant"], ["channel", "email"], ["purpose", "utility"], ["requiredScope", "phone_marketing"]]) {
    assert.throws(() => parseCampaignConsentAudience(consentPayload({ [field]: value }), request), /scope_mismatch/);
  }
  for (const invalid of [null, {}, { items: [] }, { ok: true }, { ...consentPayload(), ok: false }, { ok: true, audience: [] }]) {
    assert.throws(() => parseCampaignConsentAudience(invalid, request), /contract_invalid/);
  }
});

test("total, sample and confirmed empty remain distinct and invalid counts are rejected", () => {
  const sample = parseCampaignConsentAudience(consentPayload({ count: 150, truncated: true }), request);
  const html = renderConsentPanel({ audience: sample });
  assert.match(html, />150</);
  assert.match(html, /Muestra recibida · total mayor/);
  assert.match(html, /Mostrando 1 de 1 contactos recibidos; total elegible: 150/);
  const empty = parseCampaignConsentAudience(consentPayload({ count: 0, items: [] }), request);
  assert.match(renderConsentPanel({ audience: empty }), /La fuente confirmó que no hay contactos elegibles/);
  for (const change of [{ count: -1 }, { count: NaN }, { count: Infinity }, { count: "1" }, { count: 1.5 }, { count: 0 }, { count: 2, truncated: false }, { count: 1, truncated: true }, { count: 1, items: [] }, { items: Array(201).fill(maskedMember), count: 201 }]) {
    assert.throws(() => parseCampaignConsentAudience(consentPayload(change), request), /contract_invalid/);
  }
});

test("masked-only field types, missing contact, dates and duplicate references are validated", () => {
  for (const change of [{ actorRef: "product-uid" }, { contactMasked: "+5492610000000" }, { contactMasked: {} }, { consentedAt: "not-a-date" }, { consentedAt: null }, { lastActivityAt: "invalid" }]) {
    assert.throws(() => parseCampaignConsentAudience(consentPayload({ items: [{ ...maskedMember, ...change }] }), request), /contract_invalid/);
  }
  assert.throws(() => parseCampaignConsentAudience(consentPayload({ count: 2, items: [maskedMember, maskedMember] }), request), /contract_invalid/);
  const unavailableContact = parseCampaignConsentAudience(consentPayload({ items: [{ ...maskedMember, contactMasked: "", lastActivityAt: "2026-09-02T12:00:00Z" }] }), request);
  assert.match(renderConsentPanel({ audience: unavailableContact }), /Contacto no disponible/);
  assert.match(renderConsentPanel({ audience: unavailableContact }), /2\/9\/2026/);
});

test("demo markers at header, envelope, audience and row level can never become real consent audience", async () => {
  const cases = [
    [consentPayload(), { "x-nexid-data-mode": "demo" }],
    [{ ...consentPayload(), dataSource: "demo" }],
    [consentPayload({ demoMode: true })],
    [consentPayload({ items: [{ ...maskedMember, data_provenance: "declared_demo" }] })],
    [{ ok: true, demoMode: true }],
  ];
  for (const [body, headers] of cases) {
    await assert.rejects(loadCampaignConsentAudience(request, { fetcher: async () => Response.json(body, { headers }) }), /demo_audience_not_allowed/);
  }
});

test("HTTP failures are actionable, never rendered as zero or raw upstream content", async () => {
  for (const [status, reason, expected] of [
    [400, "campaign_audience_channel_invalid", "campaign_audience_channel_invalid"],
    [401, "dashboard_session_required", "campaign_audience_unauthorized"],
    [403, "forbidden", "campaign_audience_forbidden"],
    [404, "campaign_audience_tenant_not_found", "campaign_audience_tenant_not_found"],
    [503, "campaign_audience_integrity_violation", "campaign_audience_integrity_violation"],
    [500, "private@example.invalid", "campaign_audience_unavailable"],
  ]) {
    await assert.rejects(loadCampaignConsentAudience(request, { fetcher: async () => Response.json({ ok: false, reason }, { status }) }), { message: expected });
    const html = renderConsentPanel({ audience: parseCampaignConsentAudience(consentPayload(), request), error: expected });
    assert.match(html, /No se interpreta la falla como cero clientes/);
    assert.doesNotMatch(html, /549\*\*\*1234|Contactos elegibles|private@example.invalid/);
    assert.ok(campaignAudienceErrorCopy(expected));
  }
  await assert.rejects(loadCampaignConsentAudience(request, { fetcher: async () => Response.json({ ok: false }) }), /contract_invalid/);
  await assert.rejects(loadCampaignConsentAudience(request, { fetcher: async () => new Response("not-json") }), /contract_invalid/);
});

test("context changes hide previous results immediately and requests cancel without touching the draft", () => {
  const previous = parseCampaignConsentAudience(consentPayload(), request);
  for (const next of [{ ...request, tenant: "other-tenant" }, { ...request, channel: "email" }]) {
    const html = renderConsentPanel({ audience: previous, request: next, loading: true });
    assert.match(html, /Consultando audiencia autorizada/);
    assert.doesNotMatch(html, /549\*\*\*1234|Contactos elegibles/);
    assert.doesNotMatch(renderConsentPanel({ audience: previous, request: next }), /549\*\*\*1234|Contactos elegibles/);
  }
  assert.match(client, /const audienceContextMatches = audienceState.key === audienceKey/);
  assert.match(client, /const audienceLoading = !allowDemoData && \(!audienceContextMatches \|\| audienceState.loading\)/);
  const loadEffect = client.slice(client.indexOf("if (allowDemoData) return;"), client.indexOf("async function loadTriviaInsight"));
  assert.match(loadEffect, /cancelled = true;\s*controller.abort\(\)/);
  assert.equal([...loadEffect.matchAll(/if \(!cancelled\)/g)].length, 2);
  assert.doesNotMatch(loadEffect, /setDraft|setOptimized|setCampaigns/);
  assert.doesNotMatch(client, /flowReadiness|Readiness de configuracion|listos para canal/);
  assert.match(client, /Borradores de esta sesión/);
  assert.match(client, /se pierden al recargar/);
});

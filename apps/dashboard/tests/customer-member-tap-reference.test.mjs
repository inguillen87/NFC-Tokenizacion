import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "esbuild";

// Render the actual component with inert navigation. No transport, real session,
// database, NFC signature or consumer operation participates in these fixtures.
const bundle = await build({
  entryPoints: [fileURLToPath(new URL("../src/components/customer-member-timeline.tsx", import.meta.url))],
  bundle: true, write: false, format: "cjs", platform: "node", jsx: "automatic", logLevel: "silent",
  external: ["react", "react/jsx-runtime", "lucide-react"],
  plugins: [{ name: "offline-member-tap-reference", setup(builder) {
    builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "next/navigation", namespace: "fixture" }));
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents:
      "export const usePathname=()=>'/leads-tickets';export const useSearchParams=()=>new URLSearchParams();export const useRouter=()=>({push(){throw Error('Unexpected navigation')},refresh(){throw Error('Unexpected refresh')}});", loader: "js" }));
  } }],
});
const loaded = { exports: {} };
new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
const { CustomerMemberTimeline } = loaded.exports;
const memberId = "10000000-0000-4000-8000-000000000001";
const entry = (tapEventId = "42", sourceKind = "consumer_tap") => ({
  sourceKind, sourceId: "private-source-reference", occurredAt: "2026-10-14T12:00:00.000Z", dataMode: "production",
  provenance: { persistence: "durable", relation: "consumer_tap_history", dataModeField: "events.source" },
  correlation: { consumerId: memberId, tapEventId, basis: ["consumer_id", "tap_event_id"] },
  data: { verdict: "VALID_CLOSED" },
});
const ready = items => ({ availability: "ready", items, partial: false, sourceErrors: [], hasMore: false, nextCursor: null });
const render = ({ items = [entry()], locale, directory = { availability: "ready", source: "production" }, timeline, selectedMemberId = memberId } = {}) =>
  renderToStaticMarkup(React.createElement(CustomerMemberTimeline, {
    tenantScope: "fixture-tenant", members: [{ id: memberId, displayName: "Miembro de prueba", email: null, phone: null, status: null, pointsBalance: null }],
    selectedMemberId, directory, timeline: timeline || ready(items), ...(locale ? { locale } : {}),
  }));

test("the persisted TAP reference appears as plain text without exposing private source IDs or capability links", () => {
  for (const sourceKind of ["consumer_tap", "incident", "loyalty_points", "order_request"]) {
    const html = render({ items: [entry("42", sourceKind)] });
    assert.equal([...html.matchAll(/data-testid="customer-member-tap-reference"/g)].length, 1);
    assert.match(html, /TAP vinculado · Evento #42/);
    assert.doesNotMatch(html, /private-source-reference|href=|<form|data-consumer-id|capability|token=/);
  }
});

test("the reference keeps its exact decimal string without converting a persisted bigint to a JavaScript number", () => {
  const reference = "9007199254740993";
  assert.match(render({ items: [entry(reference)] }), new RegExp(`Evento #${reference}`));
  assert.doesNotMatch(render({ items: [entry(reference)] }), /Evento #9007199254740992/);
});

test("invalid, missing and noncanonical TAP references are omitted while the durable activity remains visible", () => {
  for (const tapEventId of [null, undefined, "", "0", "-1", "1.5", "1e3", "01", " 42 ", "42\n", "42\r", "42\u2028", "1".repeat(20), "<script>42</script>", {}, [], 42]) {
    const invalidEntry = entry(); invalidEntry.correlation.tapEventId = tapEventId;
    const html = render({ items: [invalidEntry] });
    assert.doesNotMatch(html, /data-testid="customer-member-tap-reference"|<script>/, String(tapEventId));
    assert.match(html, /Etiqueta leída/);
  }
  const unbound = entry(); unbound.correlation.basis = ["consumer_id"];
  assert.doesNotMatch(render({ items: [unbound] }), /data-testid="customer-member-tap-reference"/);
});

test("the new reference label respects all three parent locales and defaults to Argentine Spanish", () => {
  for (const [locale, expected] of [[undefined, "TAP vinculado · Evento #42"], ["es-AR", "TAP vinculado · Evento #42"], ["en", "Linked TAP · Event #42"], ["pt-BR", "TAP vinculado · Evento #42"]]) {
    assert.ok(render({ locale }).includes(expected), String(locale));
  }
});

test("denied, demo and cross-member contexts never reveal a TAP reference or stale personal activity", () => {
  for (const patch of [
    { directory: { availability: "access_denied", source: "production" } },
    { directory: { availability: "ready", source: "demo" } },
    { timeline: { ...ready([entry()]), availability: "access_denied" } },
    { selectedMemberId: "10000000-0000-4000-8000-000000000002" },
    { items: [{ ...entry(), correlation: { ...entry().correlation, consumerId: "10000000-0000-4000-8000-000000000002" } }] },
  ]) {
    const html = render(patch);
    assert.doesNotMatch(html, /data-testid="customer-member-tap-reference"|Evento #42|Etiqueta leída/);
  }
});

test("the CRM parent passes the already selected locale into its member timeline", async () => {
  const source = await readFile(new URL("../src/app/(app)/leads-tickets/leads-tickets-client.tsx", import.meta.url), "utf8");
  assert.match(source, /<CustomerMemberTimeline\s[\s\S]*?timeline=\{memberTimeline\}\s+locale=\{locale\}\s*\/>/);
});

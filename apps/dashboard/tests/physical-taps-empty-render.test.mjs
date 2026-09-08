import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "esbuild";

// Render the production component without transport or navigation side effects.
// Only the shared stream, CSS, navigation mechanics and the map are inert here.
const stubs = {
  "./physical-taps-command-center.module.css": "export default {}",
  "next/link": 'import {createElement} from "react"; export default function Link(props){return createElement("a",props)}',
  "@product/ui/premium-vector-map": "export function PremiumVectorMap(){return null}",
  "./secure-dashboard-logout-button": 'import {createElement} from "react";export function SecureDashboardLogoutButton({label}){return createElement("button",null,label)}',
  "./dashboard-realtime-provider": "const value={status:'connected',snapshot:null,events:[],warning:null,activeScope:{window:'24h'},activeScopeKey:'fixture',droppedThroughSequence:0};export function useDashboardRealtime(){return value}",
};
const bundle = await build({
  entryPoints: [fileURLToPath(new URL("../src/components/physical-taps-command-center.tsx", import.meta.url))],
  bundle: true, write: false, format: "cjs", platform: "node", jsx: "automatic", logLevel: "silent",
  external: ["react", "react/jsx-runtime", "lucide-react"],
  plugins: [{ name: "offline-physical-taps-render", setup(builder) {
    builder.onResolve({ filter: /.*/ }, (args) => Object.hasOwn(stubs, args.path) ? { path: args.path, namespace: "fixture" } : undefined);
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({ contents: stubs[args.path], loader: "js" }));
  } }],
});
const loaded = { exports: {} };
new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
const { PhysicalTapsCommandCenter } = loaded.exports;

const checkedAt = "2026-09-08T14:00:00Z";
const fixtureRow = (sealState, eventId) => ({
  eventId, tenantSlug: "fixture-tenant", bid: "LOT-FIXTURE", productName: "Producto de prueba local", uidMasked: "TEST****01",
  messageValid: true, sealState, reportedState: sealState === "closed" ? "VALID_CLOSED" : "VALID_OPENED", readCounter: 2,
  occurredAt: { utc: checkedAt, timezone: "America/Argentina/Buenos_Aires" },
  location: { city: "", region: "", country: "", lat: null, lng: null, source: "none", precision: "none" },
  evidence: { kind: "physical_nfc_tt_evidenced", ttStatusReported: true },
});
const ready = (rows = [], scope = {}) => ({
  availability: "ready", detail: "offline fixture only", checkedAt,
  payload: {
    scope: { tenant: "fixture-tenant", range: "24h", bid: "all", source: "real", ...scope },
    summary: { total: rows.length, closed: rows.filter((row) => row.sealState === "closed").length, opened: rows.filter((row) => row.sealState === "opened").length, distinctUnits: rows.length, latestAt: rows.length ? checkedAt : null },
    rows,
  },
});
const render = (result, overrides = {}) => renderToStaticMarkup(React.createElement(PhysicalTapsCommandCenter, {
  result, tenantSlug: "fixture-tenant", tenantDisplayName: "Empresa de prueba", ...overrides,
}));

test("confirmed empty collection renders one contextual state, not empty metrics plus map and inbox", () => {
  const html = render(ready());
  assert.equal([...html.matchAll(/data-testid="physical-taps-empty-period"/g)].length, 1);
  assert.match(html, /Sin lecturas en este período/);
  assert.match(html, /Período consultado: últimas 24 horas/);
  assert.match(html, /no existan tags ni lecturas anteriores/);
  assert.match(html, /Si el canal está conectado, se recibe sin recargar/);
  assert.doesNotMatch(html, /data-testid="physical-taps-inbox"|data-testid="physical-taps-map-empty"|Cerrado reportado|Abierto reportado/);
  assert.match(html, /Actualizar TAP físicos ahora/);
  assert.match(html, /href="\/events\?source=real&amp;tenant=fixture-tenant"/);
});

test("empty history action preserves the current tenant and server batch scope", () => {
  const html = render(ready([], { bid: "LOT / & 02" }));
  assert.match(html, /href="\/events\?bid=LOT%20%2F%20%26%2002&amp;source=real&amp;tenant=fixture-tenant"/);
  const global = render(ready(), { tenantSlug: "" });
  assert.match(global, /href="\/events\?source=real"/);
  assert.doesNotMatch(global, /tenant=undefined|tenant=null/);
});

test("unavailable, denied and simulated access never masquerade as confirmed empty activity", () => {
  for (const availability of ["upstream_error", "invalid_payload", "unreachable", "forbidden", "requires_tenant_session"]) {
    const html = render({ availability, payload: null, detail: "unconfirmed fixture", checkedAt });
    assert.match(html, /data-testid="physical-taps-unavailable"/);
    assert.doesNotMatch(html, /data-testid="physical-taps-empty-period"|Tus próximos TAP aparecerán acá|Cerrado reportado/);
    if (["upstream_error", "invalid_payload", "unreachable"].includes(availability)) assert.match(html, /Reintentar ahora/);
    else assert.doesNotMatch(html, /Reintentar ahora/);
  }
});

test("readings without coordinates remain actionable and keep evidence qualifications collapsed", () => {
  const html = render(ready([fixtureRow("closed", "fixture-1"), fixtureRow("opened", "fixture-2")]));
  assert.doesNotMatch(html, /data-testid="physical-taps-empty-period"/);
  assert.match(html, /Estas lecturas no incluyen coordenadas/);
  assert.match(html, /href="#physical-taps-inbox"/);
  assert.match(html, /id="physical-taps-inbox"/);
  assert.equal([...html.matchAll(/data-testid="physical-taps-event-row"/g)].length, 2);
  assert.equal([...html.matchAll(/<summary>Alcance de esta evidencia<\/summary>/g)].length, 2);
  assert.doesNotMatch(html, /<details[^>]*\bopen(?:[\s=>])/);
  assert.match(html, /No inferimos que cerrado y abierto formen un antes\/después/);
  assert.match(html, /Contacto bloqueado hasta consentimiento/);
  assert.doesNotMatch(html, /Convertir sin invadir|Próximo paso comercial/);
  const compact = render(ready([fixtureRow("closed", "fixture-1")]), { compact: true });
  assert.doesNotMatch(compact, /href="#physical-taps-inbox"/);
  assert.match(compact, /Consultar historial/);
});

test("unconfirmed messages retain a visible review warning outside the disclosure", () => {
  const closed = { ...fixtureRow("closed", "fixture-1"), messageValid: false, evidence: { kind: "real_tap_event_carrier_unconfirmed", ttStatusReported: false } };
  const html = render(ready([closed, fixtureRow("opened", "fixture-2")]));
  const firstCard = html.match(/<article\b[^>]*data-testid="physical-tap-closed"[\s\S]*?<\/article>/)?.[0];
  assert.ok(firstCard);
  const beforeDisclosure = firstCard.slice(0, firstCard.indexOf("<details"));
  assert.match(beforeDisclosure, /Mensaje NFC no validado\. Revisá la evidencia antes de operar/);
  assert.match(beforeDisclosure, /Carrier físico sin confirmar/);
  assert.doesNotMatch(firstCard, /El mensaje autenticado del tag reportó estado TT cerrado/);
});

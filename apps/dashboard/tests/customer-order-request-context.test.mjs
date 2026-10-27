import assert from "node:assert/strict";
import { dataTableCopy } from "../src/lib/data-table-copy.ts";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as orders from "../src/lib/customer-order-request-projection.ts";
import * as inbox from "../src/lib/customer-inbox-state.ts";
import * as signals from "../src/lib/customer-signal-timeline.ts";
import * as assistant from "../src/lib/assistant-records.ts";
import * as activity from "../src/lib/customer-activity-summary.ts";
import * as entry from "../src/lib/ticket-entry.ts";
import * as tickets from "../src/lib/support-ticket-projection.ts";
import * as ticketStatuses from "../src/lib/ticket-status-reconciliation.ts";
import * as exports from "../src/lib/export-utils.ts";
import { customerInboxCopy } from "../src/lib/customer-inbox-copy.ts";

const ready = { availability: "ready", source: "production" };
const row = (patch = {}) => ({ id: "order-qa", tenant_slug: "qa-only", created_at: "2026-10-14T12:00:00.000Z", status: "requested",
  product_title: "Reserva sintética", quantity: 2, email: "qa@example.invalid", phone: "+540000000000", consumer_message: "Consulta por caja de regalo", ...patch });
const legacy = { id: "legacy-qa", tenant_slug: "qa-only", created_at: "2026-10-13T12:00:00.000Z", status: "pending",
  contact: "Compras QA", company: "Empresa QA", tag_type: "Etiqueta de ensayo", volume: 4, notes: "Detalle antiguo" };

test("marketplace requests project the persisted product, quantity, both contact channels and message", () => {
  const projected = orders.projectCustomerOrderRequest(row());
  assert.equal(projected.product, "Reserva sintética"); assert.equal(projected.quantity, 2);
  assert.equal(projected.contact, "qa@example.invalid · +540000000000"); assert.equal(projected.message, "Consulta por caja de regalo");
  assert.equal(projected.status, "requested"); assert.equal(projected.company, null);
});

test("legacy requests retain their explicit contact, company, tag, quantity and notes", () => {
  const projected = orders.projectCustomerOrderRequest(legacy);
  assert.equal(projected.product, legacy.tag_type); assert.equal(projected.quantity, 4);
  assert.equal(projected.contact, legacy.contact); assert.equal(projected.company, legacy.company); assert.equal(projected.message, legacy.notes);
});

test("modern values win without converting an invalid or null quantity into legacy stock or a default", () => {
  for (const value of [null, {}, [], "2", -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const projected = orders.projectCustomerOrderRequest(row({ quantity: value, volume: 9 }));
    assert.equal(projected.quantity, null);
    assert.equal(orders.customerOrderRequestTableRow(row({ quantity: value, volume: 9 }), "unknown").quantity, "unknown");
  }
  assert.equal(orders.projectCustomerOrderRequest(row({ quantity: 0, volume: 9 })).quantity, 0);
  assert.equal(orders.projectCustomerOrderRequest(row({ quantity: 3, volume: 9 })).quantity, 3);
  assert.equal(orders.projectCustomerOrderRequest({ ...legacy, quantity: undefined }).quantity, 4);
});

test("missing, malformed and oversized values never become JSON or invented details", () => {
  for (const value of [null, undefined, {}, [], true, 12, "", "   "]) {
    const projected = orders.projectCustomerOrderRequest({ product_title: value, email: value, phone: value, consumer_message: value, status: value });
    assert.equal(projected.product, null); assert.equal(projected.contact, null); assert.equal(projected.message, null); assert.equal(projected.status, null);
  }
  const projected = orders.projectCustomerOrderRequest({ product_title: "x".repeat(501), email: "x".repeat(321), phone: "x".repeat(101), consumer_message: "x".repeat(200001) });
  assert.equal(projected.product, null); assert.equal(projected.contact, null); assert.equal(projected.message, null);
  assert.equal(orders.customerOrderRequestTableRow({ created_at: "invalid" }, "unknown").created_at, "unknown");
});

test("local search covers the same explicit fields as table and exports, including both contact channels", () => {
  const projected = orders.customerOrderRequestTableRow(row({ consumer_message: "Detalle con salto\nde línea" }), "unknown");
  for (const query of ["RESERVA", "2", "@example", "+540000000000", "salto", "requested", "order-qa", "   "]) assert.equal(orders.customerOrderRequestMatchesQuery(projected, query), true);
  assert.equal(orders.customerOrderRequestMatchesQuery(projected, "not-recorded"), false);
  for (const query of ["Empresa QA", "Etiqueta", "4", "Detalle antiguo"]) assert.equal(orders.customerOrderRequestMatchesQuery(orders.customerOrderRequestTableRow(legacy, "unknown"), query), true);
});

test("projection does not mutate source, reveal extra fields or infer a sale, redemption or eligibility", () => {
  const supplied = Object.freeze(row({ raw_payload: { secret: "private" }, purchase_completed: true, meta: { authenticated: true }, fulfilled: true }));
  const before = JSON.stringify(supplied), projected = orders.customerOrderRequestTableRow(supplied, "unknown");
  assert.equal(JSON.stringify(supplied), before);
  assert.deepEqual(Object.keys(projected), ["reference", "created_at", "product", "quantity", "contact", "company", "status", "message"]);
  assert.doesNotMatch(JSON.stringify(projected), /private|purchase_completed|fulfilled|authenticated/);
});

test("signal timeline uses the same modern message and both channels, preserving legacy fallback and provenance", () => {
  const values = signals.buildCustomerSignalTimeline({ leads: [], tickets: [], orders: [row(), legacy], collections: { leads: ready, tickets: ready, orders: ready } });
  assert.equal(values[0].summary, row().consumer_message); assert.equal(values[0].contact, "qa@example.invalid · +540000000000");
  assert.equal(values[0].title, "Solicitud: Reserva sintética"); assert.equal(values[0].source, "production");
  assert.equal(values[1].summary, legacy.notes); assert.equal(values[1].contact, legacy.contact); assert.equal(values[1].product, legacy.tag_type);
  const preferred = signals.buildCustomerSignalTimeline({ leads: [], tickets: [], orders: [row({ notes: "Legacy note" })], collections: { leads: ready, tickets: ready, orders: ready } });
  assert.equal(preferred[0].summary, row().consumer_message);
});

const require = createRequire(import.meta.url);
const css = new Proxy({}, { get: (_, key) => key === "__esModule" ? false : String(key) });
function loadComponent(path, substitutes) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)((id) => Object.hasOwn(substitutes, id) ? substitutes[id] : id.endsWith(".module.css") ? css : require(id), module, module.exports);
  return module.exports;
}
const Empty = () => null;
const ui = { Card: ({ children }) => React.createElement("section", null, children), Badge: ({ children }) => React.createElement("span", null, children),
  Button: ({ children, onClick, disabled }) => React.createElement("button", { type: "button", onClick, disabled }, children), BrandDot: Empty, BrandLockup: Empty };
const router = { refresh() { throw new Error("Unexpected refresh during rendering"); } };
const DataTable = loadComponent("../src/components/data-table.tsx", { "@product/ui": ui, "next/navigation": { useRouter: () => router }, "../lib/export-utils": exports, "../lib/data-table-copy": { dataTableCopy } }).DataTable;
function renderOrders({ records = [row(), legacy], search = "", context = "qa-only", state = ready, locale = "es-AR", demoMode = false, statusMap = {} } = {}) {
  let stateIndex = 0, tableProps = null;
  const reactShim = { ...React, useState: initial => {
    const index = stateIndex++;
    return React.useState(index === 0 ? "orders" : index === 1 ? search : initial);
  } };
  const Client = loadComponent("../src/app/(app)/leads-tickets/leads-tickets-client.tsx", {
    react: reactShim, "next/navigation": { useRouter: () => router }, "lucide-react": { Search: Empty },
    "../../../lib/assistant-records": assistant, "../../../lib/customer-inbox-state": inbox, "../../../lib/customer-inbox-copy": { customerInboxCopy },
    "../../../lib/data-table-copy": { dataTableCopy },
    "../../../lib/customer-order-request-projection": orders, "../../../lib/customer-activity-summary": activity, "../../../lib/customer-signal-timeline": signals,
    "../../../lib/ticket-entry": entry, "../../../lib/support-ticket-projection": tickets,
    "../../../lib/ticket-status-reconciliation": ticketStatuses,
    "../../../components/assistant-records": { AssistantRecords: Empty }, "../../../components/customer-activity-summary": { CustomerActivitySummary: Empty },
    "../../../components/customer-member-timeline": { CustomerMemberTimeline: Empty }, "../../../components/customer-signal-timeline": { CustomerSignalTimeline: Empty },
    "../../../components/ticket-reference-lookup": { TicketReferenceLookup: Empty },
    "../../../components/customer-inbox-notice": { CustomerInboxNotice: ({ state }) => React.createElement("p", { "data-availability": state.availability }, state.availability) },
    "../../../components/data-table": { DataTable: props => { tableProps = props; return React.createElement(DataTable, props); } },
  }).default;
  const html = renderToStaticMarkup(React.createElement(Client, { initialLeads: [], initialTickets: [], initialOrders: records, filteredOpportunities: [],
    tenantScope: context, tenantFilter: context, sessionFilter: "", demoMode, locale, canLookupTickets: false, leadsSource: state.source,
    signalCollections: { leads: state, tickets: state, orders: state }, members: [], memberDirectory: state, selectedMemberId: "",
    memberTimeline: { availability: "not_selected", items: [], partial: false, sourceErrors: [], hasMore: false, nextCursor: null },
    copy: { shell: { loading: "loading", all: "all", refresh: "refresh" }, statuses: statusMap }, labels: {} }));
  return { html, tableProps };
}

test("actual CRM table displays marketplace and legacy rows with no create, purchase or contact actions", () => {
  const { html, tableProps } = renderOrders({ records: [row({ consumer_message: "<script>alert(1)</script>" }), legacy] });
  assert.equal(tableProps.rows.length, 2); assert.equal(tableProps.rows[0].quantity, "2"); assert.equal(tableProps.rows[1].quantity, "4");
  assert.equal(tableProps.rowAction, undefined);
  for (const text of ["Producto solicitado", "Cantidad informada", "Mensaje o notas", "Reserva sintética", "qa@example.invalid", "+540000000000", "Etiqueta de ensayo", "Detalle antiguo"]) assert.ok(html.includes(text), text);
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;")); assert.doesNotMatch(html, /<script>|href=|<form/);
  assert.match(html, /No confirman una compra/); assert.doesNotMatch(html, /Tipo Tag|pedidos de muestras/);
});

test("actual CRM table recovery feedback follows its selected locale", () => {
  for (const [locale, count, clear] of [["es-AR", "2 de 2 filas visibles", "Limpiar filtros"], ["en", "2 of 2 rows visible", "Clear filters"], ["pt-BR", "2 de 2 linhas visíveis", "Limpar filtros"]]) {
    const { html, tableProps } = renderOrders({ locale });
    assert.ok(html.includes(count), locale);
    assert.equal(tableProps.clearFiltersLabel, clear);
    assert.equal(tableProps.filteredEmptyLabel, dataTableCopy[locale].filteredEmptyLabel);
    assert.equal(tableProps.missingStatusLabel, dataTableCopy[locale].missingStatusLabel);
  }
});

test("actual CRM search uses product, phone and consumer message instead of the obsolete sample fields", () => {
  for (const search of ["Reserva", "+540000000000", "caja de regalo"]) {
    const { tableProps } = renderOrders({ search }); assert.equal(tableProps.rows.length, 1); assert.equal(tableProps.rows[0].reference, "order-qa");
  }
  for (const locale of ["es-AR", "pt-BR", "en"]) {
    const copy = dataTableCopy[locale], ui = customerInboxCopy[locale];
    const { html, tableProps } = renderOrders({ search: "not-recorded", locale });
    assert.equal(tableProps.rows.length, 0);
    assert.equal(tableProps.externalFilter.active, true);
    assert.equal(tableProps.externalFilter.sourceCount, 2);
    assert.ok(html.includes(copy.filteredEmptyLabel), locale + " localized no-match feedback");
    assert.ok(html.includes(copy.countLabel.replaceAll("{visible}", "0").replaceAll("{total}", "2")), locale + " admitted-source denominator");
    assert.match(html, /data-testid="data-table-filtered-empty"/);
    assert.doesNotMatch(html, /data-testid="data-table-source-empty"/);
    assert.ok(!html.includes(ui.orderNoRecords), locale + " does not invent an empty source");
    for (const search of ["", "not-recorded"]) {
      const empty = renderOrders({ records: [], locale, search });
      assert.equal(empty.tableProps.rows.length, 0);
      assert.equal(empty.tableProps.externalFilter.active, Boolean(search));
      assert.equal(empty.tableProps.externalFilter.sourceCount, 0);
      assert.ok(empty.html.includes(ui.orderNoRecords), locale + " genuine empty list");
      assert.ok(empty.html.includes(copy.countLabel.replaceAll("{visible}", "0").replaceAll("{total}", "0")), locale + " genuine empty denominator");
      assert.match(empty.html, /data-testid="data-table-source-empty"/);
      assert.doesNotMatch(empty.html, /data-testid="data-table-filtered-empty"/);
    }
  }
});

test("actual CRM keeps free text literal and translates only explicit string states", () => {
  for (const message of ["__proto__", "constructor", "toString", "requested", "pending"]) {
    const { html, tableProps } = renderOrders({ records: [row({ product_title: message, consumer_message: message })],
      statusMap: { requested: "Estado traducido", pending: "Otro estado" } });
    assert.equal(tableProps.rows[0].message, message);
    assert.ok(html.includes(`>${message}</td>`), message);
    assert.ok(html.includes("Estado traducido"));
  }
  for (const status of ["__proto__", "constructor", "toString"]) {
    const { html } = renderOrders({ records: [row({ status })] });
    assert.ok(html.includes(`value="${status}">${status}</option>`));
  }
  const { html } = renderOrders({ statusMap: { requested: {} } });
  assert.ok(html.includes('value="requested">requested</option>'));
});

test("new CRM message cells retain spreadsheet formula neutralization", () => {
  const message = '=HYPERLINK("https://example.invalid","QA")';
  const projected = orders.customerOrderRequestTableRow(row({ consumer_message: message }), "unknown");
  assert.equal(projected.message, message);
  assert.ok(exports.escapeSpreadsheetCsvCell(projected.message).startsWith('"\'='));
  assert.ok(exports.escapeSpreadsheetHtmlCell(projected.message).startsWith("&#39;="));
});

test("cross-tenant, unavailable and contradictory demo sources do not render their prior requests", () => {
  for (const options of [{ context: "other-brand" }, { state: { availability: "access_denied", source: "unavailable" } }, { state: { availability: "unreachable", source: "unavailable" } }, { state: { ...ready, source: "demo" } }]) {
    const { html, tableProps } = renderOrders(options); assert.equal(tableProps, null); assert.doesNotMatch(html, /Reserva sintética|qa@example.invalid|Detalle antiguo/);
  }
});

test("request headers and missing-state copy are translated consistently across all current locales", () => {
  for (const [locale, copy] of Object.entries(customerInboxCopy)) {
    assert.deepEqual(Object.keys(copy).sort(), Object.keys(customerInboxCopy["es-AR"]).sort());
    const { tableProps } = renderOrders({ locale });
    assert.equal(tableProps.columns.find(column => column.key === "message").label, copy.orderMessage);
    assert.equal(tableProps.columns.find(column => column.key === "quantity").label, copy.orderQuantity);
    assert.notEqual(copy.orderNoRecords, copy.orderNoMatches);
  }
});

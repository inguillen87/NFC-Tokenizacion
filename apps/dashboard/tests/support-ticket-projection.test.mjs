import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { SupportTicketDetails } from "../src/components/support-ticket-details.tsx";
import {
  projectSupportTicket, SUPPORT_TICKET_COLUMNS, supportTicketTableRow, supportTicketRowMatchesQuery,
} from "../src/lib/support-ticket-projection.ts";
import { buildCustomerSignalTimeline, customerSignalMatchesQuery } from "../src/lib/customer-signal-timeline.ts";
import { escapeSpreadsheetCsvCell, escapeSpreadsheetHtmlCell } from "../src/lib/export-utils.ts";

const REFERENCE = "12345678-1234-8234-8234-123456789abc";
const READY = { availability: "ready", source: "production" };
const reportDetail = (overrides = {}) => JSON.stringify({
  protocol: "nexid.support-report.v1", request_id: "internal-request", fingerprint: "internal-fingerprint",
  tenant_id: "untrusted-tenant", batch_id: "untrusted-batch", event_id: "999", consumer_id: "untrusted-person",
  category: "product_problem", description: "El envase presenta una pérdida.\nNecesito revisarlo.", ...overrides,
});
const ticketRow = (overrides = {}) => ({
  id: REFERENCE, bid: "LOT-2026-A", tap_event_id: "715", category: "product_problem",
  title: "Reporte sobre el producto", detail: reportDetail(), contact: "anonymous-sun-report",
  created_at: "2026-09-21T12:30:00.000Z", status: "open", source: "sun_public_report", ...overrides,
});
const timeline = (row) => buildCustomerSignalTimeline({
  leads: [], orders: [], tickets: [row], collections: { leads: READY, tickets: READY, orders: READY },
})[0];

test("support report presents the description and row scope, never payload authority or internal metadata", () => {
  const projected = projectSupportTicket(ticketRow());
  assert.deepEqual(projected, {
    reference: REFERENCE, batch: "LOT-2026-A", event: "715", category: "Problema con el producto",
    description: "El envase presenta una pérdida.\nNecesito revisarlo.", detailFormat: "support_report", contact: null,
  });
  const signal = timeline(ticketRow({ tenant_name: "Marca del lote" }));
  assert.equal(signal.summary, projected.description);
  assert.equal(signal.subject, "Contacto no informado");
  assert.equal(signal.owner, null);
  assert.equal(signal.objectiveLabel, "Motivo del ticket");
  assert.equal(signal.ticket.reference, REFERENCE);
  assert.doesNotMatch(JSON.stringify(signal), /untrusted-|internal-request|internal-fingerprint/);
});

test("UUIDv8 is searchable in both timeline and table with full visible reference preserved", () => {
  const row = ticketRow();
  const tableRow = supportTicketTableRow(row);
  const signal = timeline(row);
  for (const query of [REFERENCE, REFERENCE.toUpperCase(), "  " + REFERENCE + "  ", "LOT-2026-A", "715", "pérdida"]) {
    assert.equal(supportTicketRowMatchesQuery(tableRow, query), true, query);
    assert.equal(customerSignalMatchesQuery(signal, query), true, query);
  }
  assert.equal(supportTicketRowMatchesQuery(tableRow, "untrusted-batch"), false);
  assert.equal(customerSignalMatchesQuery(signal, "untrusted-batch"), false);
  assert.equal(tableRow.reference, signal.ticket.reference);
  assert.equal(tableRow.detail, signal.summary);
});

test("missing row context stays missing; unsafe numeric event ids cannot become another event", () => {
  for (const event of [undefined, -1, 0, 9007199254740992, "1e3", "9223372036854775808", {}, "715/evil"]) {
    const projected = projectSupportTicket(ticketRow({ id: undefined, bid: undefined, tap_event_id: event }));
    assert.equal(projected.reference, null);
    assert.equal(projected.batch, null);
    assert.equal(projected.event, null);
  }
  assert.equal(projectSupportTicket(ticketRow({ tap_event_id: "9223372036854775807" })).event, "9223372036854775807");
  assert.equal(projectSupportTicket(ticketRow({ tap_event_id: 715 })).event, "715");
});

test("plain legacy, malformed, unknown and oversized JSON remain complete literal detail", () => {
  const details = [
    "  Consulta anterior\nCon segunda línea.  ", '{"protocol":',
    reportDetail({ protocol: "future.protocol" }), reportDetail({ category: "__proto__" }),
    reportDetail({ description: "a".repeat(1501) }), JSON.stringify({ description: "a".repeat(20_000) }),
  ];
  for (const detail of details) {
    const projected = projectSupportTicket(ticketRow({ detail }));
    assert.equal(projected.detailFormat, "legacy");
    assert.equal(projected.description, detail);
    assert.equal(supportTicketTableRow(ticketRow({ detail })).detail, detail);
  }
});

test("category is a declared reason; row fields win and missing contacts never imply a person", () => {
  const row = ticketRow({ category: "seal_opened" });
  assert.equal(projectSupportTicket(row).category, "Precinto abierto");
  assert.equal(supportTicketTableRow(row).contact, "No informado");
  assert.equal(projectSupportTicket(ticketRow({ contact: "customer@example.test" })).contact, "customer@example.test");
  assert.equal(projectSupportTicket(ticketRow({ category: undefined, detail: "Legacy" })).category, null);
});

test("rendered support descriptions and complete legacy details escape HTML without interpreting it", () => {
  const description = '<script>alert("fixture")</script><img src=x onerror=alert(1)>';
  const html = renderToStaticMarkup(React.createElement(SupportTicketDetails, {
    ticket: projectSupportTicket(ticketRow({ detail: reportDetail({ description }) })),
  }));
  assert.ok(html.includes(REFERENCE));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /data-testid="support-ticket-description"/);
  assert.doesNotMatch(html, /<script|<img|internal-fingerprint|untrusted-batch/);
  const legacy = "Texto histórico ".repeat(40) + "fin del detalle";
  const legacyHtml = renderToStaticMarkup(React.createElement(SupportTicketDetails, {
    ticket: projectSupportTicket(ticketRow({ detail: legacy })),
  }));
  assert.match(legacyHtml, /<details/);
  assert.ok(legacyHtml.includes(legacy));
});

test("actual DataTable CSV and Excel builders export the full displayed reference and safe literal text", async () => {
  const source = await readFile(new URL("../src/components/data-table.tsx", import.meta.url), "utf8");
  const ast = ts.createSourceFile("data-table.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = ast.statements.filter((node) => ts.isFunctionDeclaration(node) && ["buildCsv", "buildExcelHtml"].includes(node.name?.text));
  assert.equal(declarations.length, 2);
  const code = ts.transpileModule(declarations.map((node) => node.getText(ast)).join("\n"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const { buildCsv, buildExcelHtml } = new Function("escapeSpreadsheetCsvCell", "escapeSpreadsheetHtmlCell", `${code}; return { buildCsv, buildExcelHtml };`)(escapeSpreadsheetCsvCell, escapeSpreadsheetHtmlCell);
  const row = supportTicketTableRow(ticketRow({ detail: reportDetail({ description: '=HYPERLINK("https://fixture.invalid") <script>' }) }));
  const csv = buildCsv(SUPPORT_TICKET_COLUMNS, [row]);
  const excel = buildExcelHtml("Tickets", SUPPORT_TICKET_COLUMNS, [row]);
  assert.ok(csv.includes(`"${row.reference}"`));
  assert.ok(excel.includes(`<td>${row.reference}</td>`));
  assert.ok(csv.startsWith('"Referencia"'));
  assert.match(csv, /"'=HYPERLINK/);
  assert.match(excel, /&#39;=HYPERLINK/);
  assert.match(excel, /&lt;script&gt;/);
  assert.doesNotMatch(excel, /<script>|internal-request|internal-fingerprint/);
});

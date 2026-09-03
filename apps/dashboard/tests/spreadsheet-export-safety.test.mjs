import test from "node:test";
import assert from "node:assert/strict";

import {
  escapeSpreadsheetCsvCell,
  escapeSpreadsheetHtmlCell,
  neutralizeSpreadsheetFormula,
} from "../src/lib/export-utils.ts";

test("spreadsheet exports neutralize formula prefixes and leading control characters", () => {
  for (const value of ["=1+1", "+cmd", "-1+2", "@SUM(A1:A2)", " \t=HYPERLINK(\"https://invalid\")", "\r\n@SUM(A1:A2)", "\uFEFF=1+1"]) {
    assert.equal(neutralizeSpreadsheetFormula(value), `'${value}`);
  }
});

test("spreadsheet exports preserve ordinary values and escape their target format", () => {
  assert.equal(neutralizeSpreadsheetFormula("Reserva Andina"), "Reserva Andina");
  assert.equal(escapeSpreadsheetCsvCell('Bodega, "Reserva"'), '"Bodega, ""Reserva"""');
  assert.equal(escapeSpreadsheetCsvCell("=1+1"), '"\'=1+1"');
  assert.equal(escapeSpreadsheetHtmlCell("<Reserva & Co>"), "&lt;Reserva &amp; Co&gt;");
  assert.equal(escapeSpreadsheetHtmlCell("@SUM(A1:A2)"), "&#39;@SUM(A1:A2)");
});

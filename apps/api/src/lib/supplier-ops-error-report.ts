const MAX_ERROR_REPORT_ROWS = 5_000;
const MAX_CELL_LENGTH = 500;

export type SupplierOpsErrorIssue = {
  row?: number | null;
  code?: string | null;
  field?: string | null;
  value?: unknown;
  detail?: unknown;
};

type SupplierOpsErrorReportInput = {
  stage: "manifest" | "qa";
  bid: string;
  reason: string;
  message?: string | null;
  issues?: SupplierOpsErrorIssue[];
};

function safeCell(value: unknown) {
  if (value == null) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return String(text || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .slice(0, MAX_CELL_LENGTH);
}

function csvCell(value: unknown) {
  const raw = safeCell(value);
  const text = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function safeFilenameToken(value: unknown, fallback: string) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return normalized || fallback;
}

export function buildSupplierOpsErrorReport(input: SupplierOpsErrorReportInput) {
  const issues = Array.isArray(input.issues) && input.issues.length
    ? input.issues.slice(0, MAX_ERROR_REPORT_ROWS)
    : [{ code: input.reason, detail: input.message || input.reason }];
  const rows = issues.map((issue) => ({
    stage: input.stage,
    bid: safeCell(input.bid),
    row: Number.isSafeInteger(Number(issue.row)) && Number(issue.row) > 0 ? Number(issue.row) : "",
    code: safeCell(issue.code || input.reason),
    field: safeCell(issue.field),
    value: safeCell(issue.value),
    detail: safeCell(issue.detail || input.message || input.reason),
  }));
  const columns = ["stage", "bid", "row", "code", "field", "value", "detail"] as const;
  const csv = [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
  ].join("\r\n");

  return {
    schema_version: "nexid-supplier-ops-error-report/v1",
    filename: `nexid-${input.stage}-errors-${safeFilenameToken(input.bid, "UNKNOWN-BID")}.csv`,
    mime_type: "text/csv; charset=utf-8",
    encoding: "utf-8",
    row_count: rows.length,
    total_issue_count: Array.isArray(input.issues) ? input.issues.length : rows.length,
    truncated: Array.isArray(input.issues) && input.issues.length > MAX_ERROR_REPORT_ROWS,
    csv,
  };
}

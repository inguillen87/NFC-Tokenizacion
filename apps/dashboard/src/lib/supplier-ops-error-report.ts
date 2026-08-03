export type SupplierOpsDownloadableErrorReport = {
  stage: "manifest" | "qa";
  filename: string;
  csv: string;
  rowCount: number;
};

const MAX_FALLBACK_ROWS = 5_000;
const MAX_CELL_LENGTH = 500;

function safeCell(value: unknown) {
  if (value == null) return "";
  const raw = typeof value === "string" ? value : JSON.stringify(value);
  const cleaned = String(raw || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .slice(0, MAX_CELL_LENGTH);
  return /^[=+\-@]/.test(cleaned) ? `'${cleaned}` : cleaned;
}

function csvCell(value: unknown) {
  const text = safeCell(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function filenameToken(value: unknown) {
  return String(value || "UNKNOWN-BID")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "UNKNOWN-BID";
}

export function resolveSupplierOpsErrorReport(
  payload: unknown,
  fallback: { stage: "manifest" | "qa"; bid: string },
): SupplierOpsDownloadableErrorReport {
  const data = payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {};
  const embedded = data.error_report && typeof data.error_report === "object" && !Array.isArray(data.error_report)
    ? data.error_report as Record<string, unknown>
    : null;
  const embeddedCsv = embedded?.schema_version === "nexid-supplier-ops-error-report/v1"
    && embedded.encoding === "utf-8"
    && typeof embedded.csv === "string"
    && embedded.csv.length <= 4 * 1024 * 1024
      ? embedded.csv
      : "";
  if (embeddedCsv) {
    const safeName = String(embedded?.filename || "")
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .slice(0, 160);
    return {
      stage: fallback.stage,
      filename: safeName.endsWith(".csv") ? safeName : `nexid-${fallback.stage}-errors-${filenameToken(fallback.bid)}.csv`,
      csv: embeddedCsv,
      rowCount: Math.max(1, Math.trunc(Number(embedded?.row_count || 1))),
    };
  }

  const reason = safeCell(data.reason || `${fallback.stage}_operation_failed`);
  const message = safeCell(data.message || reason);
  const rejectedRows = Array.isArray(data.rejectedRows) ? data.rejectedRows : [];
  const duplicateUids = Array.isArray(data.duplicateUids) ? data.duplicateUids : [];
  const issues: Array<Record<string, unknown>> = [];
  for (const raw of rejectedRows.slice(0, MAX_FALLBACK_ROWS)) {
    const row = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
    issues.push({ row: row.row, code: row.reason || reason, field: row.field, value: row.value, detail: message });
  }
  for (const uid of duplicateUids.slice(0, Math.max(0, MAX_FALLBACK_ROWS - issues.length))) {
    issues.push({ code: "duplicate_uid", field: "uid_hex", value: uid, detail: message });
  }
  if (!issues.length) {
    const facts = [
      data.expected != null ? `expected=${safeCell(data.expected)}` : "",
      data.received != null ? `received=${safeCell(data.received)}` : "",
      data.required_manifest_uids != null ? `required_manifest_uids=${safeCell(data.required_manifest_uids)}` : "",
      data.received_manifest_uids != null ? `received_manifest_uids=${safeCell(data.received_manifest_uids)}` : "",
    ].filter(Boolean).join(";");
    issues.push({ code: reason, value: facts, detail: message });
  }

  const columns = ["stage", "bid", "row", "code", "field", "value", "detail"] as const;
  const csvRows = issues.map((issue) => ({
    stage: fallback.stage,
    bid: fallback.bid,
    row: issue.row || "",
    code: issue.code || reason,
    field: issue.field || "",
    value: issue.value || "",
    detail: issue.detail || message,
  }));
  return {
    stage: fallback.stage,
    filename: `nexid-${fallback.stage}-errors-${filenameToken(fallback.bid)}.csv`,
    csv: [columns.join(","), ...csvRows.map((row) => columns.map((column) => csvCell(row[column])).join(","))].join("\r\n"),
    rowCount: csvRows.length,
  };
}

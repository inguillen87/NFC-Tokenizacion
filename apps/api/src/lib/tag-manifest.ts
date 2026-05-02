import crypto from "node:crypto";
import { parse } from "csv-parse/sync";

export type ParsedManifestRow = {
  uidHex: string;
  batchId: string | null;
  productName: string | null;
  sku: string | null;
  lot: string | null;
  serial: string | null;
  expiresAt: string | null;
  raw: Record<string, string>;
};

export type ManifestParseResult = {
  contentHash: string;
  manifestType: "csv" | "txt";
  rows: ParsedManifestRow[];
  duplicateUids: string[];
  rejectedRows: Array<{ row: number; reason: string; value?: string }>;
};

function normalizeUid(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function getColumn(row: Record<string, string>, names: string[]) {
  const lowered = new Map(Object.entries(row).map(([key, value]) => [key.toLowerCase().trim(), String(value || "").trim()]));
  for (const name of names) {
    const value = lowered.get(name.toLowerCase());
    if (value) return value;
  }
  return "";
}

function parseCsv(content: string, delimiter: "," | ";") {
  return parse(content, {
    columns: true,
    bom: true,
    delimiter,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];
}

function parseTxt(content: string) {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const first = String(lines[0] || "").toLowerCase();
  const start = first === "uid" || first === "uid_hex" ? 1 : 0;
  return lines.slice(start).map((uid) => ({ uid_hex: uid }));
}

export function parseTagManifest(content: string, expectedBid: string): ManifestParseResult {
  const raw = String(content || "");
  const contentHash = `sha256:${crypto.createHash("sha256").update(raw).digest("hex")}`;
  const header = raw.split(/\r?\n/)[0] || "";
  const looksCsv = header.includes(",") || header.includes(";");
  let manifestType: "csv" | "txt" = "txt";
  let rawRows: Record<string, string>[] = [];

  if (looksCsv) {
    try {
      rawRows = parseCsv(raw, header.includes(";") ? ";" : ",");
      manifestType = "csv";
    } catch (error) {
      return {
        contentHash,
        manifestType: "csv",
        rows: [],
        duplicateUids: [],
        rejectedRows: [{ row: 0, reason: "invalid_csv", value: error instanceof Error ? error.message : "parse_failed" }],
      };
    }
  } else {
    rawRows = parseTxt(raw);
  }

  const rows: ParsedManifestRow[] = [];
  const duplicateUids: string[] = [];
  const rejectedRows: ManifestParseResult["rejectedRows"] = [];
  const seen = new Set<string>();
  const uidRe = /^[0-9A-F]{8,32}$/;

  rawRows.forEach((row, index) => {
    const uidHex = normalizeUid(getColumn(row, ["uid_hex", "uid", "uidHex", "UID"]));
    const batchId = getColumn(row, ["batch_id", "batchId", "bid"]) || null;
    if (!uidHex) {
      rejectedRows.push({ row: index + 1, reason: "uid_hex_required" });
      return;
    }
    if (!uidRe.test(uidHex)) {
      rejectedRows.push({ row: index + 1, reason: "invalid_uid_hex", value: uidHex });
      return;
    }
    if (batchId && batchId !== expectedBid) {
      rejectedRows.push({ row: index + 1, reason: "batch_id_mismatch", value: batchId });
      return;
    }
    if (seen.has(uidHex)) {
      duplicateUids.push(uidHex);
      rejectedRows.push({ row: index + 1, reason: "duplicate_uid_in_manifest", value: uidHex });
      return;
    }
    seen.add(uidHex);
    rows.push({
      uidHex,
      batchId,
      productName: getColumn(row, ["product_name", "productName", "name"]) || null,
      sku: getColumn(row, ["sku", "SKU"]) || null,
      lot: getColumn(row, ["lot", "lote", "lot_id"]) || null,
      serial: getColumn(row, ["serial", "serial_number"]) || null,
      expiresAt: getColumn(row, ["expires_at", "expiry", "expiration"]) || null,
      raw: row,
    });
  });

  if (manifestType === "csv" && rows.some((row) => !row.productName && !row.sku)) {
    rows.forEach((row, index) => {
      if (!row.productName && !row.sku) {
        rejectedRows.push({ row: index + 1, reason: "product_name_or_sku_required", value: row.uidHex });
      }
    });
  }

  return { contentHash, manifestType, rows, duplicateUids, rejectedRows };
}

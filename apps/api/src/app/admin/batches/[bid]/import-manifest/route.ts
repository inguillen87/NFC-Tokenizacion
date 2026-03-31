export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { parse } from "csv-parse/sync";
import { sql } from "../../../../../lib/db";
import { checkAdmin } from "../../../../../lib/auth";
import { json } from "../../../../../lib/http";

type ManifestPayload = {
  csv?: string;
  activateImported?: boolean;
};

type ManifestRow = Record<string, string>;

function normalizeUid(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function normalizeBatchId(value: unknown) {
  return String(value || "").trim();
}

async function readPayload(req: Request): Promise<ManifestPayload & { csv: string }> {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as ManifestPayload;
    return { csv: String(body.csv || ""), activateImported: Boolean(body.activateImported) };
  }

  const raw = await req.text();
  return { csv: raw, activateImported: false };
}

function parseUidText(content: string): ManifestRow[] {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const first = lines[0].toLowerCase();
  const startIndex = first === "uid_hex" || first === "uid" ? 1 : 0;
  return lines.slice(startIndex).map((uid) => ({ uid_hex: uid }));
}

function parseManifestRows(content: string): ManifestRow[] {
  try {
    const rows = parse(content, { columns: true, skip_empty_lines: true, trim: true }) as ManifestRow[];
    if (rows.length) return rows;
  } catch {
    // fall through and try plain UID list parsing
  }

  return parseUidText(content);
}

export async function POST(req: Request, { params }: { params: Promise<{ bid: string }> }) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const { bid } = await params;
  const batchRows = await sql/*sql*/`SELECT id FROM batches WHERE bid = ${bid} LIMIT 1`;
  const batch = batchRows[0];
  if (!batch) return json({ ok: false, reason: "batch not found" }, 404);

  const payload = await readPayload(req);
  if (!payload.csv.trim()) return json({ ok: false, reason: "empty csv body" }, 400);

  const rows = parseManifestRows(payload.csv);
  if (!rows.length) return json({ ok: false, reason: "manifest has no rows" }, 400);

  const manifestBatchIds = Array.from(new Set(rows.map((row) => normalizeBatchId(row.batch_id || row.batchId)).filter(Boolean)));
  const mismatchedBatchIds = manifestBatchIds.filter((value) => value !== bid);
  if (mismatchedBatchIds.length > 0) {
    return json({ ok: false, reason: "manifest batch_id does not match route batch", expected: bid, manifestBatchIds }, 400);
  }

  const seen = new Set<string>();
  const duplicates: string[] = [];
  let inserted = 0;
  let reactivated = 0;
  let ignored = 0;

  for (const row of rows) {
    const uid = normalizeUid(row.uid_hex || row.UID || row.uid || row.uidHex);
    if (!uid) {
      ignored += 1;
      continue;
    }
    if (seen.has(uid)) {
      duplicates.push(uid);
      continue;
    }
    seen.add(uid);

    const result = await sql/*sql*/`
      INSERT INTO tags (batch_id, uid_hex, status)
      VALUES (${batch.id}, ${uid}, ${payload.activateImported ? 'active' : 'inactive'})
      ON CONFLICT (batch_id, uid_hex)
      DO UPDATE SET status = CASE
        WHEN ${payload.activateImported} THEN 'active'::tag_status
        ELSE tags.status
      END
      RETURNING xmax = 0 AS inserted, status
    `;
    const current = result[0];
    if (current?.inserted) inserted += 1;
    else if (payload.activateImported) reactivated += 1;
  }

  return json({
    ok: true,
    batch: bid,
    manifestBatchIds: manifestBatchIds.length ? manifestBatchIds : [bid],
    importedRows: rows.length,
    inserted,
    reactivated,
    ignored,
    duplicateUids: duplicates,
    activated: payload.activateImported,
  });
}

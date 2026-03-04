import { parse } from "csv-parse/sync";
import { sql } from "../../../../../lib/db";
import { checkAdmin } from "../../../../../lib/auth";
import { json } from "../../../../../lib/http";

export async function POST(req: Request, { params }: { params: Promise<{ bid: string }> }) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const { bid } = await params;
  const batchRows = await sql/*sql*/`SELECT id FROM batches WHERE bid = ${bid} LIMIT 1`;
  const batch = batchRows[0];
  if (!batch) return json({ ok: false, reason: "batch not found" }, 404);

  const raw = await req.text();
  if (!raw.trim()) return json({ ok: false, reason: "empty csv body" }, 400);

  const rows = parse(raw, { columns: true, skip_empty_lines: true }) as Array<Record<string, string>>;
  let inserted = 0;

  for (const row of rows) {
    const uid = String(row.uid_hex || row.UID || "").toUpperCase();
    if (!uid) continue;
    await sql/*sql*/`
      INSERT INTO tags (batch_id, uid_hex)
      VALUES (${batch.id}, ${uid})
      ON CONFLICT (batch_id, uid_hex) DO NOTHING
    `;
    inserted += 1;
  }

  return json({ ok: true, inserted, batch: bid });
}

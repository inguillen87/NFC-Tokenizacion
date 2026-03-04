export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { sql } from "../../../../lib/db";
import { checkAdmin } from "../../../../lib/auth";
import { json } from "../../../../lib/http";

export async function POST(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const body: Record<string, unknown> = await req.json().catch(() => ({}));
  const bid = String(body.bid || "");
  const uids = Array.isArray(body.uids)
    ? body.uids.map((x: unknown) => String(x).toUpperCase())
    : [];

  if (!bid || uids.length === 0) return json({ ok: false, reason: "bid and uids required" }, 400);

  const batchRows = await sql/*sql*/`SELECT id FROM batches WHERE bid = ${bid} LIMIT 1`;
  const batch = batchRows[0];
  if (!batch) return json({ ok: false, reason: "batch not found" }, 404);

  await sql/*sql*/`
    UPDATE tags
    SET status = 'active'
    WHERE batch_id = ${batch.id} AND uid_hex = ANY(${uids})
  `;

  return json({ ok: true, activated: uids.length, batch: bid });
}

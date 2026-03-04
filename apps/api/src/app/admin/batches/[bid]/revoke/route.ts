export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { sql } from "../../../../../lib/db";
import { checkAdmin } from "../../../../../lib/auth";
import { json } from "../../../../../lib/http";

export async function POST(req: Request, { params }: { params: Promise<{ bid: string }> }) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const { bid } = await params;
  const rows = await sql/*sql*/`
    UPDATE batches
    SET status = 'revoked'
    WHERE bid = ${bid}
    RETURNING id, bid, status
  `;

  if (!rows[0]) return json({ ok: false, reason: "batch not found" }, 404);
  return json({ ok: true, batch: rows[0] });
}

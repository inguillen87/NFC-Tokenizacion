export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../../lib/auth";
import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";

type Body = {
  uid_hex?: string;
  batch_id?: string;
  reason?: string;
  evidence_note?: string;
  source?: string;
};

export async function POST(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const body = (await req.json().catch(() => ({}))) as Body;
  const uidHex = String(body.uid_hex || "").trim().toUpperCase();
  const bid = String(body.batch_id || "").trim();
  if (!uidHex || !bid) return json({ ok: false, reason: "uid_hex and batch_id required" }, 400);

  const batchRows = await sql/*sql*/`SELECT id FROM batches WHERE bid = ${bid} LIMIT 1`;
  const batch = batchRows[0];
  if (!batch) return json({ ok: false, reason: "batch not found" }, 404);

  await sql/*sql*/`
    CREATE TABLE IF NOT EXISTS tag_manual_tamper_overrides (
      id bigserial PRIMARY KEY,
      batch_id uuid NOT NULL,
      uid_hex text NOT NULL,
      tamper_status text NOT NULL,
      reason text,
      evidence_note text,
      source text NOT NULL DEFAULT 'operator',
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (batch_id, uid_hex)
    )
  `;

  await sql/*sql*/`
    INSERT INTO tag_manual_tamper_overrides (batch_id, uid_hex, tamper_status, reason, evidence_note, source, updated_at)
    VALUES (${batch.id}, ${uidHex}, 'MANUAL_OPENED', ${String(body.reason || 'physical seal broken during demo')}, ${String(body.evidence_note || '')}, ${String(body.source || 'operator')}, now())
    ON CONFLICT (batch_id, uid_hex)
    DO UPDATE SET tamper_status='MANUAL_OPENED', reason=EXCLUDED.reason, evidence_note=EXCLUDED.evidence_note, source=EXCLUDED.source, updated_at=now()
  `;

  return json({ ok: true, batch_id: bid, uid_hex: uidHex, tamper_status: "MANUAL_OPENED", tamper_source: "manual" });
}

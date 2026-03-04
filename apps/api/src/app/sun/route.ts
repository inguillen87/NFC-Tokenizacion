export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { sql } from "../../lib/db";
import { decryptKey16 } from "../../lib/keys";
import { verifySun } from "../../lib/crypto/sdm";
import { json } from "../../lib/http";

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const bid = url.searchParams.get("bid") || "";
  const picc_data = url.searchParams.get("picc_data") || "";
  const enc = url.searchParams.get("enc") || "";
  const cmac = url.searchParams.get("cmac") || "";
  const ua = req.headers.get("user-agent") || "";
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

  if (!bid || !picc_data || !enc || !cmac) {
    return json({ ok: false, reason: "missing params", need: ["bid", "picc_data", "enc", "cmac"] }, 400);
  }

  const batchRows = await sql/*sql*/`
    SELECT b.id, b.tenant_id, b.status, b.meta_key_ct, b.file_key_ct
    FROM batches b
    WHERE b.bid = ${bid}
    LIMIT 1
  `;
  const batch = batchRows[0];
  if (!batch) return json({ ok: false, reason: "unknown batch" }, 404);
  if (batch.status === "revoked") return json({ ok: false, reason: "batch revoked" }, 403);

  const kMeta = decryptKey16(batch.meta_key_ct).toString("hex").toUpperCase();
  const kFile = decryptKey16(batch.file_key_ct).toString("hex").toUpperCase();

  const res = verifySun({ piccDataHex: picc_data, encHex: enc, cmacHex: cmac, kMetaHex: kMeta, kFileHex: kFile });

  let allowlisted = false;
  let tagStatus: string | null = null;
  let replaySuspect = false;

  if (res.ok) {
    const tagRows = await sql/*sql*/`
      SELECT id, status, last_seen_ctr
      FROM tags
      WHERE batch_id = ${batch.id} AND uid_hex = ${res.uidHex}
      LIMIT 1
    `;
    const tag = tagRows[0];
    if (tag) {
      allowlisted = true;
      tagStatus = tag.status;
      if (typeof tag.last_seen_ctr === "number" && res.ctr <= tag.last_seen_ctr) replaySuspect = true;
      await sql/*sql*/`
        UPDATE tags
        SET scan_count = scan_count + 1,
            first_seen_at = COALESCE(first_seen_at, now()),
            last_seen_at = now(),
            last_seen_ctr = GREATEST(COALESCE(last_seen_ctr, -1), ${res.ctr})
        WHERE id = ${tag.id}
      `;
    }
  }

  const result = !res.ok
    ? "INVALID"
    : !allowlisted
      ? "NOT_REGISTERED"
      : tagStatus !== "active"
        ? "NOT_ACTIVE"
        : replaySuspect
          ? "REPLAY_SUSPECT"
          : "VALID";

  await sql/*sql*/`
    INSERT INTO events (tenant_id, batch_id, uid_hex, sdm_read_ctr, cmac_ok, allowlisted, tag_status, result, reason, ip, user_agent, raw_query)
    VALUES (
      ${batch.tenant_id},
      ${batch.id},
      ${res.ok ? res.uidHex : null},
      ${res.ok ? res.ctr : null},
      ${res.ok},
      ${allowlisted},
      ${tagStatus},
      ${result},
      ${res.ok ? null : res.reason},
      ${ip},
      ${ua},
      ${JSON.stringify(Object.fromEntries(url.searchParams.entries()))}::jsonb
    )
  `;

  return json({
    ok: result === "VALID",
    result,
    bid,
    uid: res.ok ? res.uidHex : undefined,
    ctr: res.ok ? res.ctr : undefined,
    enc_plain_hex: res.ok ? res.encPlainHex : undefined,
    allowlisted,
    tag_status: tagStatus,
    reason: res.ok ? undefined : res.reason,
  }, result === "VALID" ? 200 : 403);
}

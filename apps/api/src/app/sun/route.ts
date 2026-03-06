export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { sql } from "../../lib/db";
import { decryptKey16 } from "../../lib/keys";
import { verifySun } from "../../lib/crypto/sdm";
import { json } from "../../lib/http";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = Number(process.env.SUN_RATE_LIMIT_PER_MIN || 120);
const rateMap = new Map<string, { count: number; start: number }>();

function isRateLimited(ip: string | null) {
  if (!ip) return false;
  const now = Date.now();
  const current = rateMap.get(ip);
  if (!current || now - current.start > RATE_LIMIT_WINDOW_MS) {
    rateMap.set(ip, { count: 1, start: now });
    return false;
  }
  current.count += 1;
  rateMap.set(ip, current);
  return current.count > RATE_LIMIT_MAX;
}

async function dispatchValidScanWebhook(payload: Record<string, unknown>) {
  const url = process.env.SCAN_WEBHOOK_URL;
  if (!url) return;
  const secret = process.env.SCAN_WEBHOOK_SECRET || "";
  await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secret ? { "x-nexid-signature": secret } : {}),
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  }).catch(() => null);
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const bid = url.searchParams.get("bid") || "";
  const picc_data = url.searchParams.get("picc_data") || "";
  const enc = url.searchParams.get("enc") || "";
  const cmac = url.searchParams.get("cmac") || "";
  const ua = req.headers.get("user-agent") || "";
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const geoCity = req.headers.get("x-vercel-ip-city") || null;
  const geoCountry = req.headers.get("x-vercel-ip-country") || null;
  const geoLat = Number(req.headers.get("x-vercel-ip-latitude") || "");
  const geoLng = Number(req.headers.get("x-vercel-ip-longitude") || "");
  const hasGeo = Number.isFinite(geoLat) && Number.isFinite(geoLng);

  if (isRateLimited(ip)) {
    return json({ ok: false, reason: "rate_limited", limitPerMinute: RATE_LIMIT_MAX }, 429);
  }

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
    INSERT INTO events (tenant_id, batch_id, uid_hex, sdm_read_ctr, cmac_ok, allowlisted, tag_status, result, reason, ip, user_agent, geo_city, geo_country, geo_lat, geo_lng, raw_query)
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
      ${geoCity},
      ${geoCountry},
      ${hasGeo ? geoLat : null},
      ${hasGeo ? geoLng : null},
      ${JSON.stringify(Object.fromEntries(url.searchParams.entries()))}::jsonb
    )
  `;

  if (result === "VALID" && res.ok) {
    void dispatchValidScanWebhook({
      event: "tag.scan.valid",
      tenantId: batch.tenant_id,
      batchId: batch.id,
      bid,
      uid: res.uidHex,
      counter: res.ctr,
      ip,
      userAgent: ua,
      geoCity,
      geoCountry,
      geoLat: hasGeo ? geoLat : null,
      geoLng: hasGeo ? geoLng : null,
      ts: new Date().toISOString(),
    });
  }

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

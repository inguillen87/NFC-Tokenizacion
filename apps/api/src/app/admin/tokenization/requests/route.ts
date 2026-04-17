export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../../lib/auth";
import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
import { createHash, randomBytes } from "node:crypto";

function clean(value: unknown) {
  return String(value || "").trim();
}

function buildSimulatedTxHash(requestId: string, uid: string) {
  return `0x${createHash("sha256").update(`${requestId}:${uid}:${Date.now()}`).digest("hex")}`;
}

function buildTokenId(uid: string) {
  return createHash("sha1").update(uid).digest("hex").slice(0, 16);
}

export async function GET(req: Request): Promise<Response> {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || 100), 1), 500);
  const tenant = clean(searchParams.get("tenant"));
  const status = clean(searchParams.get("status"));

  const rows = tenant
    ? await sql/*sql*/`
      SELECT tr.*, tn.slug AS tenant_slug
      FROM tokenization_requests tr
      LEFT JOIN tenants tn ON tn.id = tr.tenant_id
      WHERE tn.slug = ${tenant}
        AND (${status || null}::text IS NULL OR tr.status = ${status})
      ORDER BY tr.requested_at DESC
      LIMIT ${limit}
    `
    : await sql/*sql*/`
      SELECT tr.*, tn.slug AS tenant_slug
      FROM tokenization_requests tr
      LEFT JOIN tenants tn ON tn.id = tr.tenant_id
      WHERE (${status || null}::text IS NULL OR tr.status = ${status})
      ORDER BY tr.requested_at DESC
      LIMIT ${limit}
    `;
  return json({ ok: true, rows });
}

export async function POST(req: Request): Promise<Response> {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const requestId = clean(body.request_id || body.id);
  const network = clean(body.network) || "polygon-amoy";
  const issuerWallet = clean(body.issuer_wallet) || null;

  if (!requestId) return json({ ok: false, reason: "request_id required" }, 400);

  const rows = await sql/*sql*/`
    SELECT id, bid, uid_hex, status
    FROM tokenization_requests
    WHERE id = ${requestId}::uuid
    LIMIT 1
  `;
  const existing = rows[0];
  if (!existing) return json({ ok: false, reason: "request not found" }, 404);
  if (existing.status === "anchored") return json({ ok: true, request_id: existing.id, status: "anchored", already_processed: true });

  const txHash = buildSimulatedTxHash(existing.id, existing.uid_hex);
  const tokenId = buildTokenId(existing.uid_hex);
  const anchorHash = `0x${randomBytes(32).toString("hex")}`;

  await sql/*sql*/`
    UPDATE tokenization_requests
    SET status = 'anchored',
        network = ${network},
        issuer_wallet = COALESCE(${issuerWallet}, issuer_wallet),
        tx_hash = ${txHash},
        token_id = ${tokenId},
        anchor_hash = ${anchorHash},
        processed_at = now(),
        meta = COALESCE(meta, '{}'::jsonb) || ${JSON.stringify({ processor: "admin_tokenize_endpoint", anchored_at: new Date().toISOString() })}::jsonb
    WHERE id = ${existing.id}::uuid
  `;

  await sql/*sql*/`
    INSERT INTO demo_cta_actions (action, bid, uid_hex, payload)
    VALUES (
      'ledger_anchored',
      ${existing.bid},
      ${existing.uid_hex},
      ${JSON.stringify({ tx_hash: txHash, token_id: tokenId, network, anchor_hash: anchorHash, issuer_wallet: issuerWallet })}::jsonb
    )
  `;

  return json({
    ok: true,
    request_id: existing.id,
    status: "anchored",
    tx_hash: txHash,
    token_id: tokenId,
    network,
    anchor_hash: anchorHash,
  });
}

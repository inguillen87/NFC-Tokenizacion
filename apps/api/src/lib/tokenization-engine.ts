import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { sql } from "./db";
import { buildChipUidHash } from "./tokenization-hash";

type AnchorInput = {
  requestId: string;
  network?: string;
  issuerWallet?: string | null;
  processor?: string;
};

function buildSimulatedTxHash(requestId: string, uid: string) {
  return `0x${createHash("sha256").update(`${requestId}:${uid}:${Date.now()}`).digest("hex")}`;
}

function buildTokenId(uid: string) {
  return createHash("sha1").update(uid).digest("hex").slice(0, 16);
}

async function runExternalExecutor(payload: Record<string, unknown>) {
  const url = (process.env.TOKENIZATION_EXECUTOR_URL || "").trim();
  if (!url) return null;

  const secret = (process.env.TOKENIZATION_EXECUTOR_SECRET || "").trim();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secret ? { "x-tokenization-secret": secret } : {}),
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`executor_http_${response.status}`);
  return response.json().catch(() => null) as Promise<Record<string, unknown> | null>;
}

async function runLocalPolygonScript(payload: Record<string, unknown>) {
  const enabled = String(process.env.TOKENIZATION_USE_LOCAL_MINTER || "false").toLowerCase() === "true";
  if (!enabled) return null;
  const uid = String(payload.uid_hex || "").trim();
  if (!uid) return null;

  const recipient = String(payload.issuer_wallet || process.env.POLYGON_DEFAULT_RECIPIENT || "").trim();
  const tokenUri = String(payload.token_uri || "").trim();
  if (!recipient || !tokenUri) return null;

  const scriptPath = new URL("../../scripts/mint-on-valid-tap.mjs", import.meta.url);
  const args = [
    scriptPath.pathname,
    `--uid=${uid}`,
    `--to=${recipient}`,
    `--token_uri=${tokenUri}`,
    `--asset_ref=${String(payload.asset_ref || "")}`,
  ];

  return await new Promise<Record<string, unknown> | null>((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (buf) => { stdout += String(buf); });
    child.stderr.on("data", (buf) => { stderr += String(buf); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(stderr.trim() || `local_minter_exit_${code}`));
      const line = stdout.trim().split("\n").filter(Boolean).at(-1);
      if (!line) return resolve(null);
      try {
        resolve(JSON.parse(line) as Record<string, unknown>);
      } catch {
        reject(new Error("local_minter_invalid_json"));
      }
    });
  });
}

export async function anchorTokenizationRequest(input: AnchorInput) {
  const rows = await sql/*sql*/`
    SELECT id, bid, uid_hex, status, network, issuer_wallet, attempt_count
    FROM tokenization_requests
    WHERE id = ${input.requestId}::uuid
    LIMIT 1
  `;
  const existing = rows[0];
  if (!existing) return { ok: false, reason: "request_not_found" } as const;
  if (existing.status === "anchored") return { ok: true, status: "anchored", already_processed: true, request: existing } as const;

  const network = input.network || existing.network || "polygon-amoy";
  const issuerWallet = input.issuerWallet || existing.issuer_wallet || null;
  const processor = input.processor || "tokenization_engine";

  try {
    const tokenUri = `ipfs://${(process.env.TOKENIZATION_METADATA_CID_PREFIX || "nexid-metadata")}/${existing.bid}/${existing.uid_hex}.json`;
    const assetRef = `${existing.bid}:${existing.uid_hex}`;
    const externalInput = {
      request_id: existing.id,
      bid: existing.bid,
      uid_hex: existing.uid_hex,
      network,
      issuer_wallet: issuerWallet,
      token_uri: tokenUri,
      asset_ref: assetRef,
      chip_uid_hash: buildChipUidHash(existing.uid_hex),
    };

    const localPolygonMint = network.startsWith("polygon")
      ? await runLocalPolygonScript(externalInput)
      : null;
    const external = localPolygonMint || await runExternalExecutor(externalInput);

    const txHash = String(external?.tx_hash || buildSimulatedTxHash(existing.id, existing.uid_hex));
    const tokenId = String(external?.token_id || buildTokenId(existing.uid_hex));
    const anchorHash = String(external?.anchor_hash || `0x${randomBytes(32).toString("hex")}`);
    const externalRef = external?.external_ref ? String(external.external_ref) : null;

    await sql/*sql*/`
      UPDATE tokenization_requests
      SET status = 'anchored',
          network = ${network},
          issuer_wallet = COALESCE(${issuerWallet}, issuer_wallet),
          tx_hash = ${txHash},
          token_id = ${tokenId},
          anchor_hash = ${anchorHash},
          external_ref = COALESCE(${externalRef}, external_ref),
          processed_at = now(),
          last_error = NULL,
          attempt_count = attempt_count + 1,
          meta = COALESCE(meta, '{}'::jsonb) || ${JSON.stringify({ processor, anchored_at: new Date().toISOString() })}::jsonb
      WHERE id = ${existing.id}::uuid
    `;

    await sql/*sql*/`
      INSERT INTO demo_cta_actions (action, bid, uid_hex, payload)
      VALUES (
        'ledger_anchored',
        ${existing.bid},
        ${existing.uid_hex},
        ${JSON.stringify({ tx_hash: txHash, token_id: tokenId, network, anchor_hash: anchorHash, issuer_wallet: issuerWallet, external_ref: externalRef })}::jsonb
      )
    `;

    return { ok: true, status: "anchored", request_id: existing.id, tx_hash: txHash, token_id: tokenId, network, anchor_hash: anchorHash } as const;
  } catch (error) {
    const message = error instanceof Error ? error.message : "tokenization_failed";
    const attempts = Number(existing.attempt_count || 0) + 1;
    const retryMs = Math.min(15 * 60 * 1000, 30_000 * attempts);
    const nextAttemptAt = new Date(Date.now() + retryMs).toISOString();
    const nextStatus = attempts >= 6 ? "failed" : "pending";

    await sql/*sql*/`
      UPDATE tokenization_requests
      SET status = ${nextStatus},
          attempt_count = attempt_count + 1,
          last_error = ${message},
          next_attempt_at = ${nextAttemptAt}::timestamptz,
          meta = COALESCE(meta, '{}'::jsonb) || ${JSON.stringify({ processor, failed_at: new Date().toISOString() })}::jsonb
      WHERE id = ${existing.id}::uuid
    `;

    return { ok: false, reason: message, request_id: existing.id, status: nextStatus, next_attempt_at: nextAttemptAt } as const;
  }
}

import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { sql } from "./db";
import { buildChipUidHash } from "./tokenization-hash";
import { ensureTokenizationRequestsSchema } from "./tokenization-schema";

type AnchorInput = {
  requestId: string;
  network?: string;
  issuerWallet?: string | null;
  processor?: string;
};

const POLYGON_MINT_ABI = [
  "function mintWithChipHash(address to, string chipUidHash, string tokenUri, string assetRef) external returns (uint256)",
  "function tokenByChipHash(string chipUidHash) external view returns (uint256)",
] as const;

function buildSimulatedTxHash(requestId: string, uid: string) {
  return `0x${createHash("sha256").update(`${requestId}:${uid}:${Date.now()}`).digest("hex")}`;
}

function buildTokenId(uid: string) {
  return createHash("sha1").update(uid).digest("hex").slice(0, 16);
}

function buildPublicAssetId(chipUidHash: string) {
  const digest = String(chipUidHash || "").split(":").pop() || chipUidHash;
  return `nx-${digest.slice(0, 24)}`;
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

function normalizePrivateKey(raw: string) {
  const value = raw.trim();
  if (/^0x[0-9a-fA-F]{64}$/.test(value)) return value;
  if (/^[0-9a-fA-F]{64}$/.test(value)) return `0x${value}`;
  return value;
}

async function runDirectPolygonMint(payload: Record<string, unknown>) {
  const enabled = String(process.env.TOKENIZATION_USE_LOCAL_MINTER || "false").toLowerCase() === "true";
  if (!enabled) return null;

  const rpcUrl = String(process.env.POLYGON_RPC_URL || "").trim();
  const privateKey = normalizePrivateKey(String(process.env.POLYGON_MINTER_PRIVATE_KEY || ""));
  const contractAddress = String(process.env.POLYGON_CONTRACT_ADDRESS || "").trim();
  const chipUidHash = String(payload.chip_uid_hash || "").trim();
  const recipient = String(payload.issuer_wallet || process.env.POLYGON_DEFAULT_RECIPIENT || "").trim();
  const tokenUri = String(payload.token_uri || "").trim();
  const assetRef = String(payload.asset_ref || "").trim();

  if (!rpcUrl) throw new Error("missing_POLYGON_RPC_URL_for_direct_minter");
  if (!privateKey) throw new Error("missing_POLYGON_MINTER_PRIVATE_KEY_for_direct_minter");
  if (!contractAddress) throw new Error("missing_POLYGON_CONTRACT_ADDRESS_for_direct_minter");
  if (!chipUidHash) throw new Error("missing_chip_uid_hash_for_direct_minter");
  if (!recipient) throw new Error("missing_recipient_for_direct_minter");
  if (!tokenUri) throw new Error("missing_token_uri_for_direct_minter");
  if (!assetRef) throw new Error("missing_asset_ref_for_direct_minter");

  const { ethers } = await import("ethers");
  if (!ethers.isAddress(contractAddress)) throw new Error("invalid_POLYGON_CONTRACT_ADDRESS");
  if (!ethers.isAddress(recipient)) throw new Error("invalid_polygon_recipient");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(contractAddress, POLYGON_MINT_ABI, wallet);

  const existingTokenId = await contract.tokenByChipHash(chipUidHash);
  const existingTokenIdText = String(existingTokenId || "0");
  if (BigInt(existingTokenIdText) > 0n) {
    return {
      ok: true,
      network: "polygon",
      tx_hash: null,
      token_id: existingTokenIdText,
      chip_uid_hash: chipUidHash,
      anchor_hash: `polygon-token:${contractAddress}:${existingTokenIdText}`,
      external_ref: `polygon-amoy:${contractAddress}:${existingTokenIdText}`,
      already_minted: true,
    };
  }

  const tx = await contract.mintWithChipHash(recipient, chipUidHash, tokenUri, assetRef);
  const receipt = await tx.wait();
  if (!receipt) throw new Error("polygon_receipt_missing");

  const transferTopic = ethers.id("Transfer(address,address,uint256)");
  const transferLog = receipt.logs.find((log: { topics?: string[] }) => log.topics?.[0] === transferTopic && log.topics?.[3]);
  const tokenId = transferLog?.topics?.[3] ? String(BigInt(transferLog.topics[3])) : null;

  return {
    ok: true,
    network: "polygon",
    tx_hash: tx.hash,
    token_id: tokenId,
    chip_uid_hash: chipUidHash,
    block_number: receipt.blockNumber,
    anchor_hash: tx.hash,
    external_ref: `polygon-amoy:${contractAddress}:${tokenId || tx.hash}`,
  };
}

async function runLocalPolygonScript(payload: Record<string, unknown>) {
  const enabled = String(process.env.TOKENIZATION_USE_LOCAL_MINTER || "false").toLowerCase() === "true";
  if (!enabled) return null;
  const chipUidHash = String(payload.chip_uid_hash || "").trim();
  const uid = String(payload.uid_hex || "").trim();
  if (!chipUidHash && !uid) return null;

  const recipient = String(payload.issuer_wallet || process.env.POLYGON_DEFAULT_RECIPIENT || "").trim();
  const tokenUri = String(payload.token_uri || "").trim();
  if (!recipient || !tokenUri) return null;

  const scriptPath = fileURLToPath(new URL("../../scripts/mint-on-valid-tap.mjs", import.meta.url));
  const args = [
    scriptPath,
    `--to=${recipient}`,
    `--token_uri=${tokenUri}`,
    `--asset_ref=${String(payload.asset_ref || "")}`,
    ...(chipUidHash ? [`--chip_uid_hash=${chipUidHash}`] : [`--uid=${uid}`]),
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
  await ensureTokenizationRequestsSchema();

  const tokenizationMode = String(process.env.TOKENIZATION_MODE || "simulated").trim().toLowerCase();
  const rows = await sql/*sql*/`
    SELECT id, bid, uid_hex, status, network, issuer_wallet, attempt_count, tx_hash, token_id, anchor_hash, external_ref
    FROM tokenization_requests
    WHERE id = ${input.requestId}::uuid
    LIMIT 1
  `;
  const existing = rows[0];
  if (!existing) return { ok: false, reason: "request_not_found" } as const;
  if (existing.status === "anchored") {
    return {
      ok: true,
      status: "anchored",
      already_processed: true,
      request_id: existing.id,
      tx_hash: existing.tx_hash || null,
      token_id: existing.token_id || null,
      network: existing.network || input.network || "polygon-amoy",
      anchor_hash: existing.anchor_hash || null,
      external_ref: existing.external_ref || null,
      request: existing,
    } as const;
  }

  const network = input.network || existing.network || "polygon-amoy";
  const issuerWallet = input.issuerWallet || existing.issuer_wallet || null;
  const processor = input.processor || "tokenization_engine";

  try {
    const chipUidHash = buildChipUidHash(existing.uid_hex);
    const publicAssetId = buildPublicAssetId(chipUidHash);
    const tokenUri = `ipfs://${(process.env.TOKENIZATION_METADATA_CID_PREFIX || "nexid-metadata")}/${existing.bid}/${publicAssetId}.json`;
    const assetRef = `${existing.bid}:${publicAssetId}`;
    const externalInput = {
      request_id: existing.id,
      bid: existing.bid,
      network,
      issuer_wallet: issuerWallet,
      token_uri: tokenUri,
      asset_ref: assetRef,
      chip_uid_hash: chipUidHash,
      public_asset_id: publicAssetId,
    };

    let external = null as Record<string, unknown> | null;
    const polygonMode = tokenizationMode === "polygon";

    if (polygonMode) {
      const wantsLocalMinter = String(process.env.TOKENIZATION_USE_LOCAL_MINTER || "false").toLowerCase() === "true";
      if (wantsLocalMinter && !process.env.POLYGON_RPC_URL) {
        throw new Error("missing_POLYGON_RPC_URL_for_local_minter");
      }
      external = await runExternalExecutor(externalInput);
      const directPolygonMint = !external && network.startsWith("polygon") ? await runDirectPolygonMint(externalInput) : null;
      const localPolygonMint = !external && !directPolygonMint && network.startsWith("polygon") ? await runLocalPolygonScript(externalInput) : null;
      external = external || directPolygonMint || localPolygonMint;
      if (!external?.tx_hash && !external?.token_id) {
        throw new Error("polygon_anchor_unavailable_configure_local_minter_or_executor");
      }
    }

    const txHash = external?.tx_hash ? String(external.tx_hash) : polygonMode ? null : buildSimulatedTxHash(existing.id, existing.uid_hex);
    const tokenId = external?.token_id ? String(external.token_id) : polygonMode ? null : buildTokenId(existing.uid_hex);
    const anchorHash = String(external?.anchor_hash || (polygonMode ? txHash || `polygon-token:${tokenId || existing.id}` : `0x${randomBytes(32).toString("hex")}`));
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
          meta = COALESCE(meta, '{}'::jsonb) || ${JSON.stringify({ processor, anchored_at: new Date().toISOString(), tokenization_mode: tokenizationMode, simulated: !polygonMode })}::jsonb
      WHERE id = ${existing.id}::uuid
    `;

    await sql/*sql*/`
      INSERT INTO demo_cta_actions (action, bid, uid_hex, payload)
      VALUES (
        'ledger_anchored',
        ${existing.bid},
        ${existing.uid_hex},
        ${JSON.stringify({ tx_hash: txHash, token_id: tokenId, network, anchor_hash: anchorHash, issuer_wallet: issuerWallet, external_ref: externalRef, simulated: !polygonMode })}::jsonb
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

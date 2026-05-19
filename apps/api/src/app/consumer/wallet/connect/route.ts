export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { isAddress } from "ethers";
import { getConsumerFromRequest } from "../../../../lib/consumer-auth";
import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";
import { ensureConsumerPortalSchema } from "../../../../lib/commercial-runtime-schema";

function cleanText(value: unknown, max = 80) {
  return String(value || "").trim().slice(0, max);
}

function maskAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export async function POST(req: Request) {
  await ensureConsumerPortalSchema();
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const address = cleanText(body.address || body.walletAddress || body.wallet_address, 64);
  const chainId = cleanText(body.chainId || body.chain_id, 24);
  const network = cleanText(body.network || body.provider || "metamask", 40);

  if (!address || !isAddress(address)) {
    return json({ ok: false, error: "invalid_wallet_address" }, 400);
  }
  if (chainId && !/^0x[0-9a-fA-F]+$|^[0-9]{1,20}$/.test(chainId)) {
    return json({ ok: false, error: "invalid_chain_id" }, 400);
  }

  const normalizedAddress = address.toLowerCase();
  const rows = await sql/*sql*/`
    UPDATE consumers
    SET wallet_address = ${normalizedAddress},
        wallet_chain_id = NULLIF(${chainId}, ''),
        wallet_network = NULLIF(${network}, ''),
        wallet_verified_at = now(),
        updated_at = now()
    WHERE id = ${consumer.id}
    RETURNING id, wallet_address, wallet_chain_id, wallet_network, wallet_verified_at
  `;

  const wallet = rows[0];
  return json({
    ok: true,
    wallet: {
      address: wallet.wallet_address,
      addressMasked: maskAddress(String(wallet.wallet_address || normalizedAddress)),
      chainId: wallet.wallet_chain_id || null,
      network: wallet.wallet_network || null,
      verifiedAt: wallet.wallet_verified_at || null,
    },
  });
}

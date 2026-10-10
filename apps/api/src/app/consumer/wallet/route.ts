export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { getConsumerFromRequest } from "../../../lib/consumer-auth";
import { json } from "../../../lib/http";
import { sql } from "../../../lib/db";
import { ensureConsumerPortalSchema } from "../../../lib/commercial-runtime-schema";
import { getPrivateConsumerProgramBalances } from "../../../lib/consumer-program-balance-read-model";
export async function GET(req: Request) {
  try {
    const consumer = await getConsumerFromRequest(req);
    if (!consumer) return json({ ok: false, error: "unauthorized" }, 401, { "cache-control": "private, no-store" });
    await ensureConsumerPortalSchema();
    const tenantWallets = await getPrivateConsumerProgramBalances(String(consumer.id));
    const networkWallet = await sql/*sql*/`
      SELECT points_balance, lifetime_points
      FROM consumer_reward_wallets
      WHERE consumer_id = ${consumer.id} AND tenant_id IS NULL AND network_scope = 'nexid_network'
      LIMIT 1
    `;
    return json({
      ok: true,
      tenantWallets,
      networkWallet: networkWallet[0] || { points_balance: 0, lifetime_points: 0, enabled: false },
      blockchainWallet: {
        address: consumer.wallet_address || null,
        chainId: consumer.wallet_chain_id || null,
        network: consumer.wallet_network || null,
        verifiedAt: consumer.wallet_verified_at || null,
        controlVerified: consumer.wallet_control_verified === true,
        verificationMethod: consumer.wallet_control_verified === true ? "signed_wallet_identity" : null,
      },
    }, 200, { "cache-control": "private, no-store" });
  } catch {
    return json({ ok: false, error: "unavailable" }, 503, { "cache-control": "private, no-store" });
  }
}

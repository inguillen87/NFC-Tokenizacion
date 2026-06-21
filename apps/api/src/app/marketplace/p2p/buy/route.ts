export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../lib/http";
import { getConsumerFromRequest } from "../../../../lib/consumer-auth";
import { sql } from "../../../../lib/db";
import { ensureConsumerPortalSchema } from "../../../../lib/commercial-runtime-schema";
import { transferBlockchainToken } from "../../../../lib/tokenization-engine";

export async function POST(req: Request) {
  await ensureConsumerPortalSchema();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const buyer = await getConsumerFromRequest(req);
  if (!buyer) return json({ ok: false, error: "unauthorized" }, 401);

  const offerId = String(body.offerId || "").trim();
  if (!offerId) return json({ ok: false, error: "missing_offer_id" }, 400);

  // 1. Fetch P2P offer
  const offerRows = await sql/*sql*/`
    SELECT *
    FROM marketplace_offers
    WHERE id = ${offerId}::uuid
      AND type = 'p2p_resale'
    LIMIT 1
  `;
  const offer = offerRows[0];
  if (!offer) return json({ ok: false, error: "offer_not_found" }, 404);
  if (offer.status !== "active") return json({ ok: false, error: "offer_not_active" }, 409);

  // 2. Prevent self-purchase
  if (offer.seller_consumer_id === buyer.id) {
    return json({ ok: false, error: "cannot_buy_own_listing" }, 400);
  }

  const resalePrice = Number(offer.resale_price || 0);
  const feeRate = 0.025; // 2.5% platform transaction fee
  const feeAmount = resalePrice * feeRate;
  const currency = offer.resale_currency || "USD";

  // Get buyer's wallet address or default to managed platform wallet for demo
  const buyerWallet = buyer.wallet_address || process.env.POLYGON_DEFAULT_RECIPIENT || "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";

  // 2.5. Fetch seller's ownership details to preserve database links (batch_id, event_id, tag_id)
  const sellerRows = await sql/*sql*/`
    SELECT id, batch_id, tag_id, event_id
    FROM consumer_product_ownerships
    WHERE consumer_id = ${offer.seller_consumer_id}
      AND UPPER(uid_hex) = UPPER(${offer.resale_uid_hex})
      AND status = 'claimed'
    LIMIT 1
  `;
  const sellerClaim = sellerRows[0];
  if (!sellerClaim) {
    return json({ ok: false, error: "seller_ownership_not_found" }, 404);
  }

  let txResult;
  try {
    // 3. Perform ownership update sequentially
    // Deactivate seller's ownership (status = 'revoked')
    await sql/*sql*/`
      UPDATE consumer_product_ownerships
      SET status = 'revoked', updated_at = now()
      WHERE id = ${sellerClaim.id}
    `;

    // Create new ownership for buyer matching schema constraints
    await sql/*sql*/`
      INSERT INTO consumer_product_ownerships (
        consumer_id,
        tenant_id,
        batch_id,
        tag_id,
        uid_hex,
        event_id,
        status,
        source,
        claimed_at,
        updated_at
      ) VALUES (
        ${buyer.id},
        ${offer.tenant_id},
        ${sellerClaim.batch_id},
        ${sellerClaim.tag_id},
        ${offer.resale_uid_hex},
        ${sellerClaim.event_id},
        'claimed',
        'marketplace',
        now(),
        now()
      )
    `;

    // Complete the offer listing status
    await sql/*sql*/`
      UPDATE marketplace_offers
      SET status = 'completed', updated_at = now()
      WHERE id = ${offer.id}
    `;

    // Log the purchase order request
    await sql/*sql*/`
      INSERT INTO marketplace_order_requests (
        consumer_id,
        tenant_id,
        marketplace_product_id,
        offer_id,
        status,
        quantity,
        consumer_message,
        contact_json,
        fee_amount,
        fee_currency,
        source_uid_hex,
        source_context_json
      ) VALUES (
        ${buyer.id},
        ${offer.tenant_id},
        ${offer.marketplace_product_id},
        ${offer.id},
        'completed',
        1,
        'P2P Secondary Resale Purchase',
        ${JSON.stringify({ email: buyer.email, phone: buyer.phone, buyer_wallet: buyerWallet, seller_id: offer.seller_consumer_id })}::jsonb,
        ${feeAmount},
        ${currency},
        ${offer.resale_uid_hex},
        ${JSON.stringify({ source: "marketplace_p2p_checkout", platform_fee_pct: 2.5 })}::jsonb
      )
    `;

    // 4. Trigger the blockchain token transfer
    txResult = await transferBlockchainToken({
      uidHex: offer.resale_uid_hex,
      toWallet: buyerWallet,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "p2p_checkout_failed";
    return json({ ok: false, error: message }, 500);
  }

  return json({
    ok: true,
    message: "Secondary market purchase completed successfully.",
    platformFee: {
      amount: feeAmount,
      currency,
      rate: "2.5%"
    },
    blockchainTransfer: {
      success: txResult.ok,
      simulated: txResult.simulated,
      txHash: txResult.tx_hash,
      tokenId: txResult.token_id,
      error: txResult.error || null,
    }
  }, 200);
}

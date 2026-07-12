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

  // A consumer wallet or the configured managed-custody wallet is required.
  // Never invent a recipient address for a completed marketplace order.
  const verifiedBuyerWallet = buyer.wallet_control_verified === true ? buyer.wallet_address : null;
  const buyerWallet = String(verifiedBuyerWallet || process.env.POLYGON_DEFAULT_RECIPIENT || "").trim();
  if (!buyerWallet) {
    return json({ ok: false, error: "buyer_wallet_not_configured" }, 503);
  }

  // 2.5. Fetch seller's ownership details to preserve database links (batch_id, event_id, tag_id)
  const sellerRows = await sql/*sql*/`
    SELECT id, batch_id, tag_id, event_id
    FROM consumer_product_ownerships
    WHERE consumer_id = ${offer.seller_consumer_id}
      AND tenant_id = ${offer.tenant_id}
      AND UPPER(uid_hex) = UPPER(${offer.resale_uid_hex})
      AND status = 'claimed'
    LIMIT 1
  `;
  const sellerClaim = sellerRows[0];
  if (!sellerClaim) {
    return json({ ok: false, error: "seller_ownership_not_found" }, 404);
  }

  // Confirm the ledger state before changing ownership records. In Polygon
  // mode this call fails closed; it cannot fall back to a simulated success.
  const txResult = await transferBlockchainToken({
    tenantId: String(offer.tenant_id),
    uidHex: offer.resale_uid_hex,
    toWallet: buyerWallet,
  });
  if (!txResult.ok) {
    const simulationOnly = txResult.simulated === true || ("reason" in txResult && txResult.reason === "polygon_transfer_requires_live_mode");
    return json({
      ok: false,
      error: simulationOnly ? "blockchain_transfer_simulation_only" : "blockchain_transfer_not_confirmed",
      reason: "reason" in txResult ? txResult.reason : "polygon_transfer_not_confirmed",
      retryable: !simulationOnly,
      nextStep: simulationOnly ? "enable_polygon_live_mode" : "retry_after_chain_recovery",
    }, simulationOnly ? 409 : 502);
  }

  const contactJson = JSON.stringify({
    email: buyer.email,
    phone: buyer.phone,
    buyer_wallet: buyerWallet,
    buyer_wallet_control_verified: Boolean(verifiedBuyerWallet),
    seller_id: offer.seller_consumer_id,
  });
  const sourceContextJson = JSON.stringify({
    source: "marketplace_p2p_checkout",
    platform_fee_pct: 2.5,
    blockchain: {
      state: txResult.state,
      simulated: txResult.simulated,
      tx_hash: txResult.tx_hash,
      token_id: txResult.token_id,
      block_number: "block_number" in txResult ? txResult.block_number || null : null,
      custody: "custody" in txResult ? txResult.custody || null : null,
      owner_before: "owner_before" in txResult ? txResult.owner_before || null : null,
      owner_after: "owner_after" in txResult ? txResult.owner_after || null : null,
    },
  });

  try {
    // One statement keeps seller revocation, buyer ownership, offer completion
    // and the order receipt atomic. A retry can reconcile a confirmed chain
    // transfer without leaving a half-written marketplace state.
    const purchaseRows = await sql/*sql*/`
      WITH eligible_offer AS (
        SELECT id
        FROM marketplace_offers
        WHERE id = ${offer.id}
          AND status = 'active'
        FOR UPDATE
      ),
      revoked_ownership AS (
        UPDATE consumer_product_ownerships
        SET status = 'revoked', updated_at = now()
        WHERE id = ${sellerClaim.id}
          AND status = 'claimed'
          AND EXISTS (SELECT 1 FROM eligible_offer)
        RETURNING id
      ),
      buyer_ownership AS (
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
        )
        SELECT
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
        FROM revoked_ownership
        RETURNING id
      ),
      completed_offer AS (
        UPDATE marketplace_offers
        SET status = 'completed', updated_at = now()
        WHERE id IN (SELECT id FROM eligible_offer)
          AND EXISTS (SELECT 1 FROM buyer_ownership)
        RETURNING id
      )
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
      )
      SELECT
        ${buyer.id},
        ${offer.tenant_id},
        ${offer.marketplace_product_id},
        ${offer.id},
        'completed',
        1,
        'P2P Secondary Resale Purchase',
        ${contactJson}::jsonb,
        ${feeAmount},
        ${currency},
        ${offer.resale_uid_hex},
        ${sourceContextJson}::jsonb
      FROM completed_offer
      RETURNING id
    `;
    if (!purchaseRows[0]) {
      return json({
        ok: false,
        error: "offer_state_changed",
        reconciliationRequired: !txResult.simulated && ["confirmed", "already_transferred"].includes(txResult.state),
        txHash: txResult.tx_hash,
      }, 409);
    }
  } catch (error) {
    console.error("[p2p_checkout_persistence_error]", error instanceof Error ? error.message : "unknown");
    return json({
      ok: false,
      error: "p2p_checkout_persistence_failed",
      reconciliationRequired: !txResult.simulated && ["confirmed", "already_transferred"].includes(txResult.state),
      txHash: txResult.tx_hash,
    }, 500);
  }

  return json({
    ok: true,
    message: txResult.state === "confirmed"
      ? "Secondary purchase and Polygon transfer confirmed."
      : txResult.state === "already_transferred"
        ? "Polygon ownership was already confirmed; the purchase record was reconciled."
        : txResult.state === "custody_unchanged"
          ? "Secondary purchase completed under nexID managed custody."
          : "Secondary purchase completed under verified custody.",
    platformFee: {
      amount: feeAmount,
      currency,
      rate: "2.5%"
    },
    blockchainTransfer: {
      success: txResult.ok,
      state: txResult.state,
      simulated: txResult.simulated,
      txHash: txResult.tx_hash,
      tokenId: txResult.token_id,
      blockNumber: "block_number" in txResult ? txResult.block_number || null : null,
      custody: "custody" in txResult ? txResult.custody || null : null,
      ownerBefore: "owner_before" in txResult ? txResult.owner_before || null : null,
      ownerAfter: "owner_after" in txResult ? txResult.owner_after || null : null,
    }
  }, 200);
}

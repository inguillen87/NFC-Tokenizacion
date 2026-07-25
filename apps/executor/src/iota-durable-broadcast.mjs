const RAW_TRANSACTION_PATTERN = /^0x(?:[0-9a-f]{2})+$/i;
const TX_HASH_PATTERN = /^0x[0-9a-f]{64}$/i;

function signedEnvelope(value) {
  const rawTransaction = String(value?.rawTransaction || value?.signedTransaction || "").trim();
  const txHash = String(value?.txHash || value?.transactionHash || "").trim().toLowerCase();
  const signerAddress = String(value?.signerAddress || "").trim();
  const chainId = Number(value?.chainId);
  const nonce = Number(value?.nonce);
  if (!RAW_TRANSACTION_PATTERN.test(rawTransaction)) throw new Error("iota_raw_transaction_invalid");
  if (!TX_HASH_PATTERN.test(txHash)) throw new Error("iota_tx_hash_invalid");
  if (!/^0x[0-9a-f]{40}$/i.test(signerAddress)) throw new Error("iota_signer_address_invalid");
  if (!Number.isSafeInteger(chainId) || chainId <= 0) throw new Error("iota_chain_id_invalid");
  if (!Number.isSafeInteger(nonce) || nonce < 0) throw new Error("iota_nonce_invalid");
  return { rawTransaction, txHash, signerAddress, chainId, nonce };
}

/**
 * Durable outbox boundary for an IOTA EVM transaction.
 *
 * The exact signed bytes are committed before the first RPC broadcast. If the
 * process dies after the RPC accepted the transaction, a later lease holder
 * rebroadcasts those same bytes and hash; it never asks the signer again.
 */
export async function runDurableIotaBroadcast(input, dependencies) {
  const {
    reservation,
    proofId,
    leaseToken,
    createSigned,
    buildResponse,
  } = input;
  const {
    persistSigned,
    persistBroadcast,
    persistSubmitted,
    broadcast,
    lookup,
  } = dependencies;

  let signed;
  if (reservation.recover) {
    signed = signedEnvelope({
      rawTransaction: reservation.rawTransaction,
      txHash: reservation.txHash,
      signerAddress: reservation.signerAddress,
      chainId: reservation.chainId,
      nonce: reservation.nonce,
    });
  } else {
    signed = signedEnvelope(await createSigned());
    await persistSigned(proofId, leaseToken, signed);
  }

  let transaction;
  let recoveredAfterBroadcastError = false;
  try {
    transaction = await broadcast(signed.rawTransaction);
  } catch (broadcastError) {
    let observed = null;
    try {
      observed = await lookup(signed.txHash);
    } catch {
      observed = null;
    }
    if (!observed) throw broadcastError;
    transaction = { hash: signed.txHash, nonce: signed.nonce };
    recoveredAfterBroadcastError = true;
  }

  if (String(transaction?.hash || "").toLowerCase() !== signed.txHash) {
    throw new Error("iota_broadcast_tx_hash_mismatch");
  }
  if (Number(transaction?.nonce) !== signed.nonce) throw new Error("iota_broadcast_nonce_mismatch");

  if (reservation.state !== "submitted") {
    await persistBroadcast(proofId, leaseToken, signed.txHash);
  }
  const response = buildResponse({
    ...signed,
    transaction,
    recoveredAfterBroadcastError,
  });
  await persistSubmitted(proofId, leaseToken, response);
  return response;
}

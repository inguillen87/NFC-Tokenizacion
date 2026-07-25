import { getAddress } from "ethers";

const MAX_UINT256 = (1n << 256n) - 1n;

function canonicalAddress(value, errorCode) {
  try {
    return getAddress(String(value || ""));
  } catch {
    throw new Error(errorCode);
  }
}

function canonicalTokenId(value) {
  try {
    const tokenId = BigInt(String(value));
    if (tokenId < 0n || tokenId > MAX_UINT256) throw new Error("out_of_range");
    return tokenId.toString();
  } catch {
    throw new Error("polygon_existing_token_id_invalid");
  }
}

/**
 * Reconciles an already-bound chip against immutable mint metadata plus the
 * current ERC-721 owner. Returning success for anything less exact could make
 * a retry acknowledge an asset minted for a different request.
 */
export async function reconcileExistingPolygonMint({
  contract,
  contractAddress,
  recipient,
  chipUidHash,
  tokenUri,
  assetRef,
  requestId = null,
  network = "polygon-amoy",
}) {
  let tokenId;
  try {
    tokenId = canonicalTokenId(await contract.tokenByChipHash(chipUidHash));
  } catch (error) {
    if (error instanceof Error && error.message === "polygon_existing_token_id_invalid") throw error;
    throw new Error("polygon_existing_binding_lookup_failed");
  }
  if (tokenId === "0") return null;

  let actualChipUidHash;
  let actualRecipient;
  let actualTokenUri;
  let actualAssetRef;
  try {
    [actualChipUidHash, actualRecipient, actualTokenUri, actualAssetRef] = await Promise.all([
      contract.chipUidHashByTokenId(tokenId),
      contract.ownerOf(tokenId),
      contract.tokenURI(tokenId),
      contract.assetRefByTokenId(tokenId),
    ]);
  } catch {
    throw new Error("polygon_existing_binding_unverifiable");
  }

  const expectedContract = canonicalAddress(contractAddress, "polygon_contract_address_invalid");
  const expectedRecipient = canonicalAddress(recipient, "polygon_recipient_invalid");
  const actualOwner = canonicalAddress(actualRecipient, "polygon_existing_binding_unverifiable");
  const exactMatch = String(actualChipUidHash) === String(chipUidHash)
    && actualOwner === expectedRecipient
    && String(actualTokenUri) === String(tokenUri)
    && String(actualAssetRef) === String(assetRef);
  if (!exactMatch) throw new Error("polygon_existing_binding_mismatch");

  return {
    ok: true,
    network,
    tx_hash: null,
    token_id: tokenId,
    chip_uid_hash: String(chipUidHash),
    external_ref: `amoy:${expectedContract}:${tokenId}`,
    request_id: requestId || null,
    already_minted: true,
    reconciled: true,
    evidence_source: "on_chain_state",
    binding: {
      contract_address: expectedContract,
      recipient: expectedRecipient,
      chip_uid_hash: String(chipUidHash),
      token_uri: String(tokenUri),
      asset_ref: String(assetRef),
    },
  };
}

/**
 * Checks chain state before the signer boundary and checks it again after an
 * ambiguous submit error. The second lookup permits safe recovery when the
 * transaction landed but the RPC response or database update was lost.
 */
export async function runPolygonMintIdempotently({ inspect, submit }) {
  const existing = await inspect();
  if (existing) return existing;

  try {
    return await submit();
  } catch (submitError) {
    const reconciled = await inspect();
    if (reconciled) {
      return { ...reconciled, recovered_after_submit_error: true };
    }
    throw submitError;
  }
}

/**
 * Serializes Polygon submissions inside one executor instance. This prevents
 * local requests from selecting the same pending nonce. The contract remains
 * the cross-instance uniqueness boundary.
 */
export function createPolygonMintQueue() {
  let tail = Promise.resolve();
  return (operation) => {
    const pending = tail.then(operation, operation);
    tail = pending.then(() => undefined, () => undefined);
    return pending;
  };
}

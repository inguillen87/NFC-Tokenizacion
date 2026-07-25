# Polygon KMS executor canary evidence

Date: 2026-07-25 UTC  
Environment: staging executor connected to the production API and Polygon Amoy only  
Physical NFC impact: none

## Isolation invariant

This canary used a temporary tenant, a random 32-byte synthetic UID, no batch,
no `tags` row, no SUN event, and no `K_META` or `K_FILE`. The existing NTAG 424
samples remain on the legacy Vercel/Neon validation path protected by
`KMS_MASTER_KEY_HEX`; Google KMS is not wired into NFC validation.

## Runtime under test

- Vercel API deployment: `dpl_FKimCRBUWdVpnzWZ754BJVmaMSfq`
- Cloud Run revision: `nexid-chain-executor-stg-kms-idem-2209`
- Executor image digest: `sha256:85869b5cc20952a2f96257bb7c850db7c52728a2baf287de91cf8ffebe8927b3`
- Signer mode: `kms_wrapped`
- KMS key: `polygon-wallet-wrap-pilot`
- Chain: Polygon Amoy, chain ID `80002`
- Contract: `0x673CAE3D79f825bba9cfb2096184c295A5C9Eb4C`

## Directed one-shot canary

- Request ID: `c4a9ac73-6452-4e32-b093-2207c716bd7a`
- Synthetic BID: `CANARY-API-KMS-20260725011408-76996cdb`
- Recipient: `0x000000000000000000000000000000000000dEaD`
- Result: `anchored`, `attempt_count=1`, `evidence_verified=true`
- Token ID: `23`
- Block: `43123671`
- Transaction: [Amoy explorer](https://amoy.polygonscan.com/tx/0xefd473649e4bce09cf6a7a9c13c4773c60bfb645dcee3101f7b240f22c0e3fa9)
- Public asset ID: `nx-ad6e05de03b3ca7bb2c5a8be`
- Metadata: `https://api.nexid.lat/public/polygon/assets/nx-ad6e05de03b3ca7bb2c5a8be`

Independent verification passed for receipt status, target contract, minter,
ERC-721 `Transfer`, `DigitalTwinMinted`, `tokenByChipHash`,
`chipUidHashByTokenId`, `ownerOf`, `tokenURI`, `assetRefByTokenId`, and the
public metadata document.

Cloud Run request logs recorded one authorized `POST /mint` with HTTP 200 in
4.74 seconds. Cloud Audit Logs recorded one `Decrypt` by
`nexid-chain-executor-stg@nexid-security-staging.iam.gserviceaccount.com` on
`polygon-wallet-wrap-pilot`.

## Live retry proof

The exact same intent was submitted once more directly to the executor after
confirmation. The executor returned:

- `token_id=23`
- `tx_hash=null`
- `already_minted=true`
- `reconciled=true`
- `evidence_source=on_chain_state`

The replay completed with HTTP 200 in 0.61 seconds. No KMS audit event occurred
after the replay, proving that the preflight returned before wallet decrypt,
signing, or transaction submission.

## Operational notes

- The first HTTP client result was ambiguous while the chain and database
  completed successfully. No retry was issued through the API.
- The local development `TOKENIZATION_UID_SALT` is not authoritative for
  production and differed from the Vercel production secret. Production
  evidence was therefore verified through emitted events, contract getters,
  the synthetic BID, and public metadata without reading or exposing the
  production salt.
- The temporary database rows were removed after evidence capture. Token 23
  remains permanently on Amoy because the pilot contract has no burn method.
- This proves the managed-KMS envelope custody pilot. It is not a claim of HSM
  or non-exportable direct signing: the wallet key exists briefly in Cloud Run
  memory while signing.


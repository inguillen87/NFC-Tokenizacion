# nexID tokenization executor

Small backend-only service that receives tokenization jobs from the main API, signs Polygon Amoy mints, and publishes IOTA Evidence Anchor V2 receipts outside `api.nexid.lat`.

## Why it exists

The main API should validate SUN/NTAG 424 DNA TT, replay, tamper and business rules. It should not need to hold the blockchain minter private key. The executor owns that responsibility behind an internal secret.

Flow:

```txt
SUN tap -> API validation -> tokenization request -> executor -> Polygon Amoy tx -> tx_hash returned to API
```

The IOTA proof flow uses a separate secret and endpoint:

```txt
Evidence events -> API reserves proofId -> executor /anchor-evidence -> IOTA tx hash -> API reconciler verifies receipt, calldata, event and storage
```

## Local Amoy pilot

```powershell
cd C:\Users\guill\OneDrive\Documentos\GitHub\NFC-Tokenizacion\apps\executor
copy .env.example .env
npm run dev
```

Then configure API:

```txt
TOKENIZATION_MODE=polygon
TOKENIZATION_USE_LOCAL_MINTER=false
TOKENIZATION_EXECUTOR_URL=http://localhost:3010/mint
TOKENIZATION_EXECUTOR_SECRET=<same secret as executor>
SUN_AUTO_TOKENIZE_ON_VALID_TAP=true
TOKENIZATION_UID_SALT=<same salt as executor>
```

The executor keeps:

```txt
POLYGON_RPC_URL=...
POLYGON_MINTER_PRIVATE_KEY=...
POLYGON_MINTER_ADDRESS=...
POLYGON_CONTRACT_ADDRESS=...
POLYGON_DEFAULT_RECIPIENT=...
```

The API sends `chip_uid_hash`, `token_uri` and `asset_ref`. The executor does not need `K_META`, `K_FILE`, `KMS_MASTER_KEY_HEX`, or the raw UID for normal operation.

## Production direction

For the Amoy pilot, `EXECUTOR_SIGNER_MODE=private_key` is enough if the wallet is dedicated and only has testnet gas.

For premium production, keep the same HTTP contract but replace the signer internals with provider KMS/HSM:

- AWS KMS secp256k1 key or a custody provider.
- GCP/Azure/HSM equivalent if secp256k1 signing is available.
- Secret manager for `TOKENIZATION_EXECUTOR_SECRET`.
- Network allowlist so only the API can call the executor.
- No private key in Vercel API.

The main API already supports this via `TOKENIZATION_EXECUTOR_URL` and `TOKENIZATION_EXECUTOR_SECRET`.

## IOTA Evidence Anchor V2

Configure the executor:

```txt
IOTA_PROOF_EXECUTOR_SECRET=<dedicated random secret>
IOTA_EXECUTOR_SIGNER_MODE=private_key
IOTA_EVM_RPC_URL=https://json-rpc.evm.testnet.iota.cafe
IOTA_EVM_EXPECTED_CHAIN_ID=1076
IOTA_EVM_ANCHOR_CONTRACT_V2=<NexidEvidenceAnchor V2>
IOTA_EVM_PRIVATE_KEY=<dedicated authorized publisher testnet key>
```

Configure the API without an IOTA private key:

```txt
IOTA_PROVIDER_MODE=iota_evm_contract_v2
IOTA_EVM_RPC_URL=https://json-rpc.evm.testnet.iota.cafe
IOTA_EVM_EXPECTED_CHAIN_ID=1076
IOTA_EVM_ANCHOR_CONTRACT_V2=<same contract>
IOTA_PROOF_EXECUTOR_URL=https://<private-executor>/anchor-evidence
IOTA_PROOF_EXECUTOR_SECRET=<same dedicated secret>
INTERNAL_PROOF_ANCHOR_KEY=<separate worker secret>
```

The executor validates chain ID, contract bytecode/version, publisher authorization and the contract-computed `proofId` before broadcast. It returns `202 submitted` immediately after broadcast so the API can persist `tx_hash` before waiting for confirmations. The API worker then verifies the receipt, exact calldata, `EvidenceAnchored` event and contract storage. New writes are V2-only; `IOTA_EVM_ANCHOR_CONTRACT` remains read-only for historical V1 proofs.

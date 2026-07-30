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
```

The executor keeps:

```txt
EXECUTOR_CAPABILITIES=polygon
EXECUTOR_SIGNER_MODE=kms_wrapped
NEXID_KMS_ENVIRONMENT=staging
KMS_DECRYPT_TIMEOUT_MS=10000
POLYGON_RPC_URL=...
POLYGON_EXPECTED_CHAIN_ID=80002
POLYGON_KMS_WRAP_KEY_RESOURCE=projects/.../cryptoKeys/polygon-wallet-wrap-pilot
POLYGON_KMS_WRAPPED_PRIVATE_KEY=<base64 ciphertext>
POLYGON_KMS_PUBLISHER_ADDRESS=...
POLYGON_MINTER_ADDRESS=...
POLYGON_CONTRACT_ADDRESS=...
DATABASE_URL=postgresql://<dedicated-executor-role>:...@.../nexid?sslmode=require
```

The API sends a canonical, DB-bound intent containing `request_id`, `tenant_id`,
`lease_id`, `network`, `execution_class`, `commercial_disposition`,
`issuer_wallet`, `chip_uid_hash`, `token_uri`, `asset_ref`, and `intent_digest`.
The bearer authenticates the calling service but never authorizes a mint by
itself. Before any signing, the executor locks the exact
`tokenization_requests` row and consumes its unexpired processing lease by
writing `meta.dispatch_started_at`. The first exact lease/digest may dispatch;
the same lease/digest later is inspection-only reconciliation and can never
submit a second transaction. A different body, lease, tenant, expired lease,
missing database, or unavailable database fails closed.

The digest is lowercase SHA-256 hex of UTF-8 `JSON.stringify` over this exact
array, with IDs/network/class/wallet/chip hash lowercase and commercial
disposition uppercase:

```txt
["nexid-polygon-mint-intent-v1", request_id, tenant_id, lease_id,
 network, execution_class, commercial_disposition, issuer_wallet,
 chip_uid_hash, token_uri, asset_ref]
```

Use a dedicated PostgreSQL role. Its required data privileges are deliberately
limited to row reads and the one evidence column updated by the reservation:

```sql
GRANT SELECT ON public.tokenization_requests TO nexid_executor;
GRANT UPDATE (meta) ON public.tokenization_requests TO nexid_executor;
GRANT SELECT ON public.batches, public.tags, public.events,
  public.supplier_sub_batches, public.supplier_orders,
  public.supplier_pack_purpose_decisions TO nexid_executor;
GRANT EXECUTE ON FUNCTION public.nexid_effective_supplier_pack_purpose_v1(uuid)
  TO nexid_executor;
GRANT EXECUTE ON FUNCTION public.nexid_assert_supplier_order_commercial_release_v1(uuid)
  TO nexid_executor;
GRANT EXECUTE ON FUNCTION public.nexid_assert_supplier_commercial_release_v1(uuid)
  TO nexid_executor;
```

Those read/execute grants are required because the existing
`nexid_tokenization_execution_scope_guard_v1` trigger re-proves batch, tag,
verified SUN event, and supplier-purpose scope when `meta` is updated. `/ready`
checks these dependencies as well as the column-scoped write privilege.

The executor does not need `K_META`, `K_FILE`, `KMS_MASTER_KEY_HEX`, or the raw
UID for normal operation. `KMS_MASTER_KEY_HEX` is the API's batch/NFC encryption
key and must never be configured as `IOTA_KMS_KEY_ID`; blockchain signing always
uses a separate signer identity. In `kms` mode that identity is a remote signer,
but readiness deliberately reports its HSM and exportability status as
unattested unless independently proven. The current testnet pilot uses the
`kms_wrapped` software-envelope boundary described below.

## Production direction

For the Amoy/IOTA testnet pilot, `kms_wrapped` uses separate Google Cloud KMS
software envelope keys. The deployed service receives ciphertext, its service
account can only decrypt the corresponding key, and plaintext exists only in
memory while signing. The KMS request includes CRC32C for ciphertext and AAD,
the response CRC32C is verified before the key is parsed, and decrypt calls use
the bounded `KMS_DECRYPT_TIMEOUT_MS` deadline. This is real KMS envelope
encryption, not non-exportable HSM signing.

`POLYGON_EXPECTED_CHAIN_ID` is checked against the live RPC before any signing
or KMS decrypt. `EXECUTOR_CAPABILITIES` scopes readiness and routes per chain;
when omitted both routes remain available for backwards compatibility. A
Polygon-only Cloud Run revision should set `EXECUTOR_CAPABILITIES=polygon`, so
missing IOTA configuration does not make `/ready` fail. `/ready` returns
per-chain results under `chains` and fails unless every declared capability is
fully configured. For IOTA, readiness also opens the configured PostgreSQL
connection and verifies the durable publication table's required columns,
validated constraints, valid indexes, and `SELECT`/`INSERT`/`UPDATE` privileges.
Probe results are cached for five seconds to avoid a database query per health
poll; failures return only stable reason codes and boolean checks.

Polygon minting is idempotent at the executor boundary. Before loading a
signer, the executor reads `tokenByChipHash`; an existing token is accepted only
when `chipUidHashByTokenId`, current `ownerOf`, `tokenURI`, and
`assetRefByTokenId` exactly match the request. An exact replay returns canonical
contract/token evidence without another KMS decrypt, signature, or transaction.
Any mismatch fails closed. A broadcast/receipt error triggers the same exact
reconciliation once, which recovers transactions that landed despite an
ambiguous RPC response. Mints are serialized per process to avoid local nonce
reuse; the contract's `ChipAlreadyBound` rule remains the cross-instance
uniqueness boundary.

The server binds `0.0.0.0` for Cloud Run. On `SIGTERM` or `SIGINT` it enters
drain mode, rejects new application requests with `503 executor_draining`, and
waits for in-flight HTTP work via `server.close()` without forcing
`process.exit()`.

`private_key` remains a development-only compatibility mode. The executor now
rejects it in a production runtime and for every `live_chain` intent before DB
authorization or RPC access. It is not allowed for production customer assets; see
`docs/enterprise-hardening/2026-07-24/cost-and-custody-stages.md`.

For premium production, keep the same HTTP contract but replace the signer internals with direct provider KMS/HSM or custody signing:

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

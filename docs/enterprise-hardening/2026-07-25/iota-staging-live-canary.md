# IOTA staging live canary

`scripts/iota-staging-live-canary.mjs` performs one intentional IOTA EVM
testnet write using synthetic, non-customer evidence. It is a staging release
gate, not a load test and not a reusable customer fixture.

## What the gate proves

1. Cloud Run reports both service and IOTA durable-store readiness.
2. The deployed contract is bytecode-backed, schema V2, and authorizes the
   executor publisher.
3. The proof ID comes from the deployed contract's `computeProofId` read.
4. A fresh request returns one submitted transaction.
5. Replaying the exact same request returns the same response, transaction hash,
   and nonce.
6. The receipt succeeded and contains exactly one matching
   `EvidenceAnchored` event.
7. `isAnchored` and `evidenceRecord` contain the exact synthetic inputs.
8. PostgreSQL contains exactly one protocol-V2 publication row bound to the
   same proof, request, transaction, signer, chain, and nonce.
9. The publisher account nonce advances by exactly one across submit + replay,
   detecting an accidental second send even if that second transaction reverted.

The script refuses command-line arguments. `SERVICE_URL`,
`IOTA_PROOF_EXECUTOR_SECRET`, and `DATABASE_URL` are accepted only from the
process environment. It never logs those values or raw unexpected errors.

## Authorized staging execution

Run this from the repository root. PowerShell captures Secret Manager values
directly into process environment variables; the commands do not echo them.

```powershell
$ErrorActionPreference = "Stop"
$env:SERVICE_URL = (gcloud run services describe nexid-iota-executor-stg --region=us-east1 --project=nexid-security-staging --format="value(status.url)").Trim()
$env:IOTA_PROOF_EXECUTOR_SECRET = (gcloud secrets versions access 1 --secret=nexid-iota-executor-auth-stg --project=nexid-security-staging).Trim()
$env:DATABASE_URL = (gcloud secrets versions access 3 --secret=nexid-iota-db-url-stg --project=nexid-security-staging).Trim()

node .\scripts\iota-staging-live-canary.mjs
$canaryExitCode = $LASTEXITCODE

Remove-Item Env:SERVICE_URL -ErrorAction SilentlyContinue
Remove-Item Env:IOTA_PROOF_EXECUTOR_SECRET -ErrorAction SilentlyContinue
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
exit $canaryExitCode
```

Optional non-secret overrides are `IOTA_EVM_RPC_URL`,
`IOTA_EVM_EXPECTED_CHAIN_ID`, and `IOTA_EVM_ANCHOR_CONTRACT_V2`. The defaults
target IOTA EVM testnet chain `1076`; the contract address is discovered from
the deployed executor and may be pinned through the override for an additional
configuration equality check.

Every successful invocation creates one permanent testnet anchor and one
durable staging row. Do not run it repeatedly as a health probe.

## Executed evidence

Executed once on 2026-07-26 against the allowlisted staging executor.

- Chain: `1076` (IOTA EVM testnet)
- Contract: `0xde7284812D0c81080Cc7B2f60d6D9769343Aa2B0`
- Publisher: `0xE3B44ef8638D09B366DE35189C4992A51511D9C8`
- Proof: `0x61129fd4aa3f07769e49bf6b2bec825f66617f9e86ecbd5488bc249c35ffac45`
- Transaction: `0x6bfe117e052212d4ed3b86e6383449039dc492de70e156e53abde02c8ea780fb`
- Block: `137295`
- Nonce: `0`

All nine checks passed: readiness, contract-derived proof ID, fresh submission,
byte-identical replay, same transaction and nonce, successful receipt, exactly
one matching event, matching contract storage, exactly one durable publication,
and a publisher nonce increase of exactly one.

After this gate passed, the legacy Polygon executor lost decrypt access to the
IOTA wrapping key and database-secret version `2` (owner connection) was
disabled. Version `3`, containing the restricted executor-role connection,
remains enabled. `/ready` stayed green after both removals.

## Production API integration evidence

The API deployment promoted on 2026-07-26 has Production-only encrypted
configuration for the HTTPS executor URL, executor credential, bounded timeout,
and `IOTA_PROVIDER_MODE=iota_evm_contract_v2`. The existing NFC
`KMS_MASTER_KEY_HEX` was not modified.

A read-only request through `api.nexid.lat/public/proof/demo-cases` returned:

- mode `iota_evm_contract_v2`;
- contract version `evidence_anchor_v2`;
- RPC and contract configured;
- all three public demo anchors and all three receipts verified from RPC;
- no raw IOTA signer environment variable;
- Polygon Amoy RPC verification still confirmed with no raw Polygon signer
  environment variable.

This connects the production API to the isolated **testnet** custody/executor
path. It does not change its classification to mainnet, direct KMS signing, or
HSM custody, and the live write canary was not repeated during this rollout.

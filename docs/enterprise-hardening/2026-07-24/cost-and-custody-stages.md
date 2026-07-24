# Custody and cost stages

| Stage | Custody | Allowed network | Expected cost | Enterprise claim |
|---|---|---|---:|---|
| Pilot | Dedicated private keys in executor-only secret store (Vercel/hosting env) | Polygon Amoy + IOTA testnet | $0 platform KMS; testnet gas only | Not HSM/KMS; no production customer assets |
| Staging | Google Cloud KMS Software, two non-exportable secp256k1 keys | Testnets | Free Trial/free-tier eligible; billing account required | KMS-backed staging, not HSM |
| Production | Google Cloud KMS HSM or equivalent custody provider | Mainnets | KMS/HSM/provider + gas + signer service | Enterprise custody after live drills and audit |

## Pilot rules

- `EXECUTOR_SIGNER_MODE=private_key` is permitted only for a dedicated testnet
  wallet and only in the executor process.
- Never put `POLYGON_MINTER_PRIVATE_KEY` or `IOTA_EVM_PRIVATE_KEY` in the API,
  browser, SDK, logs or R2.
- Production runtime rejects exportable Polygon signing and the enterprise
  gate remains red until both KMS signers are live.
- Rotate/delete pilot keys before any mainnet or customer-asset use.

This lets Nexid onboard demos and validate SDK/webhooks now while preserving a
clean migration path to non-exportable KMS/HSM custody.

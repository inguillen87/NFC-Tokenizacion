# Custody and cost stages

> **HISTORICAL DESIGN MATRIX - NOT CURRENT RUNTIME EVIDENCE.** The deployed
> testnet runtime verified on 2026-07-26 uses isolated executors with
> `kms_wrapped` wallet envelopes protected by Google Cloud KMS `SOFTWARE`.
> Wallet plaintext exists ephemerally in executor memory while signing. This is
> not Cloud HSM, direct asymmetric KMS signing or a non-exportable workload key.
> Direct non-exportable/HSM custody remains a future mainnet or contractual
> promotion gate. See
> [`enterprise-product-experience-sprint.md`](../2026-07-26/enterprise-product-experience-sprint.md).

| Stage | Custody | Allowed network | Expected cost | Enterprise claim |
|---|---|---|---:|---|
| Pilot | Dedicated private keys in executor-only secret store (Vercel/hosting env) | Polygon Amoy + IOTA testnet | $0 platform KMS; testnet gas only | Not HSM/KMS; no production customer assets |
| Current testnet runtime (verified 2026-07-26) | Separate `kms_wrapped` wallets under Google Cloud KMS `SOFTWARE`; plaintext is transient in executor memory | Polygon Amoy + IOTA testnet | KMS software key versions + low-volume operations + executor | KMS-wrapped pilot custody; not HSM and not direct non-exportable signing |
| Future production target | Direct non-exportable KMS/HSM or equivalent validated custody provider | Mainnets only after promotion gates | Custody provider + gas + signer service | Enterprise custody only after live drills, audit and contractual approval |

## Pilot rules

- `EXECUTOR_SIGNER_MODE=private_key` is permitted only for a dedicated testnet
  wallet and only in the executor process.
- Never put `POLYGON_MINTER_PRIVATE_KEY` or `IOTA_EVM_PRIVATE_KEY` in the API,
  browser, SDK, logs or R2.
- Production API rejects exportable local Polygon signing. The deployed testnet
  executors use `kms_wrapped`; mainnet remains blocked until the selected direct
  non-exportable/HSM custody path and all production gates are verified.
- Rotate/delete pilot keys before any mainnet or customer-asset use.

This historical staging plan has been superseded by the verified
`kms_wrapped` testnet runtime while preserving a migration path to direct
non-exportable KMS/HSM custody when mainnet or a customer contract requires it.

# Nexid enterprise key custody and edge architecture

## Current and target custody boundaries

The existing Vercel `KMS_MASTER_KEY_HEX` remains dedicated to NFC/batch-key envelope encryption. Despite its legacy name, a secret stored as a Vercel environment variable is not by itself a managed KMS or HSM and does not attest non-exportability. It must not be reused for blockchain transaction signing.

The current blockchain pilot mode is `kms_wrapped`: Google Cloud KMS with the `SOFTWARE` protection level unwraps an encrypted wallet inside the isolated executor, and wallet plaintext exists ephemerally in executor memory while a transaction is signed. Ciphertext can be persisted; plaintext must never be logged or returned. This is stronger than storing the wallet plaintext in an application environment variable, but it is not direct KMS signing, a non-exportable workload key or HSM custody.

The production API rejects the legacy exportable Polygon private-key signer. Polygon minting can use the durable executor/intention path; the local-key path remains limited to non-production development or an isolated testnet environment. ERC-721 transfer is not implemented in the executor and no production caller currently invokes a safe transfer coordinator. Ownership claims therefore remain database records/requests and must never be described as an on-chain transfer. Transfer promotion requires an executor allowlist, caller, durable idempotency, a chain receipt and an `ownerOf` verification.

Target architecture:

```text
Vercel API  ->  outbox/idempotency  ->  executor policy  ->  direct remote signer
    |                                      |                       |
 PostgreSQL                   chain/contract allowlists       IOTA/Polygon RPCs
    |
 Cloudflare WAF + rate limits at every public zone
```

The target signer keeps the secp256k1 private key outside application memory and enforces chain ID, contract/method/value allowlists, nonce policy, idempotency and controlled key rotation. It may use managed KMS, HSM or institutional custody, but Nexid must label it `HSM-backed` or `non-exportable` only after the provider protection level and runtime behavior are independently verified. Google Cloud KMS or another custody product can implement the existing executor signer contract after confirming secp256k1 support and Ethereum-compatible digest/signature semantics for the selected service and region.

## Cloudflare

Deploy `infra/waf/cloudflare-enterprise-rules.json` through the Cloudflare Rulesets API or Terraform after substituting the real zone IDs. Keep the rules versioned and run `npm run check:waf:policy` in CI. Rate-limit keys must use Cloudflare-supported characteristics (for example `cf.colo.id`, IP, and a non-secret API-key identifier); never use caller-controlled tenant headers as the sole security boundary.

Required zones/hostnames:

- `api.nexid.lat`: authenticated API, proof writes, webhook ingestion.
- `app.nexid.lat` (or the current dashboard hostname): dashboard and browser traffic.
- `verify.nexid.lat` (optional): public proof verification with stricter abuse limits.

Namecheap should remain the registrar/DNS authority only where required; authoritative DNS and edge policy should be managed in Cloudflare, with DNSSEC enabled and registrar lock/2FA enabled at Namecheap.

### Current plan decision

Cloudflare Free is useful for DNS, TLS, baseline WAF and the simplest edge rules, but it is not sufficient evidence for Nexid's fleet-wide authenticated rate-limit policy. The current Free-zone baseline is deployed and smoke-tested; Neon-backed tenant/subject limits remain authoritative. Paid-plan changes still require Rulesets API schema validation and rollback evidence.

Google Cloud KMS is the preferred low-cost signer path once billing is enabled: it supports `EC_SIGN_SECP256K1_SHA256`, but KMS is not a permanently free service. The published free allowance applies to Autokey-created keys and 10,000 cryptographic operations/month; billing registration is still required. A dedicated Nexid GCP project should be used, never the existing auth project.

## Promotion gates

1. Apply the complete ordered migration set through the latest reviewed migration, currently `0061_supplier_export_artifact_delivery`, only to the explicitly approved database, then run the release preflight and postchecks.
2. Provision signer key and policy; record public address and key version.
3. Configure Cloudflare rules and observe in log/simulation mode before blocking.
4. Run PostgreSQL, IOTA live-read, proof, webhook, and executor readiness gates.
5. Keep Polygon transfer/marketplace settlement disabled until the executor transfer gate above passes.
6. Promote with rollback owner, key-rotation drill, and incident runbook.
## Free/staging boundary

Cloudflare R2 encryption-at-rest and Workers Secrets are suitable for encrypted
artifacts, edge configuration and scheduler credentials, but they are not the
custody boundary for Polygon/IOTA signing keys. Staging uses the declarative
Google Cloud KMS Software plan in `infra/kms/google-staging`; production can
promote the same signer contract to HSM protection without changing the
executor's transaction-intent verification.

## SDK replay-key rotation

SDK response replay uses a separate application-level AES-GCM keyring, not the
blockchain signer or NFC batch-key hierarchy. Every new envelope carries a key
ID. On rotation, keep the previous SDK idempotency key configured for at least
the full seven-day replay TTL plus deployment overlap; the release preflight
validates the active key and every optional previous-key entry without printing
their values. Removal before the TTL expires requires an audited rewrap job or
explicit acceptance that retained operations can no longer be replayed.

# Nexid enterprise key custody and edge architecture

## Separate trust domains

The existing Vercel `KMS_MASTER_KEY_HEX` remains dedicated to NFC/batch-key encryption. It must not be reused for blockchain transaction signing.

Blockchain signing uses a separate non-exportable secp256k1 key in a managed KMS/HSM or institutional custody provider. The API and Vercel workloads submit an authenticated signing intent to the signer service; they never receive the private key. The signer enforces chain ID, contract allowlist, method/value limits, nonce policy, idempotency, and dual-control approval for production key changes.

The production API rejects the legacy exportable Polygon private-key signer. Polygon mint and transfer must use the same durable executor/intention path as IOTA; the local key path remains only for non-production development or an isolated testnet environment.

```text
Vercel API  ->  outbox/idempotency  ->  signer service (KMS/HSM/custody)
    |                                      |
 PostgreSQL                         IOTA/Polygon RPCs
    |
 Cloudflare WAF + rate limits at every public zone
```

The first production implementation should use Google Cloud KMS `EC_SIGN_SECP256K1_SHA256` or an equivalent custody product, with a small adapter implementing the existing executor signer protocol. AWS/Azure are valid alternatives only after confirming secp256k1 support and Ethereum-compatible digest/signature semantics in the selected region/service.

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

1. Apply database migrations 0050-0054 only to the explicitly approved staging database.
2. Provision signer key and policy; record public address and key version.
3. Configure Cloudflare rules and observe in log/simulation mode before blocking.
4. Run PostgreSQL, IOTA live-read, proof, webhook, and executor readiness gates.
5. Promote with rollback owner, key-rotation drill, and incident runbook.
## Free/staging boundary

Cloudflare R2 encryption-at-rest and Workers Secrets are suitable for encrypted
artifacts, edge configuration and scheduler credentials, but they are not the
custody boundary for Polygon/IOTA signing keys. Staging uses the declarative
Google Cloud KMS Software plan in `infra/kms/google-staging`; production can
promote the same signer contract to HSM protection without changing the
executor's transaction-intent verification.

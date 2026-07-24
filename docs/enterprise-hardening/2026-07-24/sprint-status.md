# Nexid enterprise hardening sprint status — 2026-07-24

## Delivered in this sprint

- Cloudflare DNSSEC active at registrar and authoritative zone.
- Cloudflare Full (strict), Always Use HTTPS, minimum TLS 1.2 and TLS 1.3 enabled.
- Free-plan WAF custom rule blocks secret/SCM probes; live 403 smoke tests pass.
- Free-plan auth rate rule blocks after 10 POSTs/10 seconds per source IP; live 429 smoke test passes.
- Exposed broad user token revoked; no replacement secret is stored in the repository.
- KMS signer responses are parsed and locally verified before broadcast; forged or malformed raw transactions fail closed.
- IOTA durable idempotency replays terminal responses and reclaims only stale processing leases.
- Webhook v1 signatures include timestamp, delivery ID, event ID, key ID and exact raw body; weak/missing secrets fail closed.
- Consumer demo bypass is prohibited in production; production migration workflow is manual and environment-protected.
- Exportable Polygon private-key signing is rejected in production until Polygon is routed through the durable KMS executor.
- Cloudflare Cron Worker scheduler is versioned under `infra/cloudflare/webhook-recovery-worker`; it is fail-closed and intentionally not deployed without the origin secret.
- The enterprise gate now requires independent IOTA and Polygon KMS URL, key ID, allowlist, publisher/token evidence; configuration alone is not treated as a live signing test.

## Next promotion blockers

1. Provision a dedicated non-exportable Polygon KMS key and signer service, then run the executor against it in staging.
2. Apply migrations 0050–0055 in staging; the live preflight currently reports all six missing plus `admin_login_attempt_buckets`.
3. Make business mutation and webhook outbox insertion one database transaction; deploy and monitor the prepared versioned scheduler.
3. Authenticate the Vercel origin so direct `*.vercel.app` access cannot bypass the Cloudflare edge.
4. Migrate NFC ciphertext to versioned AAD/key IDs with dual-read and rewrap evidence.
5. Run two-process crash/concurrency tests, restore drill, key-rotation drill and staging-to-production approval gates.

Cloudflare Secrets Store is intentionally not described as KMS/HSM. A production blockchain key must be non-exportable secp256k1 custody (for example Google Cloud KMS or an equivalent validated provider), separated from the NFC KEK and webhook encryption keys.

## External provisioning evidence

The currently authenticated GCP project is `obrasaas-production`, and its
billing status is disabled. No KMS key or signing service was provisioned in
that project. Creating the Nexid signer requires a dedicated project and an
approved billing account; until then the KMS gate must remain red.

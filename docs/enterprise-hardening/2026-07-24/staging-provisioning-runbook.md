# Staging promotion runbook

This is the only supported path from the current red enterprise gate to a
staging green gate. It deliberately does not run against production.

## 1. Database

Set `STAGING_DATABASE_URL` in the protected GitHub `staging` environment to a
dedicated Neon staging branch. Confirm the branch is disposable and that the
role can create tables in `public`. Run the workflow manually; it performs
preflight and a rollback-only dry-run before any migration workflow is allowed.

## 2. Blockchain custody

Use a dedicated, billed cloud project owned by Nexid. The current authenticated
inventory has no billing-enabled Nexid project: `nexid-auth-prod-20260703` and
`obrasaas-production` both report billing disabled. Do not reuse the unrelated
`fine-shell-3ht6f` project merely because it has billing enabled. Provision two
independent non-exportable secp256k1 keys:

- `nexid-iota-staging-signer`
- `nexid-polygon-staging-signer`

The signer service must accept an intent and return a raw signed transaction;
it must never return a private key. Configure the executor with separate URL,
key ID, host allowlist, bearer token and publisher address for each chain.
The executor verifies chain, destination, calldata, nonce, value, gas, fees,
type and recovered signer before broadcast.

## 3. Gate execution

Populate the protected staging secrets referenced by
`.github/workflows/enterprise-staging-gates.yml`, then run that workflow. A
green result requires PostgreSQL schema 0050–0055, both KMS configurations,
the IOTA V2 read-only contract check, WAF policy validation and all regression
suites. Any missing secret or live gate returns non-zero.

## 4. Webhook scheduler

Only after the API has the staging `INTERNAL_WEBHOOK_WORKER_KEY`, deploy
`infra/cloudflare/webhook-recovery-worker` with the same value stored as a
Cloudflare secret. Verify the Worker receives HTTP 200 and that an absent or
incorrect key receives HTTP 401 from the API.

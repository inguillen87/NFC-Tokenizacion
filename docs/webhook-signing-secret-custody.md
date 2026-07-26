# Webhook signing-secret custody

## Security invariant

`webhook_endpoints.signing_secret` is an application-layer ciphertext, never a
new plaintext write. The API encrypts with AES-256-GCM using a fresh 96-bit
nonce and stores a versioned `nexid:whsec:v1:` envelope. The authenticated data
is domain-separated and bound to the endpoint tenant, so copying a ciphertext
to another tenant fails authentication.

The dedicated `WEBHOOK_SIGNING_MASTER_KEY_HEX` must contain exactly 32 random
bytes encoded as 64 hexadecimal characters. It must not reuse
`KMS_MASTER_KEY_HEX`, the NFC batch keys, the internal worker credential, or a
rate-limit pepper. The plaintext exists only in process memory while validating
an admin change or signing an outbound delivery; API responses and migration
output never include it.

This is envelope-style application encryption backed by the hosting platform's
encrypted environment-variable store. It is not an HSM and must not be marketed
as hardware-backed or non-exportable key custody.

## Production rollout and plaintext migration

Do not deploy the code and migrate the database as one irreversible step.

1. Create a recoverable Neon branch/snapshot and record its identifier.
2. Generate one independent 32-byte key and provision it only as the encrypted
   server variable `WEBHOOK_SIGNING_MASTER_KEY_HEX`.
3. If plaintext rows exist, temporarily set
   `WEBHOOK_SIGNING_ALLOW_LEGACY_PLAINTEXT=true` and deploy the dual-read code.
4. From `apps/api`, audit without writes:

   ```powershell
   npm run webhooks:migrate-signing-secrets
   ```

5. Review only the reported counts, then apply once:

   ```powershell
   npm run webhooks:migrate-signing-secrets -- --apply
   ```

6. Rerun the dry-run. It must report `plaintext: 0`; a second `--apply` must
   report `updated: 0`.
7. Set `WEBHOOK_SIGNING_ALLOW_LEGACY_PLAINTEXT=false`, redeploy, create or rotate
   one test endpoint, and process one signed canary delivery.

The script requires `DATABASE_URL` and the dedicated master key. It takes a
transaction-scoped advisory lock, locks candidate rows, validates every existing
envelope, rolls back by default, and never prints row values, URLs, tenant IDs,
database credentials, keys, plaintext, or ciphertext.

## Failure behavior

- New POST/PATCH secret writes require the dedicated key in every environment.
- Production legacy reads require both a valid key and the explicit temporary
  allow flag. The secure default is denial.
- Missing/invalid keys, tenant-context mismatch, modified ciphertext, or a bad
  GCM tag stop signing; no unsigned webhook is sent.
- Key configuration failures are retryable in the durable outbox. Invalid
  ciphertext is terminal and reaches the existing dead-letter path.
- Existing endpoints remain on signature v1 until an administrator upgrades
  them. Newly created endpoints default to v2; the SDK verifier accepts both
  envelopes without falling back from a failed v2 verification.

## Signature-version migration

Signature v2 byte-length-frames and authenticates `x-nexid-key-id` in addition
to timestamp, delivery ID, event ID and the exact raw body. In legacy v1 the
key ID is routing metadata only and must never select a tenant secret across a
trust boundary. A successful SDK verification makes this explicit through
`keyIdAuthenticated: false` for v1 and `true` for v2.

Migration `0058` backfills existing endpoint rows to v1 before changing the
default to v2. This avoids silently invalidating deployed receivers. Upgrade a
receiver only after it accepts both versions, observe successful deliveries,
then set that endpoint to v2. Do not downgrade a failed v2 delivery to v1.

## Rotation and recovery

The v1 envelope is format-versioned but currently uses one active master key.
Before rotating it, take a database snapshot and implement/test an explicit
old-key-to-new-key rewrap window; replacing the key alone makes existing
ciphertexts unreadable. Keep the key in the platform secret store and a separate
restricted recovery system. Never place it in the repository, browser, logs, or
customer-facing documentation.

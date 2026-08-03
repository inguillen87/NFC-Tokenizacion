# Tenant SDK API-key lifecycle runbook

## Security contract

Migration `20260802113000_0077_tenant_api_key_lifecycle.sql` turns SDK API-key
administration into a database-owned lifecycle. The raw key is generated with
192 bits of CSPRNG entropy, returned once over the authenticated administration
response, and never persisted. `tenant_api_keys` stores only its SHA-256 digest
and a short display prefix. Every create, update, and revoke operation uses a
database writer that commits the key state and an append-only audit receipt in
the same transaction.

This is secret lifecycle hardening, not an HSM claim. API-key verification uses
a high-entropy bearer secret plus a one-way digest; no decryptable private key
is involved. The physical NFC SUN/SDM key path, per-batch ciphertext, counters,
CMAC verification, and blockchain signer custody are separate boundaries and
are not changed by `0077`.

## Invariants

- Tenant-bound administrators resolve exclusively to the authenticated
  principal's immutable tenant UUID. Caller-supplied slugs cannot select a
  different tenant.
- Mutations require `sdk:keys:write` or the current tenant-admin compatibility
  permission `tenant:write`, plus a verified MFA session, the critical write
  rate limit, a bounded JSON body, and strict fields/scopes. Removing that
  fallback requires first assigning dedicated SDK-key grants to existing
  tenant administrators so the rollout does not silently lock them out.
- Names, expiry and UUIDs are validated before SQL. Expiry must be in the future.
- Active-key quota is serialized with a tenant advisory transaction lock.
- Key ID, tenant ID, hash, prefix, creation time, expiry and metadata are
  immutable after creation. Revocation is terminal; physical deletion is
  forbidden.
- Ordinary authentication may advance only `last_used_at`; it cannot mutate
  lifecycle state or its audit timestamp.
- Lifecycle receipts contain actor, request metadata and non-secret state, but
  never the raw key or key hash. Receipts are append-only.
- Responses that list or reveal credential metadata use `Cache-Control:
  no-store`; the dashboard proxy must preserve that upstream directive.
- Production routes fail closed until the migration watermark and lifecycle
  capability are present.

## First production rollout

1. Run the read-only enterprise preflight against the exact approved database
   fingerprint and archive its sanitized result.
2. Apply the ordered migrations through `0078`; do not run request-path DDL.
3. Deploy the API and dashboard revisions together so `no-store` survives the
   proxy boundary.
4. With a controlled tenant, create one short-lived canary key, verify one SDK
   read, revoke it, and prove that reuse fails.
5. Confirm one `create` and one `revoke` receipt and that neither receipt nor
   application logs contains the returned secret or its hash.

The disposable PostgreSQL gate passed on 2026-08-02 against Neon PostgreSQL 17
after all 80 migrations through `0078` were applied to an empty QA database.
Two concurrent creates with quota one produced exactly one active key and one
receipt; a forced transaction rollback left neither key nor receipt; receipt
inspection found no raw secret or key hash. The same run proved the webhook
destination cutover race. The exact QA branch and both temporary databases were
deleted afterward and their connection material was cleared. This is managed
PostgreSQL evidence, not production deployment or physical-NFC evidence.

## Known boundary and next control

The create endpoint intentionally does not yet replay the one-time secret for a
repeated `Idempotency-Key`. A client that loses the `201` response must not retry
blindly: list keys, revoke the unknown credential, and create a new one. A future
implementation may add a short-lived envelope-encrypted response replay record,
but it must be described as software envelope encryption unless a managed HSM
and non-exportability are independently verified. MFA is currently session
verified, not a separate fresh-auth challenge at the exact mutation time.
Dedicated-only SDK-key grants plus fresh reauthentication are the next identity
hardening steps for regulated tenants.

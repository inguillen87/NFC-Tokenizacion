# Nexid enterprise hardening - production pilot evidence

Date: 2026-07-26 UTC

> **HISTORICAL DEPLOYMENT SNAPSHOT.** Deployment IDs, Cloud Run revisions,
> database row counts and test totals in this file identify the rollout that
> produced this evidence; they are not pointers to the latest production
> deployment. Preserve them for audit history. The later consolidated snapshot
> is [`enterprise-product-experience-sprint.md`](enterprise-product-experience-sprint.md).

## Scope and non-regression invariant

This rollout hardens the production API edge, distributed abuse controls, SDK
and webhook boundaries, and the IOTA/Polygon **testnet** custody plane. It does
not change the NFC cryptographic path:

`tag -> phone -> /sun -> encrypted K_META/K_FILE in Neon ->
KMS_MASTER_KEY_HEX in Vercel -> SUN/CMAC verification`.

The factory continues to receive only per-batch `K_META`/`K_FILE`. It does not
receive a backend master key, blockchain wallet, or direct KMS access. Existing
physical samples therefore keep the same verification material.

## Truthful custody statement

Google Cloud KMS keys used here have protection level `SOFTWARE`. Polygon and
IOTA wallets use envelope custody: the EVM private key is encrypted at rest by
KMS, decrypted only inside the isolated executor/governance process for a
bounded signing operation, and wiped from the working buffer afterwards.

This is not Cloud HSM, not a non-exportable asymmetric KMS signing key, and not
an HSM-backed wallet. Those terms must not be used in customer claims.

## IOTA EVM testnet rotation

- Chain ID: `1076`.
- Contract: `0xde7284812D0c81080Cc7B2f60d6D9769343Aa2B0`.
- Governance/owner: `0xC617de00DF0F0Cb92Cb1b763CD81AF0c7aE40C7B`.
- Runtime publisher: `0xE3B44ef8638D09B366DE35189C4992A51511D9C8`.
- Legacy publisher `0x2f320d2B0D8AE483637D8f5509480228509165cB`:
  revoked.
- Governance AAD was rewrapped in memory from historical `publisher` to
  `governance`; Secret Manager version 2 is enabled and version 1 is disabled.
- The governance service account has no user-managed key and no standing user
  `serviceAccountTokenCreator` binding after the rotation.
- Ownership transfer transaction:
  `0x5d211ed62ef7975aec51038caabca652446eec5b8c82a726d161445fc808d7a8`.
- Legacy publisher revocation transaction:
  `0xb4e39ed71958b9671f91ec30a9cb8a2e3d8e494bfd6252db0d85276d1ff42ede`.
- Repeated read-only plan returns only `verify_final_invariants`.
- Cloud Run `nexid-iota-executor-stg` is ready with RPC, contract, durable
  store, executor secret, chain and KMS-wrapped signer checks all green.

## Polygon Amoy rotation

- Chain ID: `80002`.
- Contract: `0x673CAE3D79f825bba9cfb2096184c295A5C9Eb4C`.
- Governance/owner: `0xD820054a3A43A8b89E5bA6d013A6457BfE5Dab77`.
- Runtime publisher/minter: `0x16049F2d7B309A985712C04d7930F2D848C0e43f`.
- Legacy owner/minter `0x644c5D77a34182Db01257bC4C469B01850bc6B2d`:
  ownership removed and minter authorization revoked.
- Publisher authorization transaction:
  `0x86f6b54e55bbd27286771c7756bc99ac0ad3698a185276e05754b38e9322c995`.
- New-publisher deterministic mint canary:
  `0x869a5af566e3801774f4426ec8879d1f9d9f040774e846475e81da551809408c`.
- Ownership transfer transaction:
  `0x8398e73d64b624d7df0761308b9d6936f450d2061b354d883937aee3108b66f8`.
- Legacy minter revocation transaction:
  `0x5efeaa01c05bde75533dea0d5b838317ba9e7f33a5a26a1c671d8ae65fff6612`.
- Governance AAD version 2 is enabled; the historical version is disabled.
- The governance service account has no user-managed key and no standing user
  `serviceAccountTokenCreator` binding after the rotation.
- The legacy wrapped-wallet secret is disabled and its executor accessor was
  removed. The v2 publisher secret remains enabled.
- Cloud Run revision `nexid-chain-executor-stg-00003-n9b` serves 100% traffic
  and reports all Polygon readiness checks green.
- Repeated read-only plan returns only `verify_final_invariants`.

## Production API and edge

- Vercel deployment: `dpl_E5jamWs3TjKRbDp5QffGFAhc9zbb` (`Ready`).
- Production alias: `https://api.nexid.lat`.
- Cloudflare injects the origin-authentication header; Vercel verifies it in a
  constant-time guard. Direct origin probes against both current Vercel IPv4
  addresses returned `403`.
- Cloudflare path checks:
  - `GET /health`: `200`;
  - `GET /public/meta`: `200`;
  - unauthenticated `POST /api/v1/sdk/offline-sync`: `401`;
  - unauthenticated `POST /sun/simulate`: `401`;
  - unsigned `POST /twilio/whatsapp/inbound`: `403`;
  - unauthenticated `POST /internal/webhooks/worker`: `401`;
  - incomplete `GET /sun?view=json`: `400`.
- Vercel error-log query after rollout returned no production errors.
- The public proof API re-verified three IOTA V2 anchors plus receipts and the
  Polygon ownership demo against live testnet RPCs.

## Webhook custody and automatic delivery

- `WEBHOOK_SIGNING_MASTER_KEY_HEX` is independent from NFC, rate-limit and
  blockchain keys. Its recovery copy is held in Google Secret Manager and the
  runtime copy is an encrypted Vercel production variable.
- Endpoint secrets are AES-256-GCM envelopes with random nonce, format version
  and tenant/domain-bound AAD. Production plaintext dual-read is explicitly
  disabled.
- Production `webhook_endpoints` count was zero, so dry-run/apply/postcheck all
  reported `rows=0`, `plaintext=0`, `updated=0`.
- Keyless service account:
  `nexid-webhook-scheduler@nexid-security-staging.iam.gserviceaccount.com`.
- Scheduler job `nexid-webhook-outbox-prod` runs every minute with exact OIDC
  audience `https://api.nexid.lat/internal/webhooks/worker`.
- Negative request without OIDC returned `401`; a real Scheduler invocation
  completed with HTTP `200` according to Cloud Scheduler execution logs.

This proves authenticated automatic queue draining and database access. It is
not yet an end-to-end tenant egress/signature canary because production has no
webhook endpoint to receive one.

## Verification gates

The totals below are the results of this rollout snapshot, not current suite
inventory or a reusable release counter.

- API build: complete Next.js production build and all included suites passed.
- Executor build: `80/80` tests passed.
- Independent focused security review found no validated P0/P1 in edge-origin,
  SDK/offline sync, Twilio, webhook custody/OIDC, or distributed rate limits.
- Durable rate-limit migrations and postchecks were previously applied to
  staging and production with recoverable Neon branches.

## Explicit remaining gates

1. No physical tap of the ten NTAG 424 TT samples was performed during this
   rollout. Code-path compatibility passed, but a phone tap remains a human
   hardware gate.
2. Production Neon intentionally keeps IOTA writes disabled; the current live
   write executor and V2 schema evidence are the isolated staging/testnet pilot.
   Public production verification is RPC-backed, but production API IOTA writes
   must not be claimed as enabled yet.
3. Offline SDK batches authenticate a scoped tenant API key but do not yet
   attest a per-device asymmetric key or signed canonical batch.
4. Webhook key rotation needs a KID/dual-key rewrap window before the first
   master-key replacement.
5. Runtime schema-repair DDL and the broad production database owner remain
   least-privilege follow-ups.
6. The production dispatcher currently lives in a staging-named Google project.
   Move it to a dedicated production security project before a regulated SLA.

No repository commit was created by this rollout.

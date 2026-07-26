# Critical writer rate-limit enforcement

Status: implemented and locally verified. This document does not claim that
the code has been deployed.

## Security boundary

`proof_write`, `webhook`, `sdk_read`, and `sdk_write` are enforced inside the owning route handlers, not
in the global Next.js proxy. This preserves streaming and ordinary reads while
ensuring every critical write consumes the shared PostgreSQL
`sun_rate_limit_buckets` budget across all serverless instances.

The limiter uses `getRequestMeta` for the trusted client IP and writes only an
HMAC-SHA-256 bucket identifier derived with `RATE_LIMIT_KEY_PEPPER`. Tenant,
credential digest, subject and IP values are never stored as raw rate-limit
data.

Each request consumes two hierarchical buckets:

1. a principal bucket that cannot be sharded by changing the tenant; and
2. a tenant + principal + IP bucket for tenant isolation.

For authenticated admin routes the principal is a SHA-256 digest of the
validated `Authorization` credential, subsequently HMACed by the durable
store. Its principal bucket is also independent of source IP. Consequently,
rotating tenant, scope, dashboard-user or source-IP headers cannot reset the
credential-wide allowance. The raw bearer credential is never logged or
persisted.

SDK endpoints add a source-only `sdk_auth` bucket before an untrusted API key
can reach authentication SQL. After authentication they reserve tenant +
authoritative API-key + trusted-IP buckets. GET traffic has a broader read
allowance than mutating SDK traffic. IP attribution is centralized in
`getRequestMeta`; route code never trusts an arbitrary X-Forwarded-For chain.

## Enforced entrypoints

Proof and chain writes (60 requests per 60 seconds):

- `POST /admin/proof/events`
- `POST /admin/proof/anchor`
- `POST /admin/proof/anchors`
- `POST /admin/tokenization/requests`
- `POST /internal/proof/anchors/worker`
- `POST /internal/tokenization/worker`
- `POST /public/cta/tokenize-request`
- `POST /marketplace/p2p/buy`
- `POST /sun/simulate`

Webhook control and delivery (120 requests per 60 seconds):

- `POST /admin/webhooks`
- `PATCH|DELETE /admin/webhooks/:id`
- `POST /internal/webhooks/worker`
- `POST /twilio/whatsapp/inbound`

SDK API:

- `GET /api/v1/sdk/products/:bid`: 1,200 requests per 60 seconds;
- `POST /api/v1/sdk/verify`, `/claim`, `/events`, `/pos/activate`, and
  `/offline-sync`: 600 requests per 60 seconds;
- unauthenticated SDK-key attempts: 1,200 requests per source per 60 seconds,
  before SDK schema/authentication SQL.

Credential-derived principal buckets are reserved only after authentication;
separate source-only guards protect SDK auth and Twilio signature work.
Internal worker secrets use constant-time comparison, and the limiter runs before body parsing
and business-schema/database work. Public tokenization is limited after the
share token and fresh physical-tap handoff are validated; marketplace transfer
is limited after the consumer session is resolved and before offer/chain work.
These placements prevent the limiter from weakening the existing auth or
changing the exact raw payload used by outbound webhook signatures.

`offline-sync` additionally caps the body at 256 KiB and each request at 100
events. It derives the tenant and API-key identity exclusively from SDK auth,
requires an active tenant-scoped verifier bundle/device, permits only the
bundle's BIDs, stores only hashed NFC evidence, and deduplicates atomically on
`(tenant_id, device_id, client_event_id)`.

Twilio inbound applies a trusted-source bucket before reading at most 64 KiB,
then validates the signature over the exact form body and canonical webhook
URL before any schema/database call. Production cannot disable validation and
fails closed if `TWILIO_AUTH_TOKEN` is absent. A dedicated preview-only bypass
is ignored in production and never reuses `ADMIN_API_KEY`.

`/sun/simulate` now requires `SUN_SIMULATE_API_KEY` in every environment,
compares it in constant time, applies the proof-write budget before reading a
32 KiB bounded body, and fails closed before event or chain writes. This does
not alter the production `/sun` NFC validation path.

## Failure behavior

- exhausted budget: `429`, `Retry-After`, `Cache-Control: no-store`;
- unavailable store in production: fail closed with `503`, `Retry-After`, and
  `Cache-Control: no-store`;
- unavailable store outside production: existing explicitly configured
  fail-open behavior may be used for local development;
- policy/class drift: fail closed with `503` instead of silently applying the
  broader public allowance.

Migration `20260725230000_0057_sun_rate_limit_atomic_buckets.sql` and a unique,
private `RATE_LIMIT_KEY_PEPPER` must exist before rollout. Do not reuse NFC,
KMS, database, webhook-signing, login-rate-limit or public application secrets.

## Residual boundary

Resolving a public CTA target and validating a consumer session require a
bounded database read before the authenticated tenant/consumer identity is
available. Edge abuse controls remain the first layer for unauthenticated
traffic to those routes. No NFC validation, KMS custody, Cloudflare rule,
database migration or production deployment is changed by this patch. The
Twilio canonical URL and new simulation secret must be configured before those
entrypoints are exercised in production.

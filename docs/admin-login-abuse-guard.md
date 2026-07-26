# Admin login abuse guard

## Security boundary

`POST /auth/login` reserves an attempt in PostgreSQL before loading an account or verifying a password. Two independently enforced buckets are updated in one statement:

- `source`: limits password spraying from one trusted network origin across many identities.
- `source_subject`: limits repeated guessing for one normalized identity from one origin.

There is deliberately no identity-only lock. An unauthenticated attacker therefore cannot globally lock a victim account by rotating source addresses. Bucket keys are HMAC-SHA-256 values; the enforcement table stores neither email addresses nor IP addresses.

The reservation is an `INSERT ... ON CONFLICT DO UPDATE` over both keys. PostgreSQL row locks serialize competing requests, so parallel API instances cannot each spend the same final attempt. Active blocks are not extended by traffic. A successful login deletes its `source_subject` bucket and subtracts only that successful request from the shared `source` bucket; it never clears other failures from the same origin.

## Required production configuration

Apply migration `20260723200500_0053_admin_login_abuse_guard.sql` before releasing the route and set:

- `LOGIN_RATE_LIMIT_PEPPER`: dedicated random secret, at least 32 characters.

Production is fail-closed even if `LOGIN_RATE_LIMIT_FAIL_CLOSED=false`: missing/invalid configuration, an untrusted or malformed client address, and rate-limit storage failures return a generic `503` with `Retry-After: 60`. Outside production, `LOGIN_RATE_LIMIT_FAIL_CLOSED` controls that behavior to keep local development possible.

The login route uses the centralized request metadata resolver. It accepts
Cloudflare's client IP only after the origin-auth proxy has injected its
internal verification marker, or Vercel's platform-generated forwarding value
for direct/preview traffic. It never treats caller-controlled `X-Forwarded-For`
or `X-Real-IP` as a production trust signal.

## Policy and responses

Defaults are a 15-minute window, 5 attempts per source+identity, 100 failed attempts per source, and a 15-minute cooldown. Thresholds and retention are bounded and validated at startup through the `LOGIN_RATE_LIMIT_*` variables in `apps/api/.env.example`.

Blocked requests return generic `invalid credentials` with HTTP `429`, `Cache-Control: no-store`, and the database-derived `Retry-After`. Unknown users, wrong passwords, and inactive users share the same public 401 response. A valid password is required before the MFA challenge is disclosed. Unknown users run the same scrypt verification path through a fixed sentinel hash to reduce timing-based enumeration.

Operational audit events remain in `user_auth_events`; the HMAC bucket table is enforcement state, not the audit log. Stale buckets are pruned in bounded batches during reservations. Monitor `login_rate_limited`, `login_abuse_guard_unavailable`, and `login_abuse_guard_clear_failed`; any production occurrence of the latter two is an authentication availability incident.

## Rollout check

1. Apply migration `0053` through the normal migration pipeline.
2. Configure the pepper and verify the Cloudflare-to-origin authentication boundary.
3. Run `npm run test:auth-security --workspace=api` and `npx tsc --noEmit -p apps/api/tsconfig.json`.
4. From a staging source, verify the configured attempt boundary, the `Retry-After` header, cooldown recovery, a valid login reset, and that a forged left-most `X-Forwarded-For` value does not change the selected source.

# Durable rate-limit security

SUN/NFC validation, public claim PIN checks, and consumer OTP flows share the
PostgreSQL-backed `sun_rate_limit_buckets` store. Each reservation is a single
atomic `INSERT ... ON CONFLICT DO UPDATE`, so concurrent serverless instances
cannot independently spend the same final request. Stale buckets are deleted in
bounded batches and no raw IP address, BID, UID, phone number, or email address
is stored in this table.

Bucket identifiers are HMAC-SHA-256 values keyed by
`RATE_LIMIT_KEY_PEPPER`. Production requires a dedicated random value of at
least 32 characters and fails closed when it is missing or invalid. Do not reuse
`LOGIN_RATE_LIMIT_PEPPER`, NFC/KMS material, a database password, an API token,
or a `NEXT_PUBLIC_*` value. The fixed development fallback is deliberately
unavailable in production.

Client IPs come from the centralized request metadata resolver. Cloudflare's
`CF-Connecting-IP` is accepted only after the origin-auth proxy injects its
internal verification marker; direct production requests do not get to choose
their identity through `X-Forwarded-For` or `X-Real-IP`.

## Threshold semantics

For a configured maximum of `N`, reservations 1 through N are allowed and
reservation N+1 is rejected. A preflight read reports the bucket as limited at
`hits >= N`, because that read occurs before the caller would reserve the next
attempt. This is intentional and prevents an extra claim-PIN attempt.

## Production rollout

Migration `20260725230000_0057_sun_rate_limit_atomic_buckets.sql` must be
applied before deploying code that uses the store. The migration is additive;
the legacy event table remains intact and old application code continues to
work during a migration-first rollout.

1. Set `RATE_LIMIT_KEY_PEPPER` in the API production environment without
   exposing its value in logs or build output.
2. On a disposable Neon branch created from staging, use the unpooled owner URL
   and run from the repository root:

   ```powershell
   $env:DATABASE_URL='<disposable-unpooled-owner-url>'
   npm run db:migrate --workspace=api -- --only 20260725230000_0057_sun_rate_limit_atomic_buckets.sql
   ```

3. Run `apps/api/db/ops/rate-limit-buckets-postcheck.sql` as a read-only
   evidence query and execute a parallel request boundary test.
4. After a staging checkpoint/backup, repeat the exact `--only` migration on
   staging with its unpooled owner URL, rerun the postcheck, and only then deploy
   the API.

Do not add `0057` to the fixed IOTA migration wrapper. A code rollback is safe:
the additive bucket table may remain. Changing the pepper intentionally changes
all bucket identifiers and resets active windows, so rotate it only through a
controlled incident or maintenance procedure.

## Live rollout evidence

Executed on 2026-07-26 in migration-first order.

- Disposable rehearsal endpoint: `ep-broad-heart-ait7wlm0`.
- Staging checkpoint: branch `br-jolly-boat-aibryacq`, created before `0057`.
- Production checkpoint: branch `br-shy-fog-aiccy9v9`, created before `0057`.
- Migration ledger, five columns, nine constraints and two ready/valid indexes
  passed on rehearsal, staging endpoint `ep-solitary-surf-aiixcsmk`, and
  production endpoint `ep-fancy-morning-ai5gdrnd`.
- A live rehearsal issued 64 simultaneous reservations against one bucket.
  PostgreSQL returned every counter exactly once from 1 through 64; with a
  limit of 40, exactly 24 reservations were rejected.
- Separate random sensitive values for `RATE_LIMIT_KEY_PEPPER` and
  `LOGIN_RATE_LIMIT_PEPPER` were installed in Vercel Production before the API
  deployment. Their values were never logged or committed.
- The production `/auth/login` probe reached the durable guard and returned
  the generic `401 invalid credentials`; PostgreSQL recorded only its HMAC
  source and source-subject buckets.
- The production `/sun?view=json` negative probe returned the expected
  `400 missing params`, not `503`; PostgreSQL recorded the `ip`, `bid`, and
  `payload` buckets with 64-character HMAC identifiers and no raw inputs.
- The complete Vercel production build passed all route, proof, webhook,
  authentication and rate-limit suites before promotion.

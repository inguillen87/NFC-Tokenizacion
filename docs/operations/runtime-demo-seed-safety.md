# Runtime demo catalog isolation

`GET /consumer/me` authenticates before portal initialization. Unauthenticated requests do not initialize the portal.

Automatic Balmec catalog seeds are disabled by default. The existing fixture can run only with `NEXID_RUNTIME_DEMO_SEED=true`, `NODE_ENV=development` or `test`, and an empty `VERCEL_ENV` or `VERCEL_ENV=test`. Both Production and Preview reject this opt-in; `VERCEL=1` also blocks it even if other environment indicators are missing. `DEMO_MODE` does not enable catalog resets. No deployed environment variable has been added or changed by this patch.

The removed runtime behavior was scoped to the tenant whose slug is `demobodega`; its display name is Bodega Balmec. That slug is not a database-isolation guarantee. The old cold initializer could reactivate brand visibility, rewards and named offers, reset prices and purchase flags, replenish reward stock, create an active production-mode club when none was active, and draft non-curated products. These effects were reproduced by capturing the actual source's statement templates in a synthetic executor. No live data was read or changed, and no live impact is claimed.

The local opt-in remains a fixture reset: it may overwrite the `demobodega` sample catalog in that local environment. It does not grant capabilities or certify a real NFC product, payment, points award, or customer identity. Production and Preview continue to use the tenant's stored configuration, current permissions and existing NFC contracts.

The existing idempotent `loyalty_members.member_key` backfill remains unchanged. Equivalent backfills exist in migrations `0014_loyalty_member_identity_hardening.sql` and `20260502195500_0026_tokenization_loyalty_schema_hardening.sql`, and current enrollment supplies the member key explicitly. This is source evidence, not proof that every live legacy row or migration constraint is complete. Removing that request-path backfill is separate work; this patch does not claim the authenticated initializer is fully read-only.

Tests compile the real handlers and initializers with a synthetic executor. They verify the cold unauthenticated rejection, authenticated Production/Preview reads with the opt-in flag set, local default absence of catalog writes, explicit local fixture behavior, repeated cold/warm module instances, preserved legacy member-key backfill, and failed reads. No provider, OTP, SQL connection, migration, deployment or publication is part of those tests.

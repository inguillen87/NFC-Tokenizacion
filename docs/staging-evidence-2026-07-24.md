# Staging evidence — 2026-07-24

- Neon project: `nfc-token-api` (`young-mouse-14324031`)
- Branch: `nexid-staging` (isolated from `main`)
- PostgreSQL: 17.0
- Migrations applied: 0050, 0051, 0052, 0053, 0054
- Required V2 tables, columns and indexes: present
- Migration preflight: passed; blocking locks: 0
- Transactional dry-run: passed; no persistence
- Vercel `nexid-api` Preview `DATABASE_URL` and `DATABASE_URL_UNPOOLED`: point to staging branch
- Production database variables: unchanged
- Cloudflare: `nexid.lat` is not yet a zone in the authenticated account; current OAuth token can read zones but cannot create/edit the zone

This evidence does not authorize a production migration or DNS change.

## Auditoría reproducible (2026-07-24, worktree)

The claims above are historical evidence and are not the current state of the
Neon endpoint configured in `apps/api/.env.local`. A read-only smoke against
that endpoint reached PostgreSQL 17, but failed closed because migrations
0050–0055 are absent (`evidence_anchor_attempts`,
`iota_executor_publications`, and `admin_login_attempt_buckets` are missing).
No remote database was contacted or modified by this sprint.

The IOTA read-only smoke was independently rerun against the configured IOTA
testnet RPC and V2 contract: chain 1076, deployed bytecode, `SCHEMA_VERSION=2`,
and the configured publisher authorization all passed. This is not evidence of
a live write or KMS custody path.

The complete enterprise gate currently returns `ok=false`: PostgreSQL is
missing migrations 0050–0055, while the IOTA read-only and WAF gates pass. KMS
configuration is intentionally false (`IOTA_KMS_SIGNER_URL`, key ID and
allowed-hosts are not configured). This is the authoritative blocker for
promotion; no production claim should be made until a dedicated staging
database and non-exportable signer are provisioned.
## Latest verification (2026-07-24)

- Executor build and tests: 14/14 passed, including KMS transaction-intent verification and durable idempotency.
- Cloudflare webhook recovery Worker tests: 3/3 passed locally; Worker remains undeployed pending origin secret provisioning.
- IOTA V2 read-only gate passed against testnet: chain 1076, expected contract bytecode, schema version 2, authorized publisher.
- Enterprise gate remains red by design: staging database is missing migrations 0050–0055 and `admin_login_attempt_buckets`; independent IOTA/Polygon KMS configuration and live signing evidence are absent.
- Migration review found and corrected an ordering defect in 0055: legacy `processing` rows are now rewritten to `reserved` only after the old status constraint is dropped. The dry-run list now includes 0055.
- Cross-surface regression: API security/webhook/polygon suite 15/15, executor 14/14, WAF policy gate passed.
- Migration safety lint passed (`npm run check:migrations:safety`), including 0055 constraint ordering and transactional assertions.

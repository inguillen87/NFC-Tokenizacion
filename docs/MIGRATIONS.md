# Database migrations workflow (apps/api)

This repo now uses a **forward-only SQL migrations** workflow for schema evolution.

## Source of truth
- Migration files: `apps/api/db/migrations/*.sql`
- Applied migration registry table: `schema_migrations`

## Commands
From repo root:

```bash
npm run db:new -- add_users_and_memberships
npm run db:migrate
npm run db:seed
npm run db:reset:local
```

Or directly in `apps/api`:

```bash
npm run db:new -- add_users_and_memberships
npm run db:migrate
npm run db:seed
npm run db:reset:local
```

## Environments
- Local: set `DATABASE_URL` to local Postgres and run `db:migrate`.
- Neon / Vercel: run `db:migrate` against the target `DATABASE_URL` in CI/CD or an ops shell.

## Safety rules
1. Never edit old migration files after they are applied in shared envs.
2. Add a new migration for every schema change.
3. Keep API contract compatibility unless explicitly versioning routes.
4. `db:reset:local` is blocked for non-local DB URLs unless `FORCE_DB_RESET=1`.

## Planned schema evolution
Next migrations should cover:
- users
- memberships
- roles
- subscriptions
- reseller relationships
- optional localized content tables

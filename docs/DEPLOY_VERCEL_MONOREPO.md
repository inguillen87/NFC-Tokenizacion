# Vercel Deploy (npm workspaces)

This repo is configured to avoid pnpm on Vercel.

## Why
Vercel auto-detects the package manager from the root lockfile. If `pnpm-lock.yaml` is present, it runs `pnpm install`. This repo intentionally removes pnpm and forces `npm install` via `vercel.json`.

## Projects
Create 3 separate Vercel projects from the same GitHub repo:
- `apps/api`
- `apps/web`
- `apps/dashboard`

## API project env vars
- `DATABASE_URL`
- `NFC_ENVELOPE_KEK_VERSION` + `NFC_ENVELOPE_KEK_<VERSION>_HEX`
- `PUBLIC_CERTIFICATE_SIGNING_SECRET`
- `SUN_HANDOFF_SECRET`
- `CLERK_SECRET_KEY` + `CLERK_AUTHORIZED_PARTIES`

## Root Directory per project
- API: `apps/api`
- Web: `apps/web`
- Dashboard: `apps/dashboard`

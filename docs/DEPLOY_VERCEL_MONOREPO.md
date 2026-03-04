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
- `ADMIN_API_KEY`
- `KMS_MASTER_KEY_HEX`

## Root Directory per project
- API: `apps/api`
- Web: `apps/web`
- Dashboard: `apps/dashboard`

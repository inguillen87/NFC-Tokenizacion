# Deploy on Vercel (monorepo)

## Important
Import the Git repository, do **not** upload a folder snapshot. Vercel monorepos rely on the repository root so it can detect workspaces and package relationships.

## Create 3 Vercel projects from the same repo
- Project 1 root directory: `apps/api`
- Project 2 root directory: `apps/web`
- Project 3 root directory: `apps/dashboard`

Vercel supports monorepos by creating one project per directory and selecting the project's Root Directory.

## Root requirements
- `packageManager` is set in root `package.json`
- `pnpm-workspace.yaml` exists at repo root
- Each workspace package has a unique `name`
- Each app explicitly declares its workspace dependencies

## API env vars
- `DATABASE_URL`
- `ADMIN_API_KEY`
- `KMS_MASTER_KEY_HEX`

## Why the previous deploys failed
- builds were started from the app folder without a stable workspace root configuration
- the app build saw code, but the monorepo package manager/workspace relationship was not explicit enough
- App Router routes require a root layout in each app

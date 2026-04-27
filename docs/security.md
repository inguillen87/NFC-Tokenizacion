# Security notes

## Credential hygiene and rotation

- No real passwords, admin keys, or long-lived bearer tokens should be committed to this repository.
- Example credentials in docs must use placeholders (for example: `<ROTATE_ME_...>`).
- If any credential-like value was previously committed, rotate it immediately in the backing system (IdP, database, API gateway, cloud secret store) and invalidate old sessions/tokens.

## Scoped admin auth policy

- Prefer scoped admin headers/tokens (`super_admin`, `tenant_admin`, `reseller`, `readonly_demo`) over a single global admin key.
- `ADMIN_API_KEY` is only a compatibility fallback.
- For production hardening, set `REQUIRE_SCOPED_ADMIN_AUTH=true` and keep demo fallback disabled unless explicitly required for sandbox sessions.

## Demo data isolation

- Simulated fallback responses must only be available in explicit demo mode.
- Any demo fallback response should be labeled with `x-nexid-demo-data: DEMO DATA`.
- Dashboard demo login fallback should be gated with explicit envs in production:
  - `DASHBOARD_ALLOW_DEMO_LOGIN=false` (recommended default)
  - enable only with explicit demo mode (`DASHBOARD_DEMO_MODE=true` or `NEXT_PUBLIC_DEMO_MODE=true`).

## Rotation action

- Legacy hardcoded demo credentials were removed from code defaults. Configure demo users via environment variables only and rotate any previously shared credentials.

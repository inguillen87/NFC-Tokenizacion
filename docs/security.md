# Security notes

## Credential hygiene and rotation

- No real passwords, admin keys, or long-lived bearer tokens should be committed to this repository.
- Example credentials in docs must use placeholders (for example: `<ROTATE_ME_...>`).
- If any credential-like value was previously committed, rotate it immediately in the backing system (IdP, database, API gateway, cloud secret store) and invalidate old sessions/tokens.

## Authoritative admin identity policy

- Human admin routes accept only the opaque, revocable nexID session bearer. The API resolves role, tenant, permissions and actor from the current database user and membership.
- `x-nexid-admin-scope`, `x-nexid-tenant-slug`, permission and actor headers are not an authority source. `ADMIN_API_KEY` is not a fallback for an invalid or unknown human session.
- Dashboard BFF routes validate the cookie through `/auth/session`, forward the current or rotated opaque bearer, and never forward a root credential. Demo sessions stay in the labelled local sandbox and never reach an upstream admin route.
- Clerk bootstrap verifies the Clerk session JWT and fetches the verified Clerk user before applying the explicit super-admin email allowlist. Production requires `CLERK_SECRET_KEY` and `CLERK_AUTHORIZED_PARTIES` on the API.
- Non-human automation needs a separately designed, hashed, revocable and tenant-bound service account. It must not impersonate a human session or reuse `ADMIN_API_KEY`.

### Admin rollout order

1. Confirm the IAM migrations and active user memberships in the target database; revoke stale sessions before rollout.
2. Configure API `CLERK_SECRET_KEY`, optional `CLERK_JWT_KEY`, and exact `CLERK_AUTHORIZED_PARTIES`. Configure the matching Clerk keys on the dashboard.
3. Validate login, session rotation, tenant isolation, permissions and logout on paired API/dashboard preview deployments.
4. Promote the paired releases in one maintenance window. The new API intentionally does not fall back to `ADMIN_API_KEY`, so mixed old-dashboard/new-API production is unsupported.
5. Verify 401 for old global-key requests and forged authority headers, then remove `ADMIN_API_KEY` from web and dashboard environments. The API may retain it only during an audited, default-off signing-secret compatibility window; remove it after both legacy gates are disabled.

## Application signing-secret rollout

- `PUBLIC_CERTIFICATE_SIGNING_SECRET` and `SUN_HANDOFF_SECRET` are independent HMAC keys. Neither normally falls back to `ADMIN_API_KEY`, demo material, tokenization salts or each other.
- Set the dedicated current variables to the currently effective material before deploying this change. Then disable both `*_ALLOW_LEGACY_SECRET_FALLBACK` gates.
- Rotate by placing the old value in the matching `*_PREVIOUS` variable and the new random value in the current variable. Retain the old SUN key for the maximum fresh-token TTL plus deployment overlap; retain the old certificate key for as long as historical v1 share links must remain valid.
- The legacy fallback gates exist only for an audited migration when the previously effective material cannot be renamed atomically. Enable them briefly, establish the dedicated variables, verify, disable them, and only then rotate `ADMIN_API_KEY`.

## Demo data isolation

- Simulated fallback responses must only be available in explicit demo mode.
- Any demo fallback response should be labeled with `x-nexid-demo-data: DEMO DATA`.
- Dashboard demo login fallback should be gated with explicit envs in production:
  - `DASHBOARD_ALLOW_DEMO_LOGIN=false` (recommended default)
  - enable only with explicit demo mode (`DASHBOARD_DEMO_MODE=true` or `NEXT_PUBLIC_DEMO_MODE=true`).

## Rotation action

- Legacy hardcoded demo credentials were removed from code defaults. Configure demo users via environment variables only and rotate any previously shared credentials.

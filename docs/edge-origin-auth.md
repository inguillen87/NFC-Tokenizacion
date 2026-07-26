# Cloudflare-to-Vercel origin authentication

## Security invariant

When `NEXID_EDGE_ORIGIN_ENFORCED=true`, every request to an API production
deployment or explicitly protected custom hostname must have passed through
Cloudflare or an explicitly trusted server caller. The only unauthenticated
exception is exact `GET`/`HEAD /health` for platform healthchecks.

The Next.js global proxy enforces the invariant before route handlers. It
compares `x-nexid-edge-auth` with a server-only credential using a
timing-safe comparison, removes the credential before application code runs,
and synthesizes `x-nexid-edge-verified: 1`. Caller-supplied copies of either
header are overwritten or removed. Application code may trust
`CF-Connecting-IP` only when that internal marker is present.

There are deliberately no route exemptions for NFC `/sun`, SDK endpoints,
Twilio/webhook receivers, event streams, or internal workers. Requests to
`https://api.nexid.lat` traverse Cloudflare, which adds the credential without
changing the URL, query, body, or provider signature. Trusted server callers
should prefer that custom hostname. A caller that intentionally targets a
production `*.vercel.app` origin must send the credential itself.

Vercel previews remain reachable because an explicit `VERCEL_ENV=preview`
takes precedence over `NODE_ENV=production`. A non-Vercel staging/custom host
can opt into the same boundary through the comma-separated
`NEXID_EDGE_ORIGIN_PROTECTED_HOSTS` list. Entries are exact hostnames, not
wildcards.

## Zero-lockout rollout

1. Generate one random base64url credential with at least 32 characters. Do
   not print it in CI logs, commit it, put it in a `NEXT_PUBLIC_*` variable, or
   reuse any NFC, webhook, database, API-key, wallet, or KMS secret.
2. In Vercel Production, set `NEXID_EDGE_ORIGIN_SECRET` to that credential and
   keep `NEXID_EDGE_ORIGIN_ENFORCED=false`.
3. In the Cloudflare `nexid.lat` zone, merge the rule fragment from
   `infra/waf/cloudflare-origin-auth-rule.template.json` into the existing
   zone-level `http_request_late_transform` ruleset. Replace the placeholder
   only in the Cloudflare secret-bearing deployment input. The `set` operation
   must overwrite a client-supplied header for every `api.nexid.lat` path.
4. Deploy the API and smoke the custom hostname while enforcement is still
   off. Confirm `/sun`, SDK authentication, Twilio signature validation,
   webhook worker authentication, SSE, and `/health` retain their normal
   application responses.
5. Set `NEXID_EDGE_ORIGIN_ENFORCED=true` in Vercel Production and redeploy.
6. Confirm the custom hostname still reaches each real route, then confirm the
   production `*.vercel.app` hostname returns the guard's `403`,
   `x-nexid-origin-guard: denied`, and `Cache-Control: private, no-store` for a
   non-health route. Exact `GET /health` must remain available on both hosts.

Cloudflare Request Header Transform Rules are available on the Free plan and
the `set` operation overwrites any prior value. The API rule belongs in phase
`http_request_late_transform`. See the official Cloudflare documentation:

- https://developers.cloudflare.com/rules/transform/
- https://developers.cloudflare.com/rules/transform/request-header-modification/
- https://developers.cloudflare.com/rules/transform/request-header-modification/create-api/

Do not use a `PUT` request containing only the template rule against an
existing Rulesets API phase: that can replace sibling transform rules. Read the
current phase ruleset, merge by stable `ref`, validate the full result, and
retain its pre-change JSON for rollback.

## Credential rotation

For a zero-downtime rotation:

1. Put the new value in `NEXID_EDGE_ORIGIN_SECRET` and the old value in
   `NEXID_EDGE_ORIGIN_SECRET_PREVIOUS`; redeploy Vercel.
2. Change the Cloudflare overwrite rule to the new value and verify trusted
   traffic plus the direct-origin denial probe.
3. Remove `NEXID_EDGE_ORIGIN_SECRET_PREVIOUS` and redeploy.

The previous credential is optional, subject to the same strength checks, and
must not become a permanent second key.

## Live rollout evidence

Activated on 2026-07-26 for the production API deployment
`nexid-jge144m1j-marcelos-projects-c26aa499.vercel.app`, promoted to
`api.nexid.lat`.

- Cloudflare Request Header Transform Rule
  `Nexid - authenticate Cloudflare origin` is active for the exact expression
  `(http.host eq "api.nexid.lat")` and uses `Set static`, which overwrites a
  caller-provided value.
- Vercel Production has encrypted values for `NEXID_EDGE_ORIGIN_SECRET` and
  `NEXID_EDGE_ORIGIN_ENFORCED=true`.
- Normal Cloudflare traffic returned `200` for `/health` and `/public/meta`;
  `/auth/login` reached the application and returned its expected input error.
- A caller-supplied false origin credential sent through Cloudflare was
  overwritten and `/public/meta` still returned `200`.
- A DNS-override probe sent `api.nexid.lat` directly to Vercel, bypassing
  Cloudflare: exact `/health` returned `200`, while `/public/meta` returned
  `403` with `X-Nexid-Origin-Guard: denied`.
- The same direct-origin probe remained `403` when it spoofed
  `x-nexid-edge-verified: 1` or supplied an incorrect origin credential.
- Vercel's generated deployment aliases are additionally protected by Vercel
  Deployment Protection (`302`/`401` before application routing).

No origin credential value is retained in this document, repository, command
output, or response payload.

## Rollback

If legitimate traffic fails after enforcement, first set
`NEXID_EDGE_ORIGIN_ENFORCED=false` and redeploy. Do not expose the origin by
deleting unrelated WAF rules or disabling Cloudflare proxying. Preserve the
failed request ID and inspect whether the transform rule matched the exact
host. Once corrected, repeat the complete route smoke before re-enabling.

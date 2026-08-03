# Tenant webhook delivery runbook

## Production state audited and rolled out on 2026-07-26

At the start of the audit, outbound delivery was **not automatic**. The
production API already had the durable outbox and private worker route, but the
three runtime prerequisites were absent:

- Cloudflare Workers listed `obrasaas-webhook-recovery`, not the versioned
  `nexid-webhook-recovery` Worker in this repository.
- `cloudscheduler.googleapis.com` was disabled in
  `nexid-security-staging`, so that project cannot contain an active Scheduler
  job.
- Vercel production did not contain `INTERNAL_WEBHOOK_WORKER_KEY`,
  `WEBHOOK_SCHEDULER_OIDC_SERVICE_ACCOUNT_EMAIL`, or
  `WEBHOOK_SCHEDULER_OIDC_AUDIENCE`.

The rollout has now closed those three gaps:

- Vercel production contains the exact OIDC identity/audience configuration.
- `cloudscheduler.googleapis.com` is enabled.
- Keyless job `nexid-webhook-outbox-prod` is enabled in `us-east1` and drains
  the outbox once per minute through the Cloudflare-protected API.
- An unauthenticated negative request returned `401` and a real Scheduler OIDC
  invocation completed with HTTP `200`.

This proves automatic authenticated queue draining. Production currently has
zero webhook endpoints, so an end-to-end delivery/signature canary against a
tenant receiver is still pending. See
`docs/enterprise-hardening/2026-07-26/production-hardening-evidence.md`.

Tenant webhooks use a PostgreSQL outbox. SDK routes only persist a delivery;
they never contact tenant-controlled hosts inline. Google Cloud Scheduler is the
primary dispatcher and calls `POST /internal/webhooks/worker` with a
Google-signed service-account OIDC ID token. The API verifies the token
signature, expiry and issuer through `google-auth-library`, then additionally
requires the exact configured `aud`, service-account `email`, and
`email_verified=true` before rate limiting, body parsing, database access, or
tenant-controlled network egress.

`x-internal-webhook-key` remains supported as a recovery fallback. It is
accepted only when a non-empty `INTERNAL_WEBHOOK_WORKER_KEY` matches using a
constant-time digest comparison. Missing or partial OIDC configuration and a
missing fallback secret both fail closed with `401`.

## Required production configuration

- Set `WEBHOOK_SCHEDULER_OIDC_SERVICE_ACCOUNT_EMAIL` to one exact Google service
  account. Do not use a user identity, a wildcard, or the Cloud Scheduler
  service agent.
- Set `WEBHOOK_SCHEDULER_OIDC_AUDIENCE` to the exact HTTPS worker URL without a
  query or fragment. For production this is
  `https://api.nexid.lat/internal/webhooks/worker`.
- Do not send `INTERNAL_WEBHOOK_WORKER_KEY` from Google Cloud Scheduler. Keep it
  only for a separately controlled recovery caller; if it is not provisioned,
  the fallback correctly stays disabled.
- Run the worker at least once per minute. Multiple workers are supported through
  `FOR UPDATE SKIP LOCKED` leases; abandoned leases are reclaimed after 10 minutes.
- Alert on `dead_letter` growth, oldest due delivery age, repeated retries and
  worker invocation failures.
- Keep `WEBHOOK_REQUEST_TIMEOUT_MS` at or below 30 seconds and
  `WEBHOOK_MAX_RESPONSE_BYTES` at or below 1 MiB. Defaults are 10 seconds and
  64 KiB.

## Egress policy

Only HTTPS on port 443 is accepted. URLs with credentials are rejected. Before
each attempt, all A and AAAA results are resolved and checked; any loopback,
private, link-local, carrier-grade NAT, documentation, benchmark, multicast or
reserved result blocks the delivery. The selected public address is injected
into the TLS socket lookup, preserving the original hostname for certificate
validation and preventing DNS rebinding between validation and connect.

Redirects are never followed. A 3xx response, unsafe destination, invalid TLS
certificate or oversized response is terminal. Timeouts, DNS availability
errors, HTTP 408/425/429 and 5xx responses are retried with bounded exponential
backoff. Stored errors are normalized codes and do not contain raw network or
certificate details.

## Delivery semantics and recovery

At-least-once delivery applies **only after every matching endpoint has a
durably confirmed row in `webhook_deliveries`**. The producer inserts all
matching deliveries in one PostgreSQL statement and returns a receipt with
`attempted`, `confirmed`, `queued` and `deduplicated`; SDK success responses
include that receipt. `status=not_configured` means the tenant had no matching
enabled endpoint and therefore no delivery was promised.

If the producer cannot confirm every row, the SDK route must not return its
normal success response. It retries the same logical webhook event internally,
using the stable resource ID and unique `(endpoint_id, event_id)` constraint,
then returns retryable HTTP `503` with `traceId`, `resourceId` and
`operationCommitted=true` when the business mutation had already committed.
Clients must reconcile that resource ID before replaying the business mutation;
the 503 is not evidence that the mutation rolled back. This is an explicit
remaining cross-query transaction boundary, not a claim of atomic mutation plus
outbox.

Once a row is confirmed, delivery is at least once. The stable
`x-nexid-delivery` header and envelope `id` allow receivers to deduplicate a
retry if the remote accepted a request but the database acknowledgement failed.
A unique `(endpoint_id, event_id)` index prevents the same logical SDK event
from being enqueued twice for one endpoint.

Each delivery snapshots both the destination URL and the database-owned
`destination_version` at enqueue time. A real endpoint URL change is therefore
a custody-boundary change, not a transparent redirect. Migration `0078` makes
that identity immutable and serializes enqueue against cutover with a
PostgreSQL `FOR SHARE`/`FOR UPDATE` conflict. The administration transaction
refuses the change while a fresh delivery lease exists and moves every pending,
scheduled retry, or expired processing lease for the previous destination to
`dead_letter` with `webhook_destination_changed`. It never rebinds historical
events to the new destination. Immediately before network egress, the worker
renews its lease and verifies endpoint ID, URL and destination version; a failed
verification performs zero network I/O. An operator may emit a new logical
event only after reviewing the dead letter and the receiving system's
deduplication policy.

## Destination-version rollout gate

Migration `20260802130000_0078_webhook_destination_cutover.sql` is backward
compatible for enqueue because its insert trigger owns the URL/version
snapshot. It is not safe to leave an old worker revision running indefinitely:
an old worker does not perform the final pre-egress version check. Use this
order for the first production rollout:

1. Pause the Scheduler job and confirm that no fresh `processing` lease remains.
2. Apply the reviewed migration set through `0078` with the release runner.
3. Deploy the API/worker revision whose schema watermark requires `0078`.
4. Run the unauthenticated negative control and an authenticated worker drain
   with no tenant endpoint, then a controlled receiver canary.
5. Resume Scheduler only after the deployed worker reports Ready.

If the code deployment fails after the migration, keep Scheduler paused. The
migration and its triggers may stay in place; do not downgrade the schema or
rewrite historical delivery URLs. Roll forward the worker, then resume. This
gate has not been executed in production merely because the migration and tests
exist in the repository.

On 2026-08-02 the database portion of this gate passed on a disposable Neon
PostgreSQL 17 branch after all 80 migrations through `0078`: an enqueue racing
the endpoint update waited on the endpoint transaction lock, snapshotted the
committed URL/version 2 despite forged caller snapshot fields, and the prior
version-1 delivery became `dead_letter` without URL rebind. The audit row held
only versions and SHA-256 URL fingerprints. The QA branch was deleted after the
run. HTTP egress and production Scheduler rollout remain separate gates.

New endpoints use signature v2, which authenticates the endpoint key ID,
delivery ID, event ID, timestamp and exact raw bytes. Existing endpoints remain
on v1 until explicitly upgraded; receivers must treat a v1 key ID as an
unauthenticated routing hint and resolve its secret from trusted endpoint
configuration. The private SDK verifies both versions and exposes
`keyIdAuthenticated` so application policy can reject legacy routing. A v2
verification failure must never be retried as v1.

Dead letters are not replayed automatically. Investigate the endpoint and error
code, then cause the source system to emit a new logical event or add a reviewed
operator replay workflow. Migration `0052` intentionally classifies historical
failed inline deliveries as dead letters to avoid surprising customers with old
events during rollout.

## Exact pilot rollout: Google Cloud Scheduler OIDC

The following PowerShell commands target the currently available pilot project.
The service account receives no project role: Vercel is outside Google Cloud and
the API performs the authorization itself. The operator only needs
`iam.serviceAccounts.actAs` to attach the identity to the job. Cloud Scheduler
requires its Google-managed service agent role; enabling the API normally creates
that binding automatically.

```powershell
$Project = "nexid-security-staging"
$Location = "us-east1"
$ServiceAccountId = "nexid-webhook-scheduler"
$SchedulerEmail = "$ServiceAccountId@$Project.iam.gserviceaccount.com"
$Audience = "https://api.nexid.lat/internal/webhooks/worker"
$Job = "nexid-webhook-outbox-prod"
$Operator = (gcloud config get-value account).Trim()

gcloud services enable cloudscheduler.googleapis.com iamcredentials.googleapis.com `
  --project=$Project

gcloud iam service-accounts create $ServiceAccountId `
  --project=$Project `
  --display-name="Nexid production webhook scheduler"

gcloud iam service-accounts add-iam-policy-binding $SchedulerEmail `
  --project=$Project `
  --member="user:$Operator" `
  --role="roles/iam.serviceAccountUser"

$env:VERCEL_ORG_ID = "team_BV1xuY6BnEzGanfok8GAyjZv"
$env:VERCEL_PROJECT_ID = "prj_r0dmVaKogGs8y4NAZ2njCWHhUgLk"
try {
  $SchedulerEmail | npx --yes vercel@50.28.0 env add `
    WEBHOOK_SCHEDULER_OIDC_SERVICE_ACCOUNT_EMAIL production
  $Audience | npx --yes vercel@50.28.0 env add `
    WEBHOOK_SCHEDULER_OIDC_AUDIENCE production
  npx --yes vercel@50.28.0 deploy --prod --yes
} finally {
  Remove-Item Env:VERCEL_ORG_ID -ErrorAction SilentlyContinue
  Remove-Item Env:VERCEL_PROJECT_ID -ErrorAction SilentlyContinue
}

gcloud scheduler jobs create http $Job `
  --project=$Project `
  --location=$Location `
  --description="Drain Nexid tenant webhook outbox through authenticated API" `
  --schedule="* * * * *" `
  --time-zone="Etc/UTC" `
  --uri=$Audience `
  --http-method=POST `
  --headers="Content-Type=application/json" `
  --message-body='{"limit":10}' `
  --oidc-service-account-email=$SchedulerEmail `
  --oidc-token-audience=$Audience `
  --attempt-deadline=120s `
  --max-retry-attempts=2 `
  --min-backoff=10s `
  --max-backoff=60s `
  --max-doublings=2
```

The API must be deployed with the OIDC variables before creating the job. The
audience deliberately contains no query string. Google documents OIDC for
external HTTP targets and requires the Scheduler service account to belong to
the same project as the job:

- https://cloud.google.com/scheduler/docs/http-target-auth
- https://cloud.google.com/sdk/gcloud/reference/scheduler/jobs/create/http
- https://cloud.google.com/docs/authentication/token-types

The current `nexid-security-staging` project is acceptable for the controlled
pilot, but it mixes a production dispatcher with staging-named infrastructure.
Move the job and its identity into a dedicated production security project
before a regulated enterprise SLA; the API allowlist makes that migration an
explicit two-variable rotation.

## Live verification gate

Run these checks only after the API deployment is Ready and the job exists:

```powershell
# Negative control: no OIDC and no recovery secret must remain unauthorized.
curl.exe -sS -o NUL -w "%{http_code}`n" `
  -X POST "https://api.nexid.lat/internal/webhooks/worker" `
  -H "Content-Type: application/json" `
  --data '{"limit":1}'

# Positive control through the real Cloud Scheduler identity.
gcloud scheduler jobs run $Job --project=$Project --location=$Location
gcloud scheduler jobs describe $Job `
  --project=$Project `
  --location=$Location `
  --format="yaml(state,lastAttemptTime,status,httpTarget.uri,httpTarget.oidcToken)"

$env:VERCEL_ORG_ID = "team_BV1xuY6BnEzGanfok8GAyjZv"
$env:VERCEL_PROJECT_ID = "prj_r0dmVaKogGs8y4NAZ2njCWHhUgLk"
try {
  npx --yes vercel@50.28.0 logs https://api.nexid.lat `
    --since 15m --query "/internal/webhooks/worker"
} finally {
  Remove-Item Env:VERCEL_ORG_ID -ErrorAction SilentlyContinue
  Remove-Item Env:VERCEL_PROJECT_ID -ErrorAction SilentlyContinue
}
```

The negative control must return `401`. The Scheduler run must receive `2xx`,
and the API response/log must show a bounded `claimed` count without an
authentication or origin-guard error. For a complete canary, enqueue one webhook
to a controlled public HTTPS receiver, record its stable `x-nexid-delivery` ID,
and verify exactly one logical event while allowing transport retries.

If the positive control fails, pause rather than delete the job:

```powershell
gcloud scheduler jobs pause $Job --project=$Project --location=$Location
```

Do not weaken the audience/email allowlist, bypass Cloudflare origin
authentication, reuse `ADMIN_API_KEY`, or enable inline delivery to make a canary
pass.

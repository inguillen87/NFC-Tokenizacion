# Tenant webhook delivery runbook

Tenant webhooks use a PostgreSQL outbox. SDK routes only persist a delivery;
they never contact tenant-controlled hosts inline. A private scheduler must call
`POST /internal/webhooks/worker` with `x-internal-webhook-key` and a small body
such as `{ "limit": 20 }`.

## Required production configuration

- Set a high-entropy `INTERNAL_WEBHOOK_WORKER_KEY` only in the API and scheduler.
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

Delivery is at least once. The stable `x-nexid-delivery` header and envelope
`id` allow receivers to deduplicate a retry if the remote accepted a request but
the database acknowledgement failed. A unique `(endpoint_id, event_id)` index
prevents the same logical SDK event from being enqueued twice for one endpoint.

Dead letters are not replayed automatically. Investigate the endpoint and error
code, then cause the source system to emit a new logical event or add a reviewed
operator replay workflow. Migration `0052` intentionally classifies historical
failed inline deliveries as dead letters to avoid surprising customers with old
events during rollout.

# Consumer network: provenance and realtime contract

## Scope

This contract governs the tenant CRM projections served by:

- `/admin/consumer-network/overview`
- `/admin/consumer-network/members`
- `/admin/consumer-network/products`
- `/admin/consumer-network/taps`

The browser never chooses its authority. A persisted, revocable dashboard session is resolved on every request and non-superadmin roles remain bound to the session tenant, even when a different `tenant` query value is supplied.

## Record provenance

Each projected row has one durable classification:

| Mode | Admission rule | Operational aggregates |
| --- | --- | --- |
| `operational_tap` | Exact tenant, batch and tag binding plus current-writer operational evidence for a supported tap event | Included |
| `declared_demo` | Explicit demo source or explicit demo/simulated writer metadata | Excluded |
| `imported` | Explicit imported source | Excluded |
| `legacy_unclassified` | Historical evidence is insufficient; `source=real` alone is not authoritative | Excluded |
| `mixed` | The underlying aggregate contains more than one incompatible provenance class | Excluded |

The API returns counts for every class. Demo, imported, mixed and legacy records remain inspectable but do not enter production KPIs, freshness or heatmaps. A UID is a product/tag reference, never a person identity.

`operational_tap` describes persisted digital evidence for a provisioned carrier. It does not prove physical presence, contents, origin, custody or complete product authenticity.

## Live update path

For a real tenant session with `events.read_sensitive`, the dashboard opens the tenant-scoped SSE endpoint. A valid snapshot or event refreshes the server-rendered CRM projection. While SSE is healthy, periodic polling is stopped.

If SSE is unavailable, or the authorized role may read the CRM but not sensitive event detail, the page reconciles the durable API projection every ten seconds while the tab is visible. Refresh requests are debounced and coalesced. Demo sessions never open the production stream or the production polling path.

Session-resolver outages remain a distinct `503` outcome with `cache-control: no-store`, `retry-after` and `x-nexid-auth-outcome: session-resolver-unavailable`. The UI preserves the session and does not reinterpret that outage as zero activity.

## Release evidence

The disposable PostgreSQL E2E harness registers the four production handlers, creates persisted sessions for tenants A and B, seeds operational and declared-demo events, and asserts that neither tenant can select the other through a query override. It captures the production SQL and runs bounded `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` in a read-only transaction.

Required gate before promotion:

```text
npm run test:e2e:ephemeral:safety
npm run test:e2e:ephemeral
```

The DB-backed gate must use a new, empty, non-production PostgreSQL database through `NEXID_E2E_DATABASE_URL`. The harness refuses `DATABASE_URL`, remote/production-looking targets, non-empty databases and unconfirmed execution.

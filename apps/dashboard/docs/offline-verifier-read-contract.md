# Offline verifier dashboard read contract

The dashboard must not call `POST /admin/offline-verifier/sync` while rendering a page. That operation ingests or reconciles offline events and is a mutation, so using it as a list endpoint would make a read produce side effects.

Until the API exposes a tenant-scoped read contract, the Offline dashboard renders an explicit unavailable state and performs no upstream request.

Required API contract for a future implementation:

- `GET /admin/offline-verifier/events?tenant=<slug>&limit=<n>&cursor=<cursor>`
- authorization and tenant binding derived from the validated admin session, never only from the query string
- stable cursor ordering and a bounded page size
- read-only behavior with no ingestion, reconciliation, counter updates, or audit side effects
- response fields limited to non-sensitive operational metadata needed by the dashboard

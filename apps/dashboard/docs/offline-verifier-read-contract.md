# Offline verifier dashboard read contract

The dashboard must not call `POST /admin/offline-verifier/sync` while rendering a page. That operation ingests offline events and is a mutation, so using it as a list endpoint would make a read produce side effects.

The Offline dashboard reads the dedicated method on the same resource:

- `GET /admin/offline-verifier/sync?tenant=<slug>&limit=<n>&cursor=<cursor>`
- authorization and tenant binding derived from the validated admin session, never only from the query string
- `supplier:offline_verifier` permission for tenant-admin reads
- stable `(received_at, id)` cursor ordering and a page size bounded to 100 rows
- read-only behavior with no ingestion, reconciliation, counter updates, or audit side effects
- response fields limited to server-issued IDs and non-sensitive operational metadata needed by the dashboard; no client-supplied event ID, captured URL, raw NFC/SUN payload, UID/SUN hashes, metadata JSON or key material

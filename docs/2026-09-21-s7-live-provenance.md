# S7b dashboard .30: operational provenance through live updates

Baseline: published dashboard `.29`, runtime `b5c942c9`, documentation head
`74022b957a2f458ebe4930dba748d870ee220602`. This branch changes only the
dashboard deployment; its API/web copies are not release candidates.

Required paired API: `2026.09.21-api-s7-consistency.2`, runtime
`1aef6c3827459bb2ddbc2b4907ffc6dda239b30a`. The public website remains on its
independent `2026.09.20-web-history.1` release.

The physical reader now requires explicit `dataProvenance=operational_tap` in
addition to tenant, TAP type, production transport and real event origin.
The API computes that classification from persisted tenant/batch/tag and writer
evidence and carries it through snapshot, push and the broker allowlist. Older
messages without evidence default to unclassified. They cannot add physical
rows, increase physical counts or overwrite saved location/TT evidence.

General history and security streams remain available, including unbound or
invalid attempts and imports. Operational invalid and replayed results remain
visible in the physical reader without being presented as valid authentication.
No new TT receipt is fabricated from a live update.

The paired API also uses consented approximate observations for analytics
geography. User event 715 (2026-09-21 22:42:23.856Z, counter 107) has a valid
opened TT receipt and a browser observation received at 22:42:29.678Z with
150 m accuracy. Read-only checks confirmed the candidate selects that
observation and retains original IP evidence. It is client-reported location,
not independently certified GPS. No raw URL was replayed or NFC configuration
changed.

Acceptance combines actual PostgreSQL API tests, actual dashboard conversion
tests for mixed snapshots/deltas and the retained recall/browser regressions.
These are complementary tests, not a claim of end-to-end physical hardware and
authenticated production-browser certification. Deployment provenance and final
check results follow after promotion.

# S7: operational TAP provenance and consented analytics geography

This increment starts from the independently published API history branch
`246e6a2b98f1a4c7a0d7934c2d8f67c226b47f00` (runtime `a3e51ffd`). It does not
replace the separately released dashboard or public website with this branch's
older versions. The API release marker is `2026.09.21-api-s7-consistency.1`.

## Behavior

- Physical TAP reads require operational provenance, exact tenant/batch/tag
  binding and current-writer or canonical-operation evidence. A bare historical
  `source=real` flag cannot certify provenance. Operational invalid/replay events
  remain visible; cryptographic verdict and provenance are distinct.
- CRM and the physical reader share the event-provenance SQL classifier.
  Declared simulation, imports and unclassified history do not become physical
  operational activity. No consumer association or marketing consent is inferred.
- Analytics projects validated `post_tap_location_observation` geography at read
  time. It requires explicit boolean consent, an allowed approximate browser
  source, a WGS84 coordinate pair and accuracy between 150 and 50,000 metres.
  Coordinates are rounded to three decimals. Missing browser locality remains
  unknown instead of borrowing IP labels. Invalid observations fall back to the
  existing event evidence.
- Maps, country/city breakdowns, geographic filters, journeys and feed use this
  projection. Original canonical event evidence, reader counters, keys, TTStatus,
  and NFC configuration are not modified. No schema migration is introduced.

The existing country-filter scope is preserved: trend, device signals, city
breakdown and feed apply it; overall KPIs, map overview, country buckets and
journeys remain the existing full-range views. This increment does not claim
identical denominators between those views when a country filter is selected.

## User-provided physical evidence

The user reported scanning an opened NFC label, then performing another scan and
pressing the approximate-location sharing action. Read-only production checks
correlated these reports with:

| Event | UTC timestamp | Counter | Result | Browser observation |
| --- | --- | --- | --- | --- |
| 713 | 2026-09-21 22:23:44.927 | 58 | VALID_OPENED | absent |
| 714 | 2026-09-21 22:23:47.248 | 59 | VALID_OPENED | absent |
| 715 | 2026-09-21 22:42:23.856 | 107 | VALID_OPENED | approximate, consented, 150 m |

All three have a valid CMAC, operational event evidence and correct tenant
`demobodega` / batch `DEMO-2026-02` binding. Counters are per tag and these rows
are not presented as a single unit's continuous counter sequence.

Event 715 has a durable bound TT receipt with `enc_decrypted`, length 2 and
`VALID_OPENED`. Its consented observation was measured at 22:42:28.016Z and
received at 22:42:29.678Z. The capability scope is
`signed_fresh_event_capability`; the location remains client-reported, not
independently verified GPS. Original `edge_ip_approx` evidence is preserved.
The observation's copied event time has whole-second precision; exact receipt
identity is separately checked against the canonical event's full timestamp.

The candidate's actual SQL was also executed read-only through the authorized
Neon connector: 713/714/715 classify as operational and event 715's analytics
projection selects the consented coordinate pair with 150 m accuracy. This is
candidate-query evidence against production data, not an authenticated browser
acceptance result. No NFC URL was replayed and no database row was changed.

## Validation and publication

Publication results, immutable deployment identity and final checks are recorded
below after completion. Local PostgreSQL fixtures use a disposable loopback-only
`nexid_e2e_s7` database. Production credentials are excluded from the focal runner.
The workflow preserves test/build logs bound to the candidate Git SHA.

The SDK sensor regression now checks the actual public-contract arguments with
the TypeScript parser instead of requiring a deleted intermediate variable.
It still verifies that SDK sensor readings stay separate from canonical NFC
history. Analytics static contracts follow the shared location projection;
the PostgreSQL harness executes the handler and its real SQL, with inert local
authorization and physical-reader adapters.

Still separate: a new closed-label hardware read after the relevant deployment,
authenticated visual acceptance of the live analytics screen, and business
acceptance of a real recall case. Digital NFC verification does not certify
product contents, origin, custody or ownership.

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
authenticated production-browser certification.

## Published and checked

- Dashboard runtime `07d976c0cc5d007011aadc9f20ceef0f0e325aee`, deployment
  `dpl_DLPj4Ziq6yZ37RTbGb1kFJLajHTj`, is active on `app.nexid.lat`.
  Immutable URL: `https://nexid-dashboard-4y43wy3x0-marcelos-projects-c26aa499.vercel.app`.
- Paired API deployment `dpl_FW7iYAcxgmcobW6DWqJCfsUEisxZ` is active on
  `api.nexid.lat`, with the required `.2` release and runtime SHA above.
  Both canonical aliases and served release markers were independently checked.
- [Dashboard CI 35666309883](https://github.com/inguillen87/NFC-Tokenizacion/actions/runs/35666309883)
  passed: 972 unit/contract cases; the two optional browser skips were followed
  by an explicit 6/6 browser run; real-PostgreSQL recall workflow 7/7 and four
  desktop/mobile light/dark accessibility cases also passed. API CI 35666186951
  passed 1,296 build-suite cases, 134 focal cases and 10 PostgreSQL cases.
- Staged `.30` notes were inspected at desktop and 390px widths. Staged and
  production anonymous session requests returned 401. Production public notes
  passed all six browser cases in `artifacts/production-browser/report.json`,
  with no client errors, horizontal overflow or axe violations.
- Error-log checks for both deployments returned no error entries in the
  checked window. Private analytics with the user's session and a new physical
  scan on the final published pair remain separate acceptance steps.

Dashboard rollback baseline: `dpl_A2USGA9rTyrtWEeLCyZ2BaSqoKqW` (.29).
API rollback baseline: `dpl_9drfo3eYYH76sirXbQShxbXpENrQ`. Revert dashboard
before API if reverting the pair; `.30` intentionally rejects legacy frames.
Later documentation commits are not new runtime deployments.

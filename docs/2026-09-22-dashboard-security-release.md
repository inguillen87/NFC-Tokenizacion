# Dashboard .34: security maintenance and reproducible map workers

Continuation base: `b599b752acad7306fc76aa6a1aa2a554a9100427`.
Application baseline: `d2758dce665ef0c320e08df3808d529b574b94ce`.
Release marker: `2026.09.22-dashboard.34`.

## Access and scope

Desktop Commander now executes on the authorized Windows host. The installed
Vercel CLI successfully lists the existing team and NexID projects. This is a
working alternative to the conversation connector's failed OAuth scope; no
account, plan, project, domain or permission was changed to obtain access.

The original application candidate was built from native Git source on Vercel,
but a complete dependency audit then rejected it. It must NOT be promoted.
The prior green dashboard acceptance did not execute this dependency audit.
The existing audit is now mandatory in the branch's dashboard acceptance.

## Dependency remediation

Exact direct versions: Next 16.3.6, MapLibre GL 6.4.1, Nodemailer 9.1.1,
sharp 0.35.4, PostCSS 8.5.23 and csv-parse 7.0.2. Transitive overrides pin
nanoid 3.3.18, adm-zip 0.6.1 and qs 6.16.0. Existing image/CSS override
references remain intact. No audit exception, suppression or grant was added.

Next's existing nested override initially retained an inconsistent installed
version despite updated workspace specifications. Exact lock/manifest regression
tests caught the mismatch. The explicit root `next["."]` override now agrees
with all three application manifests. The lock was resolved and installed again.

## Map worker compatibility, not just compilation

MapLibre 6 has separate ESM worker and shared modules. The observed Next output
renamed both assets but left the worker's relative shared-module import unchanged.
A worker that cannot fetch its sibling module cannot finish GeoJSON processing.
Compilation alone was therefore insufficient evidence for this upgrade.

Both Next configurations now prepare a fixed, same-origin, versioned worker pair
from the exact installed package. The original module filenames, bytes and license
are preserved. All three existing map consumers configure that worker before
constructing a Map. Generated vendor assets remain ignored and are reproduced by
config evaluation, including builds that disable npm installation scripts.
No external CDN, tile provider, API key, additional service or paid call was added.

## Executed local validation

On Node 24.15.0, from the isolated checkout:
- Dashboard: 1,097 passed, zero failures; two pre-existing optional browser skips.
  The total includes 21 new dependency and asset regressions.
- Dashboard typecheck, production build and secret custody gate passed.
- Web compatibility snapshot: 433 tests passed and production build passed.
  This is not validation or deployment of the independent latest Web branch.
- The existing enterprise dependency gate passed with zero production high/critical
  findings and no temporary development allowlist entries. This is not a claim
  that all low-severity advisories or every enterprise gate have been cleared.
- Existing support browser harness: 296 checks / 24 views passed.
- Actual CRM component harness: 547 checks / 36 views passed.
- Real MapLibre software-WebGL harness: 29 checks / 4 views passed; repeated with
  the worker assets served by an actual Next production server also passed.

The map test exercises worker loading, GeoJSON heat/circle layers, zoom/resize,
literal popup text and removal of adjacent unsafe attribution attributes. The
CRM screenshots were inspected at mobile/light and desktop/dark widths; the
software map capture was also inspected. All fixtures are explicitly synthetic.
They do not certify a physical TAP, customer data or authenticated production.

The auxiliary API build attempted from this dashboard snapshot stopped on an
unchanged supplier-console source assertion in `supplier-security-contract`.
That check expects the older inline high-impact export expression. Its API test
and target dashboard component were not altered by this increment. This branch
is not an API release: the independent API candidate requires its own security
patch, test/build and paired acceptance before production. No gate was bypassed.

## Release boundaries

The dependency and worker updates are one coherent dashboard release increment;
shared manifests and Web map wiring are kept compatible, but the Web/API/executor
are NOT published from this dashboard tree. Do not use an indiscriminate merge.
Migration 0112 still requires the user's specific confirmation through the Neon
completion workflow. No production SQL, NFC keys, SUN/SDM logic, TTStatus,
tenant authority, business messages or domain promotion was changed here.

A Vercel candidate is not a promotion receipt. CI and the final deployment must
identify the exact committed .34 source. The earlier d2758dc candidate lacks
these security fixes and must not be substituted for this release.

## Verified GitHub and Vercel result

Runtime source `702829269506758dbf1f969d0627a71083a80c87` was pushed by a normal
fast-forward to the existing continuation branch. GitHub Actions run
`35796306175`, job `106976286736`, completed successfully on its first attempt.
Logs reconfirm 1,097 passed / 0 failed / 2 optional skips, the dependency gate,
typecheck/build, secret custody, support 296/24, CRM 547/36 and both map runs
29/4. One map run used a real Next production server for worker/shared assets.
The local full audit additionally reports eight low-severity findings, zero
moderate/high/critical. They are not claimed resolved by this maintenance.

Vercel deployment `dpl_Dg4e2MbGoLiG6FjPxLGRYuYxqwrt` reached READY with the exact
native Git SHA above and `autoAssignCustomDomains: false`. An authenticated
Vercel CLI read returned the committed .34 release marker. Both deployed worker
files were downloaded and matched the locked-package SHA-256 digests recorded
in `releases/2026-09-22-dashboard.34.candidate.json`.

The project production targets remained the prior API and Dashboard deployments.
The production migration ledger was rechecked and still has zero 0112 rows.
No promotion or database completion operation was called. The .34 manifest is
the current dashboard candidate record; the earlier support/CRM preflight
inventory is historical and must not substitute d2758dc or .33 for this source.
The private local QA Next server was stopped after its tests completed.

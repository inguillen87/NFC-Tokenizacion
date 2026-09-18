# Passport Studio — final acceptance of the active production combination

Verified 2026-09-18, 09:46 Argentina time.

## Active production artifacts

- API: 2026.09.18-api-passport.1, commit 27b06f634ce1743cec8fe5a84747d3506816adf6,
  deployment dpl_EqNnXJS8uUuv3cncaP9d8kGUmNxP, api.nexid.lat.
- Dashboard: 2026.09.18-dashboard.10, commit 604f05b911998faf742a58ddb87498f718742922,
  deployment dpl_99XFTVuVgZGbM2N8RMDj1NzWu6zS, app.nexid.lat.
- Web unchanged: commit ac9171b2e683c5d4ae766945f96acf8e3d2bdbc0,
  deployment dpl_HrXDR9Gf29e4xzPCVk8WndfKB9rP, nexid.lat.

Concurrent work deployed the newer UI while integration was being tested. That
UI was retained rather than overwritten by the alternate integration candidate
cd841c15. The live API runtime was compared file by file; its only runtime delta
from the concurrent release was the legacy editor fix: remove a reference to an
obsolete/nonexistent editorial table, use editorial_managed and retain an atomic
old-config condition. The corrected compatible API was promoted and verified.
The schema was reconciled by conditional function-hash upgrade 0105, not by
resetting or replacing unrelated concurrent data.

## User-visible closed workflow

Open Rollos y productos -> existing lot -> Producto -> Abrir Passport Studio.
Enrollment is an explicit per-lot confirmation. It saves an initial working draft
without changing the currently visible product. Studio provides identity/agro/
documents editing, mobile preview, changes and persisted history.
Saving survives page reload and does not publish. Submission freezes the reviewed
content until correction or independent approval. Creator, last editor and
submitter cannot self-approve. Publishing requires its own permission and confirms
a durable receipt. Another revision can be prepared afterward; copying historical
content prepares draft work, never immediate publication.
No real customer lot was enrolled, no customer content published and no account
permissions changed as part of this acceptance. A second authorized person is
required for the review workflow. The opt-in screen warns that the old direct
editor, including advanced wine fields, will be blocked on that lot. Existing
values are preserved; the first Studio editing slice covers general identity and
agro, not every sector-specific field.

## Tests of the exact active UI + API combination

The UI worktree was temporarily checked out at the exact live commit 604f05b9.
The installed project Next.js/React runtime called the actual API service/policy
from 27b06f63 through a loopback-only synthetic HTTP/session fixture and a real
disposable PostgreSQL 17.10 cluster. No production credentials or customer data.

Full browser result: passed. Four visual cases (1440px/390px, light/dark), no
uncaught JavaScript errors or horizontal overflow, no serious/critical axe
findings in the tested editor surface. Keyboard/scroll contrast issues found in
integration were addressed. This is not a WCAG certification.

Verified end to end: explicit enrollment, save, no DB reads on section changes,
lost response after actual DB commit, same-identity retry without a duplicate
revision, saved draft after reload, self-approval unavailable, a distinct reviewer
approving, real local public update with technical sentinel fields preserved,
new revision, historical content restored into a draft without republication,
and read-only viewer restrictions. The receipt and actual DB state were asserted.

Separately, 17 real-PostgreSQL service integration cases passed, including competing
edit winner, tenant separation, request mismatch, legacy write rejection and
injected failures rolling back history/draft/public changes together. The API
editorial test suite passed 47 checks and its full application build/regressions
passed. The alternate UI integration branch had 841 passed / 2 skipped; that
number is not mislabelled as the exact live UI unit suite.

After deployment: six public release-notes browser cases passed. API health 200,
SUN without arguments 400, release marker 200, dashboard notes 200 and unauthenticated
session 401 were checked. The private passport URL redirects to login and returned
no private editor markup. These public checks are not a customer physical TAP test.

## Costs, scope and evidence limits

Vercel's Neon integration still reports Free/free_v3. No plan, compute size, SDK
paid service, tag key or SUN cryptographic verifier was changed. A database check
after the guarded schema upgrade showed zero enrolled batches, zero drafts/history/
receipts and unchanged batch/tag counts. Editing and previewing add no polling.
Normal explicit DB reads/writes remain subject to the current plan; this is not
a monetary hard cap or zero-cost guarantee at any traffic volume.

The active slice is not all S4: no private-document vault, automatic document/legal
verification, per-language parallel public versions or automatic translation.
Editorial locale is a single document's metadata. The preview is not NFC/precinto
evidence. History is persisted but not immutable against database administrators.
A privileged published state or content hash is not a digital signature.

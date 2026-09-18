# S4 preparation — editorial comparison and mobile preview (not deployed)

Dashboard baseline: `c421fb1ce0610d91d3cb2cb2436d5ad722403178`.
Feature branch: `codex/nexid-passport-review-ui-2026-09-18`.
Related API policy: `78c457fbecbdb49cac3d7468040859fc9f63ab1e`, also not activated.

## Implemented increment

A reusable React comparison view for the existing Passport Studio plan, not a
second CRM or a fictional live passport. It is intentionally read-only until
there is a verified persisted editorial workflow.

- Published-reference versus candidate comparison, grouped into product identity,
  agro, documents, declared guidance and support. Added, removed, changed and
  unchanged fields remain distinct. A removal never silently disappears.
- Local text search checks both versions. Group filtering and “only changes”
  perform no queries and preserve the before/after context.
- A partial mobile preview of the candidate, separate from the comparison on a
  narrow screen. It is labelled as an unpublished editorial preview, not a TAP.
  No authenticity, seal, consent, GPS or transaction result is invented.
- A comparison report on explicit user request and with export authority passed
  from the server. The JSON states applied=false and proofOfApproval=false;
  it does not contain tenant/batch UUIDs, users, keys or physical event records.
- Reset of local filters/report resources when the tenant, batch, revision or
  observed snapshot changes. No browser storage and no private report URL retained
  after the component is removed.
- Light/dark surfaces, mobile switching, native keyboard controls, visible focus,
  reduced-motion styles and literal rendering of user-entered text.

## Contract and isolation

`buildEditorialReview(raw, authority)` rejects wrong tenant/batch IDs, unknown
field names, unexpected object shapes, malformed state/revision/date values,
unsupported templates/languages, unbounded lists/text and unsafe URL syntax.
It only projects the existing public identity and agro-dpp-v1 field names.
No UID, CMAC, TT status, read counter or raw SDM field is permitted in the DTO.
The UI does not import the Node crypto policy into its client bundle.

This is a presentation guard, NOT authentication or a signature check. The read
and export flags and expected tenant/batch must be resolved by the future server
adapter. The browser cannot be the source of review authority. `approved` is
shown as a declared source state, not verified independent approval.

All links are displayed as text in the comparison. The preview does not fetch
external images or documents; its packaging symbol is explicitly schematic.
It does not trigger location consent, analytical events, SDK calls, DB reads,
approval or publication. Public support fields in the report may contain the
business contact information deliberately entered for the product.

## Checks actually executed

- 29 pure contract tests: passed, zero failures/omissions. Node 22.16.0.
- Strict standalone TypeScript check of the presentation model: passed with
  TypeScript 5.8.3, ES2022 + ES2023/DOM libraries.
- React TSX and model transpilation: passed without syntax diagnostics.
- Committed browser harness: four cases (1440px/390px, light/dark) passed in
  Chromium using the locally installed compatibility renderer React 16.0.0 /
  React DOM 16.0.1. These are NOT the dashboard's installed React 18 dependencies.
  The harness reports applicationRuntimeCertified=false and fullApplicationBuild=false.
- Browser checks covered filters, preserved old/new values, keyboard focus,
  mobile preview, download content, export denial, scope reset, literal malicious
  markup rendering, no horizontal overflow, no requests and no writes.

The exact runtime mismatch is intentional disclosure, not a compatibility claim:
a complete Next.js build, the existing regression suite, rendering with the
project's locked React version and integration into the dashboard remain required.
No WCAG certification, physical TAP verification or production validation is claimed.

The UI test harness accepts already installed TypeScript, React UMD and Playwright
paths. It does not install packages or change the repository lockfile. Its default
React lookup uses the application's dependencies; a temporary compatibility
renderer can be explicitly supplied and is recorded in the report. The harness
uses setContent with local assets and blocks every network request.

## Required next integration

1. Verify live project access and deployed revisions; reconcile later work first.
2. Complete the scoped, durable draft/review/publication API and atomic history
   from the API policy branch. The legacy product editor must not bypass review.
3. Construct the public review DTO from authenticated server reads, not request
   body role flags or unverified browser approvals.
4. Mount `PassportEditorialReview` inside the existing batch dossier once the
   above data source exists. There are deliberately no disconnected approve or
   publish buttons in this component.
5. Run the full dashboard build and functional tests with its actual React/Next
   runtime, add localization of the review controls beyond Spanish, then stage,
   verify and promote through the existing Vercel flow.

No route, existing component, permission, workflow, release marker, database,
NFC key, tag or paid resource was modified. The Windows device was offline and
the direct Vercel project call returned 403 during this increment. Nothing in
this branch is described as live. This does not close the entire S4 sprint.

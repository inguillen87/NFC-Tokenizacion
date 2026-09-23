# Supplier operator workbench — continuity candidate

Date: 2026-09-23. Base: `8e15ab05df05ad9b165436eb6754b6e0a27f6a3b`, branch `codex/nexid-s9-ticket-deadline-20260922` (dashboard .42 source).
Candidate branch: `codex/nexid-operator-workbench-20260923`.

## Scope and implementation

Continue the existing assigned-operator workflow rather than rebuilding from the obsolete default branch. No production release claim is made by this document.

- Loaded-record counters link to filters: all, NexID review, waiting for company, prepared. Counters remain scoped to the last confirmed response, before search. A failed load is not presented as zero assignments. Truncation remains explicit.
- Review-first, oldest-activity and recent-activity sorts; stable reference tie-break; accent-insensitive, multi-term search over title, tenant slug, reference and construction only. No notes or new data sources are indexed.
- Per-row next action, complete selectable reference, UTC activity timestamp, active-request treatment, clear read-only mode, responsive metric cards and resettable empty search state. Reduced-motion preference, labelled controls and existing focus-to-detail behavior are retained.
- Presentation priorities do not constitute approval, an SLA, stock availability, manufacturing status, NFC programming or permission to mutate. Unknown states require confirmation; only submitted pending/answered records count as awaiting NexID review.

## Authorization and concurrent reads

The previous `refresh()` catch treated a list-level 401/403 like a transient network problem and left the selected detail mounted. This change distinguishes authorization denials from unavailable responses.

- List-level 401/403/404 clears the previous visible scope and selected detail; detail 401/403 clears the scope, while detail 404 withdraws that record.
- A shared read-scope coordinator aborts outstanding list/detail fetches and invalidates their identities before abort callbacks. A transport that ignores abort cannot repopulate a revoked or remounted scope.
- `canInteract()` consults that coordinator synchronously; the review is suspended during list or detail reads. A new send cannot race a list refresh in the same event loop.
- Refresh/open are still blocked while a write is saving or its receipt is uncertain. Review-originated access withdrawal keeps the review mounted, preserving its existing explicit exit and uncertain-write handling. No mutation or idempotency contract is changed.
- Initial list and deep-link detail reads are sequenced so the review's initial history load is not suppressed by an outstanding parent read. A transient list failure still permits the separately authorized deep-link lookup; an access denial does not.
- Existing parent keyed remount on authenticated scope change, operator contract validation, server authorization and tenant isolation are retained.

## Validation performed in this session

Local source slice, Node 22.16.0:

```sh
node --experimental-strip-types --test apps/dashboard/tests/supplier-assigned-workbench.test.mjs
```

38 tests passed, zero failures. Covers state/count/filter/sort/search behavior, read-only next actions, immutable inputs, invalidation, ignored abort, scope A-B-A, and denial classification. TypeScript transpilation of the modified component and new helper reported zero syntax diagnostics. This is NOT a full application typecheck or browser test.

The existing `Dashboard ticket and CRM acceptance` push workflow is extended to this candidate branch only, keeping its immutable action pins, read-only token, exact-dependency installation, full dashboard checks and existing synthetic browser suites. No deployment or database step is added. Its results must be checked on the candidate commit; configuration alone is not evidence of a passing run.

## Release gates and follow-through

Before merging/promoting, require complete dashboard typecheck, unit suite, build, secret checks and browser acceptance. Specifically exercise technician read-only mode; desktop/mobile and light/dark views; initial deep-link history; dirty/uncertain messages; revoked list access; late responses; complete-reference search; and truncated responses.

Production Clerk/operator identity, Neon migration state and a real authenticated technician scenario remain separately unverified here. Do not mark the existing .42 migration/release gates resolved on the strength of these UI tests. Do not change production release metadata, apply SQL, deploy production or grant broader permissions as part of this candidate.

Next implementation block remains the separately authorized technical-preparation workflow. It must not be silently enabled for scoped technicians by UI alone; preserve the distinction between commercial request, technical order, inventory reservation, physical programming and cryptographic proof.

## Desktop Commander continuation — 2026-09-23

The candidate was checked out in an independent Windows worktree at `9ecefe0`. No other Codex worktree or production schema was modified.

### Additional implementation and regression proof

A new browser test reproduced a stale-detail defect: a successful list refresh removed a revoked assignment from the inbox but left its selected commercial detail visible. Refresh now independently reauthorizes the selected record in the assigned namespace, using the same abort/identity guard. A record-level denial closes the detail without dropping other authorized assignments. A truncated list does not imply revocation: a separately authorized off-page detail and its unsent draft remain intact. Revalidation performs no business write.

The browser suite now also exercises metric filters, accent-insensitive cross-field search, stable activity ordering, keyboard activation, empty-search recovery, and list-level 401/403/404 without invented zero counters. Four additional views include 320 px and light/dark desktop layouts.

The general CI blockers were reproduced and corrected without relaxing policy: the supplier security assertion now requires BOTH superadmin and `supplier_pack.export`, while public web tests explicitly load the existing `tsx` dependency on Node 20 as well as Node 24. Workflow bootstrap assertions now normalize Windows/Unix line endings; both forms are tested.

### Confirmed local validation

- Node 24.15.0, exact lockfile installation with lifecycle scripts disabled.
- Dashboard: typecheck and production build passed; 1,286 unit tests passed, zero failed, two existing skips.
- Public web: 433 unit tests passed, zero failed; production build passed.
- API: complete `build:api`, including its security suites, passed. SDK check/build/package-consumer smoke passed. Executor build and 106 tests passed.
- Focal supplier-security and workflow-bootstrap run: 26 passed, zero failed.
- Actual-component browser suite: 195 checks, 22 views, passed. The new revocation case failed before the runtime correction and passed after it.
- Reviewed the 320 px light and 1,440 px dark workbench captures. All browser identities and HTTP responses are synthetic; no physical tags or real employee sessions are certified.
- Dependency audit and secret custody checks passed. Generated API/SDK build outputs are excluded from this change.

### Release boundary

Canonical readback in this session still reported dashboard `.41` and API `supplier-requests.2`; neither advertises the assignment protocol. The paired API `.3` candidate documents additive migrations 0115/0116 as tested on a schema-only branch, not applied to production. These remain separate release gates, not outcomes of the UI tests above. New exact-commit CI and any staged deployment must be recorded in PR #375 before claiming integration or publication. No production release marker is advanced here.

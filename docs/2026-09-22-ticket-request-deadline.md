# S9: bounded ticket requests without false write confirmation

Base: `35631dc7a3f2dcb0b55a679aa99703c612d46e78`, the documentation-only
successor of tested dashboard runtime `f9801b68edea728d90ab61a5c7dd4c6963ac23ac`.
Branch: `codex/nexid-s9-ticket-deadline-20260922`.

## Reproduced issue

Lookup, history and status writes each scheduled `AbortController.abort()` after
15 seconds but continued awaiting the transport or its JSON body. A transport
that ignored abort could leave the UI pending, or return a late successful write
receipt after expiry. The existing generation guards protected context changes,
not independent settlement of a timeout or cancellation.

The 24 new synthetic regression tests on the unchanged original source produced
6 passes and 18 failures. This is a set of related regression cases, not 18
independent production incidents. No production failure is claimed as observed.

## Implemented correction

A shared deadline covers headers and JSON decoding and settles the caller
independently of transport cooperation. Listeners and timers are cleaned up.
Late replies or rejections cannot re-enter domain state transitions. Responses
arriving after abort are not parsed; their body is canceled best-effort without
waiting for cleanup to complete. Existing generation guards remain in place.

An expired write becomes `uncertain`, not failed or saved. The UI leaves its
submitting state, preserves the reviewed immutable command and idempotency key,
and keeps editing blocked until confirmed reconciliation. An explicit retry uses
the same command. There is no automatic retry, notification or business write.
A client timeout does not roll back or prove absence of a server-side commit.

## Validation executed locally

Node 22.16.0: all 24 new regression tests passed; zero failures, skips or canceled
tests. Source was executed with native TypeScript stripping and a local resolver
for extensionless imports, not the repository's tsx runner. Focused strict
TypeScript checking of the three affected modules also passed.

Original source blob hashes were verified before modification:
- lookup: `0758d513c2c38817169efa69e293bedee873cc99`
- workflow: `45ea51414c2a3271936506c259bf51dbc42be0fb`

The checked-in branch-specific workflow runs the repository's normal dashboard
typecheck, complete test suite, build, secret check and synthetic-component
browser harness on pinned Node 24.15.0. CI execution and result must be read from
Actions for the new exact commit; local focused checks are not a full-build claim.
The workflow uses a standard public-repository runner with no artifact upload or
persistent cache. It neither changes existing enterprise gates nor deploys.

## Boundaries and remaining release gate

No main/API/web merge, database migration, deployment, release-marker rewrite,
production operation, tenant permission, SUN/SDM, TTStatus or key change.
Existing release metadata identifies the prior candidate, not a published release
of this patch. Do not promote an old deployment as containing the correction.

The base candidate document still gates S9 on API migration 0112 approval and
coordinated API/dashboard promotion. Recheck that state against the provider
before any release. This increment does not waive that gate or certify physical
NFC, an authenticated production browser session, or the whole enterprise suite.

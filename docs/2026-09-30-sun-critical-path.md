# SUN: critical-path latency reduction

The canonical NFC validation, rate limits, anti-replay transaction, location persistence and diagnostic snapshot stay awaited. Only the best-effort realtime publication uses Next after(response); non-route callers retain the original awaited behavior. This is not fire-and-forget work outside the platform lifecycle.

Independent post-validation timeline/action reads now overlap the passport read. Sensor scope still waits for the server-resolved passport/tenant. The original 2.5-second presentation deadlines and fallbacks remain. Snapshot support metadata loads concurrently with the other current projections. No cache of a valid verdict, skipped validation, new retry, migration or authorization is introduced.

Server-Timing exposes only fixed sun_total/sun_snapshot duration names, with no URL, token, identifier or coordinate. This provides a basis for measuring the deployed route, not a claim about a physical phone measurement.

Eleven focused tests cover dependency ordering, fallback, projection lifecycle and response semantics. Existing SUN and enterprise regressions remain mandatory. Local results before remote disconnection: 11 focused tests approved; 190/191 SUN tests approved with the remaining static formatting assertion corrected in this candidate. Final CI results must be verified before integration.

This patch was first prepared in an isolated Windows worktree. After the remote device stopped responding, the exact narrow changes were reconstructed through an isolated GitHub preparation job. The job deletes its one-off preparation files from the resulting source tree. No production deployment or feature flag change is performed by that job.

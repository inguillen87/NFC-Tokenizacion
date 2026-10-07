# SUN browser CI budget and preserved failed execution

The browser job budget changes from 30 to 45 minutes. The workflow retains all
22 existing browser suites, exact dependency installation, WEB unit tests,
read-only network tests, TypeScript, secrets checks, production build, isolated
Chromium, the final source diff check and evidence upload. It adds the real wine
demo browser fixture and the post-tap sommelier fixture as suites 23 and 24; no
existing matrix or assertion is reduced. The sommelier fixture covers responsive
light/dark UI, synchronous double submission, HTTP 503 recovery, request
deadline, cancellation and stale response rejection with synthetic responses on
loopback; it does not claim a successful production provider call.

This budget adjustment follows observed execution, rather than a product
performance claim. PR 435 run `37676711856`, job `112981985028`, started at
`2026-10-07T19:44:05Z` and was cancelled at `2026-10-07T20:14:30Z`. GitHub's
failure annotation explicitly identifies the maximum execution time `30m0s`.
The native install/validation and isolated-browser setup steps succeeded.

The candidate was `06fe00b6bf32adf4ef5b8ce8f236fec2c5717601`; actual checkout was
merge commit `a49ed95ae8615656dcbc005953c81a8b2c91b07c`, with candidate tree
`2fb18990818c571532b2aefba760b28e343cd38d` and parents
`126f19de85f2c7237459329130ab792e8e82a35e` / `06fe00b6...`.

The first 21 suites completed without recorded failed assertions. The archive
records the public visual report and its successful lifecycle wrapper at
`20:13:22`; its wrapper has exit code zero. The last brand-motion report is a
checkpoint saved at `20:14:16`, with only 5 of 20 views and 165 written passing
checks. It has no complete-20-view assertion, browser-close completion,
native-hidden completion or lifecycle `runner.json`. These archive wall-clock
timestamps show where the interruption occurred; they are not page performance
measurements. There is no evidence here of a teardown hang.

The 22 report files being present does **not** make this run successful. Its
final required check was cancelled, the last suite is incomplete, and PR 435
was not eligible for publication. No rerun, timeout bypass, fake wrapper receipt
or production promotion was performed by the auditor.

Preserved evidence in the previous isolated worktree:

- Audit: `artifacts/partial-config-notice-20261007/release/pass-or-fail-run-37676711856-IYqoW5/report.json`, SHA-256 `a85f2ebf7d5b283e87b20c6598c4d1a08872068a56369505b53b59b8ff9942b1`.
- Native archive: artifact `11509131734`, SHA-256 `8356e1b7baa7d1f8bf1c08cbdae439e6ae3bd9b64c56d0fc43877037b4a83f51`.
- Extracted manifest: SHA-256 `1479d21471785f0475ebaabeec92cbb3c21fdcb137db0153c504368af96e3036`.
- Sanitized native log evidence: SHA-256 `8df1771b107991a39dcadf52a4e94fa4e75b9d3fc06f6a138c840ada8fdbce8f`. Raw job logs and credentials were not stored.

The frozen PR 435 source and its release configuration remain unchanged. A new
candidate must pass the complete 24-suite workflow, including the full final
brand-motion matrix and its actual successful wrapper, plus its independent
Preview and production gates. This document does not claim those new gates have
passed. API, dashboard, NFC contracts and provider configuration are unaffected
by this workflow change.

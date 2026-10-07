# SUN partial company options notice

Candidate WEB release `2026.10.07-web-partial-company-options-notice.1` builds on
published WEB `126f19de85f2c7237459329130ab792e8e82a35e`.

When the company configuration is unavailable, SUN now explains the partial
failure even if claim or warranty remains authorized by its independent policy.
The customer can continue with the displayed options. The notice is localized in
Spanish, Portuguese and English and uses the existing status region styling.

A valid empty publication and an unpublished company configuration retain their
existing messages. Demo does not show a live loading failure. A wholly
unavailable configuration shows one notice rather than a duplicate. Purchase,
contact and promotional permissions are not expanded; the resolver, navigation
handoff, API, dashboard, database and NFC anti-replay contract are unchanged.

This increment does not add a configuration retry or refresh the NFC URL. Full
recovery would need a shared projection across the SUN widgets and server
decisions; refreshing just one hub would not recover the complete passport.

## Validation completed locally, 2026-10-07

- The regression was reproduced before the fix. 29 focal tests pass, including
  unavailable and malformed configurations with independent claim/warranty,
  empty/unpublished/demo states, blocked risk, snapshot without a handoff,
  localized copy, and fail-closed reads.
- The full WEB unit suite passes: 1,047 tests, zero failed, skipped or cancelled.
- WEB TypeScript passes with `--noEmit --incremental false`.
- The local tenant-action browser fixture passes 691 checks across 112 views,
  including 24 partial-configuration cases at 320, 390, 768 and 1280 pixels in
  light and dark themes. It reports zero accessibility violations, overflow,
  browser exceptions, external requests or geolocation calls. Four screenshots
  at 320/390 pixels were visually reviewed.

The browser report also retains 56 color-contrast checks marked incomplete by
axe, without a waiver. The four screenshot reviews do not replace a full human
accessibility audit.

Browser scope: actual React components and CSS, synthetic API, loopback server
and inert Next navigation fixtures. This is not a production Next/RSC browser
run, customer session, physical TAP, real claim, OTP delivery or real business
write. Local report: `artifacts/partial-config-20261007/browser/report.json`.

CI, a fresh production build, Preview and production acceptance remain separate
release gates. Updating this candidate manifest does not publish it.

Other pending work is unchanged: usable PIN entry and specific claim errors,
shared configuration recovery, and verified WhatsApp OTP delivery. Environmental
features discussed for Valle Secreto remain a commercial proposal, not this
release's functionality.

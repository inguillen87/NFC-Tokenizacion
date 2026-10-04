# API dependency remediation: local candidate

This candidate removes the development dependency path to `braces` by updating
the WEB and dashboard Tailwind compiler to pinned `4.3.3` with its matching
PostCSS plugin. It starts from API candidate
`ea90bfe931c1fab22ebf16dc2e14bdf7faaea5db` on the separate branch
`codex/nexid-meta-api-dependency-remediation-20261004`.

The remediation is prepared for review and integration into API PR414. It has
not been pushed or deployed. The existing PR414 checkout was left unchanged.
API, WEB and dashboard publication remain separate operations; this older API
checkout must not be used to publish WEB or dashboard.

## Scope and compatibility

- All 372 runtime package artifacts retain their version, resolved URL and
  integrity from the API base. API and executor manifests are unchanged. Some
  lockfile peer/optional metadata changes with the development graph.
- API routes, authentication, session handling, NFC verification, authorization,
  database schemas and migrations are unchanged. No credentials, provider
  configuration, real messages or customer/database writes were used.
- WEB and dashboard receive PostCSS/config/import-header changes and mechanical
  utility aliases on their own existing templates. Their existing global CSS
  bodies and WEB build scripts are preserved; the newer WEB style generator or
  newer WEB/dashboard product implementation is not imported.
- Shared compatibility CSS preserves v3 colors, defaults and sibling spacing
  with namespaced utilities. Explicit line heights preserve inherited text
  sizing. Shared buttons constrain motion to motion-safe and reset individual
  translate/scale properties for reduced motion. Outline, shadow, blur, radius
  and shrink aliases follow the compiler's renamed utilities.
- Tailwind 4 changes the frontend browser floor to Safari 16.4+, Chrome 111+ and
  Firefox 128+. The compatibility styles do not add support for older browsers.
  See the [official Tailwind upgrade guide](https://tailwindcss.com/docs/upgrade-guide#browser-requirements).

The shared source was ported from dependency experiment freeze
`6b7b82f4657592943eb23ea9a245fa089fab3281f1891f94aaedb440cad3b961`.
The lock hash is
`3bd8a8c720e04cbd0eb973f82c006a7a75f6b6739ca0b478d9efee681e48faa5`;
shared compatibility CSS hash is
`3243904978d0572071ca2008cd8c0cefd9ef48ef4b7545473318138dd8ba0adf`.

## Local verification

The worktree owns a physical `node_modules` directory installed with
`npm ci --ignore-scripts --no-audit --no-fund`, Node `24.15.0` and npm `11.12.1`.
Application credentials were removed from child environments, npm user/global
configuration and cache were isolated, and application environment files were
checked absent. Shared dependency junctions were not modified.

Prisma `5.22.0` was generated locally using previously checksum-verified official
engine copies. The generated engine and data model match the existing verified
API candidate. Source schema hashes are unchanged; the generated schema differs
only in whitespace. No database connection was configured or requested.

| Check | Result |
| --- | --- |
| Full npm audit | 0 high, 0 critical, 8 low; `braces` absent |
| Production npm audit (`--omit=dev`) | 0 findings; `braces` absent |
| Enterprise dependency audit gate | PASS; unchanged empty allowlist |
| Authored `npm run build --workspace=api` | PASS; Prisma prebuild, regressions and default Next compiler |
| API regressions | 1,701 passed; 35 suite summaries; 0 failed, skipped or cancelled |
| Next `16.3.6` default Turbopack production compilation | PASS |
| Separate API TypeScript `--strict --noEmit --incremental false` | PASS |
| Preserved WEB docs/wallet source-contract tests | 6 passed |
| Secret custody gate | PASS; 3,541 file candidates checked |
| Code/dependency binding before and after API verification | Identical |

The verification source fingerprint is
`9bf1e32517bf01e8e6614a8e4e8212369b511046fd86607c7726be968bd7ca72`.
Its file scope is recorded in the binding receipts. This documentation was
added after code validation and is outside that fingerprint; the full Git tree
is recorded in the post-commit receipt.

## Evidence and limits

Exclusive local evidence directory:
`artifacts/meta-api-dependency-remediation-20261004/run-gJfl4e/`.
The accepted summary is `api-verification-verified.json`; related receipts are
`audit-gate.json`, `runtime-graph-verified.json`,
`prisma-ready-verified.json`, `final-freeze-port-verified.json`, and the package
build/source-binding logs. The first summary remains as a historical diagnostic:
its parser expected TAP `#` summaries, while Node 24 emitted `ℹ` spec summaries.
The corrected receipt reads the same successful build log; the suite was not
rerun. Initial strict schema-byte and whole-globals equality diagnostics are
also retained beside their corrected, scoped verification receipts.

These checks certify a local API candidate build, not production runtime,
deployment, provider activation or human acceptance. The mechanical WEB and
dashboard conversions are source preparation only. Their full builds, visual
acceptance and publication are not certified by this API-branch evidence; the
separate WEB release must pass its own final gates and browser review.

The existing simultaneous consumer magic-token/OTP use race remains outside
this dependency change. This candidate makes no additional anti-replay or
authentication guarantee.

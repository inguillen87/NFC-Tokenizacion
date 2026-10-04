# Tailwind 4 dependency remediation — local draft

This isolated change removes the actual `braces` package and all lockfile dependency edges that reach it by migrating WEB and Dashboard from Tailwind 3.4.19 to Tailwind 4.3.3 with the official `@tailwindcss/postcss` 4.3.3 compiler. The existing EnterpriseSecurity audit policy passes with its empty allowlist. Full audit still reports eight preexisting low findings; production-only audit reports zero findings. These audit results establish dependency remediation, not runtime safety or production acceptance.

Status: dependency remediation implemented; local synthetic functional, motion and resource checks pass. The final strict rendered comparison retains one small unresolved raster failure, and the browser-floor/integration gates remain open. No merge, push, deployment, production/customer write, exception approval, browser-policy relaxation, or database/schema change occurred in this experiment.

## Source and recovery

- Experiment: `C:/Temp/nexid-tailwind-remediation-20261004`, branch `codex/nexid-tailwind-remediation-20261004`.
- Exact base: `7de6eb6c20f006e9c39186bd12e651ebca1cd003`. The detached baseline at `C:/Temp/nexid-tailwind-baseline-20261004` uses that same source and its own Tailwind 3 installation.
- Source snapshot SHA-256: `c0721202a4703aacfeb99a5f923bd734d3d982891d9b62fcd1f244fe3a4c84db`. This identifies the recorded tracked files and browser helpers plus the new shared compatibility stylesheet before this documentation was added. The local Git commit contains the complete reviewed change.
- Lockfile SHA-256: `3bd8a8c720e04cbd0eb973f82c006a7a75f6b6739ca0b478d9efee681e48faa5`.
- Shared compatibility stylesheet SHA-256: `3243904978d0572071ca2008cd8c0cefd9ef48ef4b7545473318138dd8ba0adf`.
- Audit policy SHA-256 remains `76ab7c4cbd5c84a49da1a0689d2ce190f4e5684220a6061831b1ed60ae19e9f6`, with `entries: []`.

All receipts, failed earlier experiments, screenshots, probe source, dependency paths, file hashes and validation manifests are under `C:/Temp/nexid-braces-advisory-investigation-20261003-0121`. `final-source-snapshot.json` binds every recorded file; `validation-ledger.json` lists individual receipt hashes. Original WEB/API candidates were preserved.

## Compatibility changes

Both applications use explicit official theme/preflight imports and unlayered utilities to preserve the established utility cascade. Legacy brand configuration and the explicit `[data-theme="dark"]` selector remain. WEB declares `postcss-selector-parser` 6.1.4 directly because its existing public-style splitter had relied on Tailwind 3's transitive installation of that parser.

Mechanical utility aliases preserve Tailwind 3 sizes and outline behavior: `outline-none` → `outline-hidden`, `shadow-sm` → `shadow-xs`, `blur-sm` → `blur-xs`, `backdrop-blur-sm` → `backdrop-blur-xs`, `rounded-sm` → `rounded-xs`, and `flex-shrink-0` → `shrink-0`. Existing sibling spacing uses `v3-space-*` names with the original visible-sibling selectors and reverse variables. Namespacing prevents Tailwind 4's built-in spacing rules from adding a second margin. Fifteen used spacing values and the two reverse variants are defined. No dynamic/arbitrary spacing names were found in this source.

The shared stylesheet preserves the original default ring, border, placeholder, enabled-button pointer and dialog behavior, plus 242 established palette values. Six measured line-height additions preserve the previous rendered heights: four SUN labels at 16px, Demo Lab's optional label at 20px, and the shared theme toggle at 16px. The light footer summary explicitly keeps its measured `#475569` color because Tailwind 4 `@apply` no longer replicated the higher-specificity rule emitted by the old compiler.

The shared Button gates hover/press translation and scaling with `motion-safe`; reduced motion also resets individual `translate` and `scale`. Its old transform reset alone did not suppress Tailwind 4's separate transform properties. Normal hover/press motion remains visible.

The SUN mobile dock's explicit opacity/transform transition also includes the individual `translate` property. Its browser contract records actual opacity/translate transition events and intermediate animation progress during normal scroll restoration; the existing reduced-motion checks still require zero transition.

WEB's generated SUN stylesheet scans its existing SUN subtree, library sources, shared UI, layout and explicit root components. Non-SUN routes retain full source scanning and the full stylesheet. Existing style-family splitting, route inheritance and MapLibre worker packaging remain. Browser checks cover SUN → portal → SUN stylesheet transitions. Frozen CSS/JS budgets and release workflows were not changed.

## Validation

| Check | Result | Receipt under the evidence directory |
| --- | --- | --- |
| Fresh full npm audit | High 0, critical 0, low 8 | `tailwind4-audit-full-final.json` |
| Fresh production-only npm audit | All findings 0 | `tailwind4-audit-production-final.json` |
| Existing EnterpriseSecurity policy | Pass, no temporary allowances | `tailwind4-enterprise-gate-final.json` |
| Lockfile graph | No braces package or dependency edge; root/API/executor/core/config/api-client/UI workspace manifest entries unchanged | `lock-delta.json`, `tailwind4-dependency-paths-final.json` |
| WEB unit/source contracts | 885/885 pass on final source/helper snapshot | `tailwind4-web-tests-final.json` |
| Dashboard unit/source contracts | 493/493 pass | `tailwind4-dashboard-tests-reviewed.json` |
| Production builds | WEB and Dashboard pass, including TypeScript | `tailwind4-web-build-motion.json`, `tailwind4-dashboard-build-palette.json` |
| Actual spacing compiler/browser comparison | 30/30 pass: default/reverse and hidden siblings | `spacing-parity-reviewed/report.json` |
| Actual shared Button motion browser check | 6/6 pass: reduced and normal hover/press | `button-motion-reviewed/report.json` |
| Final full-page rendered baseline comparison | 31/32 pixel pairs pass; all dimensions match; one strict raster check remains open | `rendered-comparison-motion-v2/report.json`, `rendered-comparison-motion-v2/pixel-regions.json` |
| Earlier comparison before the dock transition addition | 32/32 pixel pairs pass at the same RGB threshold of 16 | `rendered-comparison-reviewed/report.json` |
| Same-source controls | Six baseline pairs and six final candidate pairs pass; no raster variance reproduced | `same-source-baseline-control/report.json`, `same-source-candidate-control/report.json` |
| Detailed footer diagnosis | 59/59 brand nodes have identical captured attributes, styles and boxes; the diagnostic capture passes pixels | `rendered-footer-svg-768-diagnosis/svg-state-comparison.json`, `rendered-footer-svg-768-diagnosis/report.json` |
| Public CSS parity and route inheritance | 42/42 pass, eight size/theme views | `public-budget-browser-motion/report.json` |
| SUN functional and accessibility contracts | 1570/1570 pass; eight states across four widths/two themes plus availability cases; 29 saved accessibility records | `sun-mobile-browser-reviewed/report.json` |
| Marketing navigation browser helper | 378/378 pass, eight views | `marketing-browser-reviewed/report.json` |
| SUN navigation browser helper | 243/243 pass, eight views plus actual normal-motion interpolation | `sun-navigation-browser-motion-v2/report.json` |
| Additional WebKit smoke | 66/66 pass, 12 views of SUN, consumer login and home | `webkit-smoke-v2/report.json` |

The full-page comparison uses real local Next production builds and the same synthetic SUN snapshot, 320/390/768/1440px widths and light/dark themes. SUN is compared with native disclosures closed and opened. All 16 SUN pairs and eight Demo Lab pairs pass the strict pixel check. Page dimensions match; no box difference exceeds the comparator's 1px tolerance, and no measured spacing difference remains. Computed CSS strings still differ for equivalent transform/translate, radius, transparent shadow and color representations; string identity is not claimed. The comparisons observed zero browser exceptions, automatic GPS calls and write requests.

The final comparison retains 16 pixels over threshold on one row, x55–70/y5620 in home 768px dark, at the unchanged footer mark's blurred 3D depth edge. The detailed diagnosis captured equal DOM/SVG attributes, styles and geometry and passed its own pixel check; neither same-source control reproduced variance. These observations do not prove that the residual is renderer variation. The threshold was not relaxed and the mark was not altered to force a pass. An earlier run on the final runtime also retained 21 pixels at the footer mark in home 320px light (`rendered-comparison-motion/report.json`); both failures are preserved. Strict final visual acceptance remains open.

Six fresh mobile browser contexts per build recorded SUN resource `encodedBodySize`: baseline CSS 137754 bytes / JS 324029 bytes; migration CSS 129860 bytes / JS 324046 bytes. Existing ceilings remain CSS 146697 / JS 341354. This establishes the byte budget; it makes no load-time or speed claim.

SUN functional/accessibility, marketing navigation, spacing, Button and WebKit receipts were collected before the final dock transition addition. That last change was then checked with the refreshed SUN navigation, full-page comparison, public CSS route/budget, build and unit receipts listed above. Older source snapshots are retained beside the final binding. Publication still requires the entire suite on the integrated release source.

Earlier failures remain available: initial high audit, initial missing parser and old compiler assertions, Windows CRLF map-radius matcher, overlapping spacing rules, color drift and light-footer mismatch. The Dashboard radius contract now accepts CRLF or LF, requires a nonempty matched block, and still requires exactly one zoom expression. The map source was unchanged. The first WebKit probe used the access-choice `/login` route while expecting an email field; the corrected probe checks `/login?consumer=1`. The first dock normal-motion fixture incorrectly waited 720ms after scrolling down, beyond the dock's existing 650ms restoration timer; the corrected fixture reads after three frames and retains the hidden/interpolation assertions. These were fixture mistakes, not product behavior changes.

## Remaining release limits

This WEB base does not contain the later login-continuation mapper/release changes. Any integration onto the newer WEB candidate requires fresh tests, browser contracts, CI, Preview/stage checks and exact source/deployment binding. The Dashboard source here is the WEB checkout's base snapshot; it is not the currently published Dashboard revision `4d976…`. Its build/source contracts do not certify the published Dashboard or all tenant screens.

[Tailwind's official browser floor](https://tailwindcss.com/docs/upgrade-guide#browser-requirements) is Safari 16.4+, Chromium 111+ and Firefox 128+. [Next's default supported browser list](https://nextjs.org/docs/architecture/supported-browsers) includes Firefox 111+. Thus Firefox 111–127 compatibility would narrow unless the accepted project browser matrix permits the new floor. No explicit repository browser policy was found and no authorization to lower browser guarantees is inferred. Firefox and minimum-version browsers were not tested. The WebKit receipt is Playwright WebKit 26.5 on Windows, not physical Safari/iOS acceptance.

Physical iPhone/Android, physical NFC/GPS, authenticated production/customer flows, real provider delivery and human acceptance remain unverified. The residual strict raster comparison, Linux/native-package CI installation and current exact release gates must pass before publication. No result here authorizes merge or deployment.

[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) reported no patched braces version during this investigation; [upstream fix PR 72](https://github.com/micromatch/braces/pull/72) remained open. The dependency migration is a concrete alternative to the unresolved owner exception, with the browser-floor decision and integration gates still open.

# Dashboard operational navigation sprint — 2026-09-08

## Published artifact

- Release: `2026.09.08-dashboard.3`.
- Code commit: `76af8ac57406d4154aa60868df2d39c810cf79ff`.
- Deployment: `dpl_ECUCqweEA2Z37GsQK9tTVEVh83au`.
- Immutable URL: https://nexid-dashboard-l1zk2gz8r-marcelos-projects-c26aa499.vercel.app
- Public URL: https://app.nexid.lat
- Previous production artifact / rollback target: `dpl_EVfhN7b5UVs7VCXmnSUMBw3CaLRK` (`523e830376e91c7492f4d97efb890deab33fbf56`).
- Isolated worktree: `dashboard-tap-navigation-2026-09-05`; unrelated root worktree changes were not included.
- No API, database, credential, permission or polling changes. No physical events synthesized.

## Delivered

1. Workspace sections are URL-backed. Operations and engagement survive reload/back/forward; returning to CRM removes stale view/section parameters while preserving tenant scope. Tenant-bound sessions cannot select global-only presentation tabs; server permissions remain authoritative.
2. Map rail button returns from TAP view to the actual map, scrolling and focusing its controls without resetting its camera. Reduced-motion preferences are respected.
3. Operations prioritizes permitted actions, source-backed KPIs and the company table. Removed arbitrary aggregate readiness and the chart comparing heterogeneous counts. Restricted destinations have no link; resources and per-stage counts are progressively disclosed. Expected denial of optional tokenization is not presented as failure of the whole operation.
4. Physical TAPs have one confirmed-empty state with scoped history access. Unknown/unavailable/demo states remain separate. Data-bearing states have useful filters, reset actions and evidence disclosure without hiding important warnings.
5. Events consumes `filter=risk` over the authorized response using the existing canonical predicate. Filters/retry preserve tenant/source/range/tag/lot/result. Muestra limit is explicitly 250, not a complete historical total. Authentication is a separate column; displayed dates explicitly use Argentina UTC−03:00.
6. Local event-page mobile QA caught grid min-content overflow stretching the filter form. Fixed single zero-minimum grid track and constrained children; only the table scrolls horizontally.

## Verification

- Dashboard suite: **706 tests; 704 passed; 2 optional browser tests skipped; 0 failures**.
- TypeScript: passed. Git whitespace check: passed.
- Remote production-target build: READY; metadata matches code commit/release. CLI connection returned exit 1 after build output, but independent deployment inspection confirmed successful build. No duplicate deployment was created.
- Built with `--prod --skip-domain`, inspected, then promoted. Immutable artifact URL was protection-gated; it was not treated as successful public rendering evidence.
- Public `/release.json` independently confirmed `.3`, unchanged API dependency and no migrations after promotion.
- Local browser: actual interactions for TAP → Map (focus on Acercar mapa), Operations → Engagement → browser Back, Operations reload, demo risk form submission (2/6), scoped return to CRM.
- Responsive local browser: requested 390×844 override; effective CSS viewport reported 348 px because of browser scaling. Screenshots inspected in light/dark, keyboard focus and local horizontal table scroll. Explicit viewport override reset afterward.
- Real authenticated production Balmec: 88 events in selected 30-day sample; risk filter returns 52/88. The existing risk predicate can overlap authentication (24 verified messages in filtered result); its definition was not changed in this sprint. VALID_OPENED with a tamper reason must not be interpreted as proof of fraud.
- Real production: physical last-24h query confirmed empty. UI correctly links historical events and does not claim no tags exist. No new physical-device TAP was performed in this sprint; realtime ingestion of a new device event is not certified here.
- Real production: TAP → Map focuses Acercar mapa; Operations URL preserved on reload; three permitted operation actions and four restricted destinations; optional tokenization error removed for this restricted session. Screenshots inspected clear/dark.
- Browser error log after production reload: empty. Vercel error-log query for the deployment returned no logs; this is not a claim of comprehensive observability or configured drains.

## Next bounded fixes (not completed)

1. Onboarding / SDK destination decisions: `src/app/(app)/onboarding/page.tsx`, `src/components/pilot-launchpad.tsx`, `src/app/(app)/sdk-vision/page.tsx` offer links that the destination may deny. Pass server-derived permission decisions; do not broaden permissions to fix navigation.
2. Campaign drafts: template and assistant actions can replace dirty title/body without discard confirmation (`loyalty-campaigns-client.tsx`). Preserve drafts and block replacement during saves. Sending/approval must not be represented as connected without backend support.
3. Marketplace recovery: `saveItem` lacks catch/finally; network or JSON error can leave saving stuck. Preserve inputs, show actionable error, always restore button state.
4. Mobile assistant: constrain total panel height, close with Escape and restore focus; verify small viewport and keyboard-open cases. Floating label still competes with content on narrow screens.
5. Sidebar language: one localized name per destination shared by navigation/search. Several fixed English labels remain.
6. Reconcile KPI window labels and historical company inventory terminology; the current recent-risk KPI and company-wide risk score are separate source-backed measures, not directly comparable. Audit canonical opened/tamper classification before changing its meaning across dashboards.

These are code-audit findings except where browser evidence is explicitly recorded above. They are not completed workflows or full-platform certification.

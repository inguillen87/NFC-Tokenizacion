# Dashboard login and latest-reading navigation — candidate

## Scope

This increment starts from reconstructed Production dashboard baseline
`9d4e8000049cd78e43c6f23f6c335ca1ea2d8218`, matching the source of
`dpl_FksoCWUk8bNnz9GraGwPCESWotCN` (2026.09.04-dashboard-demo.2).

- Company credentials are the first action; fields are blank, labelled, password-manager friendly, and retained after an error. Demo and Google Super Admin remain separate.
- Latest-reading rows open an accessible modal above the application header. Previous/next traverses a stable same-company selection, and closing restores focus.
- Product, date and batch lead the detail; identifiers and recorded technical evidence remain available in an accessible disclosure.
- Demo incidents are read-only and tied to the requested illustrative event. No incident is a confirmed empty response, not an unrelated replay case. Loading, unavailable and empty states are distinct.

## Local validation

- 534/534 dashboard tests passed, including browser fixtures; zero skipped.
- TypeScript passed after component changes.
- Full Next.js application at localhost:3311: 390px and 1440px, light and dark. Company action visible in initial viewport; ordinary demo entry; geographic map loaded; four reading details visited per scenario; previous/next, Escape, focus restoration, no overflow, no JavaScript errors or failed admin API responses.
- Mock-boundary fixtures additionally cover 320px, duplicate submission, retained credential inputs, focus trapping, technical disclosure and pending-to-unavailable incident response. These are not evidence of a real tenant login.
- Local screenshots: C:/Users/guill/AppData/Local/Temp/nexid-dashboard-fullapp-20260905.
- The local server must be accessed through localhost:3311; the IP alias did not match Next's same-origin request URL. The application origin guard was not weakened.

## Explicit non-goals and release gate

No API deployment, database migration, account provisioning, permission expansion or physical realtime certification is included. No admin email OTP was added. Real Balmec account provisioning remains pending a legitimate Super Admin session.

The dashboard session routes, session verification, actual API login/tenant creation and core event contract are unchanged from the Production baseline. Production demo requires explicit `DASHBOARD_BODEGA_DEMO_ACCESS=true` at build and runtime, as in the previous deployment.

Publish only this committed isolated worktree. Verify the Production deployment and release marker before assigning app.nexid.lat; then rerun the demo-only browser flow on that public domain. Keep the previous deployment as rollback. Candidate tests do not establish that a release is already public.

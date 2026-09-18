# Passport Studio in the batch dossier — dashboard.10

Baseline dashboard: c421fb1ce0610d91d3cb2cb2436d5ad722403178.
Required API: 2026.09.18-api-passport.1.
Route: /batches/[bid]/passport, linked from Product in the existing batch dossier.
Isolated branch: codex/passport-integration-ui-20260918-r1.

## User-visible workflow

Optional activation explains that this lot switches from direct edits to reviewed
publication. No current product is changed by activation. The editor includes
common identity, agro content, documents/support, before/after comparison and
history. A phone preview stays alongside the desktop editor, with a mobile toggle.
Its verification and seal states are never fabricated. External images are loaded
only after an explicit action; no location permission is requested.

Save is persisted, survives reload and leaves the public product unchanged.
Review locks content until correction or approval. Creator, last editor and
submitter cannot self-approve. Publication requires a separate capability and
confirmation, then verifies the durable matching receipt before showing success.
A lost response keeps the same attempt identity. No blind automatic retry or
new revision is created on reconciliation. Conflicts preserve local input and
provide an explicit refresh path. Reopening a published/approved revision does
not alter the publication; historical content is restored locally, then must be
saved and independently reviewed again.

Source status distinguishes version-zero initial reference from Studio-published
versions. The UI is Spanish; content locale supports es-AR/en/pt-BR for one document
at a time, not three automatic translated public variants. Other-sector advanced
fields remain in the public config but are not edited by this first Studio slice.
The enrollment warning makes that limitation explicit before choosing this workflow.

## Acceptance actually performed

Project TypeScript and Next.js builds, existing dashboard regression suite,
contract tests and real integrated browser acceptance. Browser used installed
project React, not the earlier React16 compatibility harness. Four visual cases
(1440/390, light/dark) checked overflow and the editor surface with axe; identified
contrast and scroll-focus issues were fixed and retested. This is not WCAG
certification. Real local PostgreSQL backed save, replay, review and publish tests;
no customer data or production mutations were used.

Backend/data exceptions do not render an invented empty draft. Permissions stay
server-resolved; tenant and batch are checked before rendering. Read and write
responses are bounded, with deadlines. Editing, previewing and switching sections
add no DB reads. Manual reload is explicit and warns about local unsaved changes.

Mapa, Centro en Vivo, Modo sala, Uso y estado, logística, SUN móvil and the rest
of the batch dossier remain in place. No increase to Neon limits or paid services.
The earlier readonly comparison module is preserved as source preparation; the
new integrated editor is the operational screen. No disconnected publish buttons
are being advertised as working functionality.

Final validation before commit: dashboard 843 tests, 841 passed, 2 skipped, zero failed. Editorial API suite: 47 passed. Project TypeScript and Next builds passed. Real PostgreSQL integration: 16 checks passed. Integrated browser: four visual cases plus the end-to-end save/review/publication workflow passed. These are pre-production test results, not customer TAP certification.

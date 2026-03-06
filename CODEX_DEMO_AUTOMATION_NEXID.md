# CODEX_DEMO_AUTOMATION_NEXID

Source-of-truth checklist for nexID Demo Mode implementation.

## Demo seed contract
- Command: `pnpm demo:demobodega`
- Idempotent creation/update for:
  - super admin `admin@nexid.lat`
  - tenant admin `admin@demobodega.test`
  - reseller `reseller@partner.test`
  - tenant `demobodega`
  - batch `DEMO-2026-02`
  - 10 fixed demo tags
  - tag profiles + locale metadata (`es-AR`, `pt-BR`, `en`)
  - CRM records (`Lead`, `Ticket`, `OrderRequest`)
  - webhook endpoint disabled by default

## Simulator contract
- Route: `POST /internal/demo/scan`
- Must run through same SUN validation pipeline as `/sun`.
- Event payload must preserve production event shape.

## Demo surfaces
- Dashboard Demo Control Center at `/demo`
- Live map powered by latest events
- Mobile preview updated by same events

## Guardrails
- Keep `/health` and `/sun` public contracts stable.
- Never expose `ADMIN_API_KEY` or KMS key material to browser.
- Use migrations + seed scripts; no ad-hoc manual SQL workflow.

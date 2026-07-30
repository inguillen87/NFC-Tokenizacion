# Demo preview vs. physical NFC authority — 2026-07-29

## Outcome

The public and dashboard DemoLab mobile views are presentation surfaces, not NFC authenticators. They can explain a scenario, show declared demo content, request optional browser location, read historical public provenance and capture commercial interest. They cannot mint a fresh authority capability or execute ownership, warranty or tokenization mutations.

The existing `/sun` path remains the canonical physical flow. It validates the NTAG 424 SUN/SDM message, replay state and diagnostic contract before the server can issue the short-lived fresh handoff consumed by protected actions. This change does not alter NFC keys, counters, CMAC verification, TagTamper handling or the ten existing physical samples.

## Authority contract

| Surface or action | Demo preview | Physical `/sun` flow |
| --- | --- | --- |
| Render a vertical passport scenario | Allowed and labelled simulation | Allowed from the validated tap contract |
| Optional visitor GPS | In-memory preview context only | Subject to the physical flow's explicit policy |
| Historical provenance read | Allowed when BID and UID resolve; never described as a present tap | Allowed according to the validated action matrix |
| Commercial lead | Allowed after the lead server accepts it | Independent from NFC authority |
| Claim ownership | Disabled | Requires a server-issued fresh handoff |
| Register warranty | Disabled | Requires a server-issued fresh handoff and review policy |
| Request Polygon/IOTA execution | Commercial interest only | Requires backend policy, authorization and an independently verifiable chain receipt |

Raw `event_id` or `fresh_token` query parameters are not accepted as a preview execution mode. A future unified mobile renderer must receive an explicit server-constructed capability after validating the same snapshot, trace and freshness contract used by `/sun`; browser-controlled parameters cannot construct that capability.

## Public DemoLab changes

- Shows a persistent `SIMULACIÓN · NO ES UN TAP NFC FÍSICO` banner.
- Labels the scan animation, trust index, investor metrics, route and origins as illustrative.
- Requests low-accuracy geolocation only after an explicit click, rounds it immediately to three decimal places and retains a minimum 150-metre accuracy label.
- Uses a vertical-specific illustrative origin instead of applying a winery location to agro, perfume and pharma scenarios.
- Lazy-loads the 3D map client-side so the heavy runtime is not part of the initial server render.
- Removes calls to `/api/sun-context` and the protected `claim-ownership`, `register-warranty` and `tokenize-request` endpoints.
- Keeps provenance as a read-only historical query and makes tokenization a commercial lead only.
- Uses native forms with email validation and accessible modal focus management.

## Local privacy contract

The browser storage key is versioned as `nexid:mobile:v2:<tenant>:<item>:<pack>`. The persisted value is an allowlist of at most twelve records containing only:

```json
{
  "type": "LEAD_CAPTURED",
  "at": "2026-07-29T00:00:00.000Z"
}
```

Names, email addresses, companies, countries, roles, free text, server error details and coordinates are never written to DemoLab local storage. Legacy unversioned `nexid:mobile:*` entries are purged when the preview loads. Corrupt, disabled or unavailable storage fails open only for the non-authoritative preview UI; it cannot enable a protected action.

The lead form still sends user-provided contact fields to the existing lead boundary after explicit submission. Browser GPS is reduced to an approximate value at collection time and is neither attached to that lead nor persisted locally. A successful UI state appears only after an HTTP success response, and the local event note contains no contact data.

## Dashboard DemoLab changes

- Shows a sticky `PREVIEW · NO ES UN TAP NFC FÍSICO` banner.
- Declares its data source as `backend_reported` or `synthetic_seed`.
- Includes `physicalTapVerified: false` in the displayed preview payload.
- Removes `LIVE TAP`, `SCAN PULSE` and the universal `Lectura NFC validada` claim.
- Explains that even a backend-reported demo event does not prove a fresh physical tap.
- Disables all illustrative and sensitive CTA buttons instead of presenting inert controls as working actions.
- Does not add a second `/sun` route, construct a handoff or call public mutation endpoints.

## Local verification

- Web suite: 236/236 pass.
- Dashboard suite: 254/254 pass.
- Web TypeScript check: pass.
- Dashboard TypeScript check: pass.
- Focused DemoLab and heavy-import contracts: 11/11 pass.
- Dashboard truth-copy contract is included in the complete dashboard suite.

## Evidence still required before an enterprise production claim

1. Run the ten physical NTAG 424 TT samples through a production-like staging deployment and record expected UID, counter, CMAC, replay and TagTamper outcomes without exporting keys.
2. Exercise tap → `/sun` → fresh handoff → each protected action in browser E2E against an isolated database.
3. Verify that replayed, expired, cross-event and cross-action capabilities remain rejected in the deployed runtime.
4. Capture fresh Polygon Amoy and IOTA receipts with independent public verification before showing either network as live.
5. Validate privacy behavior in real browsers, including storage disabled, geolocation denied and legacy-key cleanup.

No deployment, database mutation, physical scan or blockchain publication was performed as part of this local hardening slice.

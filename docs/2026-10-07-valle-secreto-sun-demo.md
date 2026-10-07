# Valle Secreto: SUN meeting demo

Candidate WEB release: `2026.10.07-web-valle-secreto-experience.1`.
Production baseline: `126f19de85f2c7237459329130ab792e8e82a35e`.
The inherited partial-company-options notice from `06fe00b6` is included in this candidate; that earlier candidate was not published.

## Entry and business boundaries

Meeting URL: `/sun?demo=1&profile=valle-secreto&scenario=closed`.
Opening scenario: `/sun?demo=1&profile=valle-secreto&scenario=opened`.
Both support `lang=es-AR`, `lang=en`, and `lang=pt-BR`.

The server resolves the normal SUN entry before selecting the fixed demo profile. NFC parameters, QR entries and snapshot/fresh markers prevent demo selection. Unknown profiles cannot inject producer information into a real result. The scenario is an allowlist; everything except exact `opened` defaults to `closed`.

This is a presentation concept using public information, not a contracted tenant, sold pilot, verified bottle, NFC event, actual sensor deployment, customer location or environmental footprint. There is no fabricated scan timeline or vineyard coordinate. Business CTAs are disabled; the local game and quiz make no API, points, rewards, reservations, CRM or account writes. Real tenant action policy, replay protections, ownership and marketplace safeguards stay independent.

The demo includes the original producer photograph and theme-appropriate logos, a compact vintage/aging/serving sheet, producer links, three educational treasure clues with recoverable wrong answers, clear completion and restart, a local wine quiz, sample sommelier responses, public address search, and attributed sustainability practices. The sample sommelier uses bounded local topic matching; it is not a live cloud model or a live winery conversation.

The general service hub uses readable rows at all SUN shell widths. Tenant-configured quizzes remain tenant-configured. The real post-tap sommelier retains same-origin authorization, server-side event validation and the production provider guard. Transport now has a 12-second deadline covering response headers and body, one request per submit, a synchronous duplicate-submit lock, and abort on context change/unmount. A retry is a separate user action.

## Public sources

- Producer: https://vallesecreto.cl/
- Profundo 2019 sheet: https://vallesecreto.cl/wp-content/uploads/2025/10/10-2025-Ficha-Tecnica-PROFUNDO-2019.pdf
- Original bottle photograph: https://vallesecreto.cl/wp-content/uploads/2026/05/PROFUNDO-scaled.webp
- Experiences, including the physical Mapa del Tesoro: https://vallesecreto.cl/experiencias/
- Estate: https://vallesecreto.cl/campo-y-bodega/
- Sustainability practices: https://vallesecreto.cl/wp-content/uploads/2025/10/Practicas-Sustentables-Formato-VVS-Aprobada_VS.pdf
- Ecocert company certificate: https://www.sustainable.cl/wp-content/uploads/2026/07/2025_CSV_VINA-Y-CABA-VALLE-SECRETO_ES.pdf

The selected sheet reports Cachapoal Andes, vintage 2019, 24 months in new French oak Magnum barrels, service at 16–18 °C, and lamb/game/duck pairings. Blend percentages total 100%. No invented prices, stock, awards, harvest trace, CO2 savings or bottle measurements are presented. The certificate is company-level, with document validity 23 December 2025–23 December 2027; it is not a bottle-level certification. The public vineyard address is searched by text in Google Maps rather than represented as an unsupported precise pin.

Local originals are copied unchanged and credited. Bottle: 64,548 bytes, SHA-256 `9407340154853915a24821904bff328ea9544dc964a4ada18e92bca3fff9fc3b`; dark logo: 5,972 bytes; light logo: 60,963 bytes. No AI-generated brand/product photograph is used.

## Verification and release evidence

Evidence belongs under `artifacts/wine-experience/` and the native CI artifact for the final frozen candidate. Local fixture tests mount real React components and CSS on loopback; they do not certify Next routing, provider delivery, a customer session or physical NFC. A separate real Next/Preview check is required before promotion.

The earlier native run `37676711856` hit its 30-minute maximum during the final brand hero matrix. Its cancelled result and incomplete final matrix remain preserved. The new workflow budget is 45 minutes and keeps the prior suites; it adds the wine and post-tap sommelier checks. No previous failure is counted as a pass.

As of source authoring, this candidate is implemented locally and publication is pending. A separate release receipt must bind final source SHA/tree, native job checkout, all check conclusions, Preview and staged build validations, production promotion and public domain readback. A READY deployment alone is insufficient.

API remains release `2026.10.06-api-otp-provider-rejection.1`; DASH remains `2026.10.06-dashboard-tenant-marketplace.1`. This candidate includes no API/dashboard release, database migration, Meta credential change or WhatsApp OTP activation. Real WhatsApp delivery remains unverified: the NexID test WABA denied creation of an authentication template, and current API Production has no Meta consumer OTP configuration. Production sommelier cloud-provider calls remain disabled by the existing guard.

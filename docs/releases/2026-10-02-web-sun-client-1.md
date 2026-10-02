# SUN client experience — 2026.10.02-web-sun-client.1

## Scope and publication state

Candidate based on repository commit 7682c0ca0340eb60c2042a21cdb6a48a76d2a7b4. At the creation of this record, the published WEB remains 2026.10.02-web-sun-visual.1 (source 07c00b4a08219b0e0bd9b95a86fc0c74e7060eae, deployment dpl_6vgpJa5WXQMA3ZCVDAtPAk8QFVbd). This candidate is not yet published. Publication requires passing local checks, CI, Preview and staged Production verification; an updated observation must close this record.

## Consumer changes

- Passport header uses the landing Ni artwork in a larger local SVG/CSS variant. It reserves its layout, adds no library/font/image request, finishes its entrance in 1.35 seconds and is static for reduced motion and forced colors. The compact loading identity remains unchanged.
- Product and full truthful status precede the explicit optional phone-location request, which is visible before contextual actions on an eligible fresh handoff. Other contextual actions reuse existing fresh/QR/historical/risk and support rules; rearranging them does not grant capabilities.
- Reading evidence and location/time use native keyboard-operable disclosures. Demonstration labels, NFC risk states, notices and an explicit manually declared opening warning remain visible. Location permissions stay explicit and independent.
- The existing producer sensory sheet appears in the product profile before optional reading data. No producer story, origin, award, reward, points or commercial eligibility is fabricated.
- Duplicate profile reading/specification data is progressively disclosed. Unknown timestamps, seal states and source markers remain preserved and translated. A generic profile message no longer claims freshness without its predicate.
- Product imagery has a larger mobile thumbnail, a generous producer photograph and fewer surrounding boxes. The default Balmec demo retains its existing generated wine asset. `/sun?demo=1&visual=rutini` explicitly selects a server-owned photographic reference from Rutini's official site: coherent product/brand identity, linked attribution and no invented sensory scores, distinctions, vintage or cellar conditions. This cannot override a physical NFC, QR, historical result or Demo Lab handoff. The optimized 960 × 640 WebP weighs 31,882 bytes; its source is recorded in public/sun/references/SOURCES.md.
- The optional phone-location panel is compact, keeps declining and retrying available, and displays the server-confirmed city/country, approximate source and map link after persistence. The controller, capability binding, one-shot request, receipt validation and permission behavior are unchanged. No new phone metadata is collected.

## Boundaries

WEB only. API, dashboard, shared packages, NFC verification, anti-replay, permission decisions, backend contracts and database schemas are not changed. No new program of points or loyalty is introduced. No physical TAP certification is included. Existing brand opt-in and published offers retain their individual gates.

Audit of the separately published API (`9c10e5c50912d58ee9e1177fa5b7849c2211b69b`) and dashboard (`4d976d385e75d1e9139ebc44f5ba820eaaebb591`) confirms existing post-tap consented-location projection into events, physical taps, SSE and analytics, with the source alias already recognized by the dashboard. An initial mismatch report was based on the older dashboard tree in this WEB checkout and was corrected after examining the actual published blobs. No dashboard fix is included or necessary for that alias. Code audit does not prove a new physical TAP, persisted location or an authenticated tenant's live CRM acceptance. The observation's new timezone is not separately projected into CRM.

## Evidence plan and results

Contemporaneous measurement uses six GET-only synthetic inaccessible views: three native and three CPU ×4 / 150 ms latency / 200000 bytes per second. It is not a physical TAP, valid NFC verification, GPS or full consumer journey measurement. Raw samples and settings are preserved; no causal speed claim will be made from isolated timings.

Local responsive/light/dark/ES-EN-PT/keyboard/reduced-motion checks and Preview acceptance passed for the first candidate. The first staged deployment was not promoted: the strict comparison reported 10 of 40 views with RGB channel deltas of 1 in header edges/shadow and a product-panel edge. Semantic checks passed, but this did not satisfy the frozen raster gate. Inspection found a global important theme gradient and inherited header backdrop blur. The candidate explicitly owns a solid theme control and removes that unnecessary header filter plus the summary's decorative blurred glow. A second staged comparison eliminated those differences but retained three dark 320px views with 14 RGB-delta-1 pixels around/below the Ni frame, outside any photo. That failed deployment also remains unpromoted. The remaining decorative exterior frame shadow is removed; its inset highlight, Ni artwork, finite entrance and reserved geometry remain. Native photo bytes and comparison criteria are unchanged. These source changes require fresh CI, Preview and staged verification before publication. Evidence is retained under artifacts/sun-client-experience-20261002; earlier .1 evidence and failed observations are not overwritten.

## References informing the interaction

[Identiv consumer goods](https://identiv.com/industry-segments/retail-consumer-goods/) supports NFC entry into product information and integrated brand services. [Scantrust / Baia's Wine](https://www.scantrust.com/case-studies/anti-counterfeiting-and-product-traceability-for-baias-wine/) presents producer information with QR and app-based authentication in that case. [Kezzler / FRISO](https://kezzler.com/friso-infant-formula-driving-consumer-experiences/) connects QR product information to optional program participation. These inform progressive information and optional next steps; their claims and metrics are not attributed to NexID.

## Rollback

The previously promoted WEB deployment dpl_6vgpJa5WXQMA3ZCVDAtPAk8QFVbd remains the rollback target. API and dashboard must independently retain their previous provider/project/source bindings before and after publication.

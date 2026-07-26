# nexID Vertical Demo Packs

This bundle contains reusable demo packs so the platform can prove value before physical tags arrive.

## Included verticals
- events-basic
- wine-secure
- cosmetics-secure
- pharma-secure
- agro-secure
- luxury-basic

## How to use in product
1. Put each `*_manifest.csv` under `apps/web/public/demo/<slug>/` for public download.
2. Put each `*_manifest.csv` and `*_seed.json` under `apps/api/prisma/demo/<slug>/`.
3. In `/demo-lab`, add:
   - "Use built-in demo pack"
   - Vertical selector
   - CSV uploader
   - JSON uploader
4. When user chooses a pack, the app should:
   - create demo tenant (or attach to existing)
   - create demo batch
   - import manifest
   - import metadata JSON
   - activate all tags
   - generate demo scans/events
5. Show result in:
   - live map
   - mobile preview
   - events feed
   - CRM lead/order flow

## Positioning notes
- NTAG215 packs are for low-cost, high-UX scenarios (events, campaigns, invites, lightweight traceability)
- NTAG424DNA TagTamper packs demonstrate dynamic-message validation, replay-risk controls, declared traceability and reported TT status; they do not authenticate the physical product by themselves

## Important
The packs are demos. The real flow should later accept the actual supplier manifest for production tags.


## Events / Party Access (Basic)
- Folder: `events-basic`
- Recommended tag: `NTAG215`
- Manifest: `events-basic_manifest.csv`
- Seed: `events-basic_seed.json`
- Narrative: Tap check-in, anti-duplicate attendance validation, VIP upgrade and live engagement for one-night events.
- Why NFC over QR: Better than QR/photo/email because the credential lives on a physical NFC item, the UX is tap-only, and each scan can be counted and time-stamped. Static QR screenshots can be duplicated and forwarded trivially; a simple NFC tag still gives a physical carrier plus read counter/UID-based control, although it is not cryptographically secure like 424 DNA.

## Winery / Bottle Passport (Secure)
- Folder: `wine-secure`
- Recommended tag: `NTAG424DNA_TT`
- Manifest: `wine-secure_manifest.csv`
- Seed: `wine-secure_seed.json`
- Narrative: Validate the tag's NFC/SUN message, show declared bottle and cellar data, report TT state, and open a premium digital passport. These signals do not prove the bottle, contents, cork or capsule are physically authentic or intact.
- Why NFC over QR: NTAG 424 DNA TagTamper provides AES-128 cryptography, SUN messages and a reported tamper-loop state. The backend can validate the dynamic message, detect replay risk and record reported TT changes instead of trusting a printable image. A correctly integrated TT loop can support review of a closure, but it is not physical-proof by itself.

## Cosmetics / Premium Cream (Secure)
- Folder: `cosmetics-secure`
- Recommended tag: `NTAG424DNA_TT`
- Manifest: `cosmetics-secure_manifest.csv`
- Seed: `cosmetics-secure_seed.json`
- Narrative: Validate the tag message, flag replay risk, show reported TT state and unlock digital routine, warranty review and CRM onboarding; no tap proves that the product is genuine or unopened.
- Why NFC over QR: NTAG 424 DNA adds dynamic-message evidence and replay controls. When the TT loop is correctly integrated, a reported state change can trigger review of the closure or security seal; it does not independently prove the package or contents.

## Pharma / Cold Chain & Message Evidence (Secure)
- Folder: `pharma-secure`
- Recommended tag: `NTAG424DNA_TT`
- Manifest: `pharma-secure_manifest.csv`
- Seed: `pharma-secure_seed.json`
- Narrative: Validate medicine-pack tag messages, present declared provenance and record reported supply-chain events with anti-diversion signals; the carrier does not prove physical chain of custody.
- Why NFC over QR: For regulated workflows, NTAG 424 DNA adds cryptographic message checks, controlled redirects and scan-event logging. Those controls strengthen the digital evidence attached to the pack but do not certify its contents or physical journey.

## Agro / Input & Traceability (Secure)
- Folder: `agro-secure`
- Recommended tag: `NTAG424DNA_TT`
- Manifest: `agro-secure_manifest.csv`
- Seed: `agro-secure_seed.json`
- Narrative: Validate agrochemical or seed tag messages, present declared distribution-lot events and open technical sheets on tap; this does not authenticate the product or its contents.
- Why NFC over QR: A secure tag plus the API gateway provides dynamic-message evidence, replay-risk signals, reported scan heatmaps and a tap-to-open technical dossier. Physical-product conclusions still require packaging controls and investigation.

## Luxury / Event Gift & Brand Story (Basic)
- Folder: `luxury-basic`
- Recommended tag: `NTAG215`
- Manifest: `luxury-basic_manifest.csv`
- Seed: `luxury-basic_seed.json`
- Narrative: Use inexpensive NFC to unlock a connected brand story, collection registration or campaign landing page without presenting the basic tag as anti-cloning evidence.
- Why NFC over QR: Better than printed QR when you want a cleaner premium packaging surface and a more deliberate tap interaction. It is not anti-cloning-grade security, but it improves UX and can still serialize campaigns via UID/counter-based backend logic.

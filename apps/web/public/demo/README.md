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
- NTAG424DNA TagTamper packs are for anti-fraud, authenticity, premium traceability and tamper status

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
- Narrative: Tap-to-verify bottle authenticity, cork/capsule integrity, digital passport and premium cellar data.
- Why NFC over QR: Better than QR because the 424 DNA TagTamper provides AES-128 cryptography, SUN authentication and tamper-loop status, so the backend can validate originality and seal integrity instead of trusting a printable image. The tag can also carry a premium product passport and feed reseller/consumer experiences in real time.

## Cosmetics / Premium Cream (Secure)
- Folder: `cosmetics-secure`
- Recommended tag: `NTAG424DNA_TT`
- Manifest: `cosmetics-secure_manifest.csv`
- Seed: `cosmetics-secure_seed.json`
- Narrative: Authenticate premium skincare, prove unopened state and unlock digital routine, warranty and CRM onboarding.
- Why NFC over QR: Better than QR because high-margin cosmetics are frequently counterfeited and opened. TagTamper can indicate if the closure or security seal was opened before sale, while the backend can detect duplicate scans and suspicious regions.

## Pharma / Cold Chain & Authenticity (Secure)
- Folder: `pharma-secure`
- Recommended tag: `NTAG424DNA_TT`
- Manifest: `pharma-secure_manifest.csv`
- Seed: `pharma-secure_seed.json`
- Narrative: Authenticate medicine packs, prove chain-of-custody and support patient-facing verification with anti-diversion signals.
- Why NFC over QR: Better than QR/photo/email because regulated products need stronger provenance. NFC provides a physical identity layer on the pack; 424 DNA adds cryptographic checks, controlled redirects and event logging for every scan.

## Agro / Input & Traceability (Secure)
- Folder: `agro-secure`
- Recommended tag: `NTAG424DNA_TT`
- Manifest: `agro-secure_manifest.csv`
- Seed: `agro-secure_seed.json`
- Narrative: Authenticate agrochemical or seed products, track distribution lots and expose technical sheets on tap.
- Why NFC over QR: Better than QR because field products often suffer relabeling or diluted/grey-market substitution. A secure tag plus API gateway gives supply-chain evidence, scan heatmaps and a tap-to-open technical dossier.

## Luxury / Event Gift & Brand Story (Basic)
- Folder: `luxury-basic`
- Recommended tag: `NTAG215`
- Manifest: `luxury-basic_manifest.csv`
- Seed: `luxury-basic_seed.json`
- Narrative: Use inexpensive NFC to unlock a brand story, authenticity-lite experience, collection registration or campaign landing page.
- Why NFC over QR: Better than printed QR when you want a cleaner premium packaging surface and a more deliberate tap interaction. It is not anti-cloning-grade security, but it improves UX and can still serialize campaigns via UID/counter-based backend logic.

# Offline NFC validation without overpromising

This note defines how nexID should explain offline NFC behavior for QR, NTAG213/215, NTAG 424 DNA and NTAG 424 DNA TagTamper.

## Short answer

Yes, NFC tags can be read without internet. NTAG 424 DNA can also generate a fresh cryptographic SUN/SDM response without internet because the chip computes it internally when powered by the phone or reader field.

But the trust verdict is not automatically offline in a normal browser flow. A public mobile web passport still needs connectivity to reach the nexID backend and validate SUN/SDM, replay, tenant, batch and policy. Tamper/open-state validation applies when the TagTamper variant and physical loop are actually integrated.

## What works offline

| Capability | Offline? | Notes |
| --- | --- | --- |
| Read NFC memory or URL | Yes | A phone or reader can read an NFC tag without mobile data. |
| Generate NTAG 424 DNA SUN/SDM dynamic response | Yes | The chip computes the dynamic value when energized by the reader. |
| Advance tap counter / dynamic URL behavior | Yes, for configured secure tags | The counter and cryptographic response are chip-side behavior. |
| Store a scanned URL for later validation | Yes | A custom app can queue the URL/event and send it when internet returns. A normal browser may only open the URL once it has connectivity. |
| Full nexID web passport verification | No, not in a normal browser | The browser needs internet to load the page and ask the backend for the verdict. |
| Instant local verification | Only in closed systems | Requires a trusted app/reader with validation logic and securely provisioned keys or derived keys. |
| Warranty, ownership, NFT, Polygon claim, CRM write | No | These require backend policy and connectivity. Queue first, finalize later. |

## Two supported offline patterns

### 1. Deferred validation

The user taps the product without signal. A custom app or device stores the scanned URL, UID-derived reference, timestamp and context. When connectivity returns, nexID validates SUN/SDM server-side and applies replay, tenant and policy checks. If TagTamper is used, nexID also evaluates the open-state evidence.

Use this for:

- rural logistics
- wine cellars
- field operators
- scan audits that can tolerate delayed verdicts

Do not call the product fully authenticated until the backend validates it.

### 2. Closed-loop local verification

An industrial reader or controlled mobile app can validate locally if it has the right cryptographic validation code and securely provisioned keys or derived keys.

Use this for:

- mine, warehouse or cold-chain checkpoints
- access control with private readers
- field service workflows

Rules:

- never put tenant master keys in an ordinary consumer app
- prefer derived, scoped or device-bound keys
- record local verdicts and sync later for audit
- keep ownership, warranty and certificate claims backend-controlled

## Important distinction by tag type

NTAG213/215 can be read offline, but they are not the same as NTAG 424 DNA. They can identify a tag or open a URL, but they do not provide the same dynamic SUN/SDM anti-replay proof.

NTAG 424 DNA is the correct family when nexID needs cryptographic freshness, dynamic URL proof and replay detection. NTAG 424 DNA TagTamper adds physical open/tamper-state evidence only when the tamper loop is physically integrated into the seal or package.

## Commercial wording

Safe wording:

> NFC reading works without internet. NTAG 424 DNA can generate a fresh cryptographic response offline. TagTamper adds open-state evidence only when the physical loop is integrated. In the standard consumer web flow, nexID finalizes the trust verdict when the phone reconnects to the backend. For industrial offline use, a controlled reader or app can validate locally if it has securely provisioned validation keys.

Avoid:

- "Fully authenticated offline in any browser"
- "NFT or ownership works offline"
- "No backend needed"
- "All NFC chips have the same offline security"
- "We can put master keys in the consumer app"

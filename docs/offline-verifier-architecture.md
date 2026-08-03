# Offline verifier architecture

This note explains how nexID can support offline NTAG 424 DNA validation through a controlled mobile app or a dedicated reader without overpromising browser-based offline authentication.

## Executive answer

Building an offline verifier is possible, but the hard part is not reading NFC. The hard part is safe cryptographic validation and key custody.

NTAG 424 DNA can generate fresh SUN/SDM evidence without internet because the tag performs AES-128 cryptographic operations when it is powered by the reader field. A normal browser still needs connectivity to load nexID and receive the final server verdict. A controlled app or reader can validate locally only when it has securely provisioned validation logic and scoped keys.

## Option 1: controlled mobile app

Use this when field teams already carry phones and the workflow needs photos, forms, GPS context, operator identity and sync queues.

Recommended stack:

- Android: `NfcAdapter` for NFC discovery and `IsoDep` for ISO-DEP/APDU exchange when the workflow needs direct commands.
- iOS: Core NFC with ISO 7816 tag support for APDU-style exchange where Apple platform constraints allow it.
- NXP TapLinx: useful for Android development with NXP tags and for reducing low-level NFC work.
- Secure local storage: Android Keystore / iOS Keychain or Secure Enclave backed storage where available.

Difficulty: medium-high.

Advantages:

- fastest field rollout
- uses existing phones
- can queue scans, photos, signatures and operator notes
- can sync when Wi-Fi or cellular returns

Limits:

- a public consumer app must not contain tenant master keys
- code obfuscation slows reverse engineering but does not make embedded keys safe
- iOS and Android NFC capabilities differ
- final ownership, warranty, NFT, CRM and policy actions should sync through backend

## Option 2: dedicated offline reader

Use this when the client needs controlled hardware for warehouses, mines, rural depots, production lines, cold-chain checkpoints or supplier QA.

Recommended stack:

- ISO/IEC 14443 Type A / NFC Forum Type 4 compatible reader that supports APDU exchange.
- Embedded firmware that can parse the configured SDM/SUN payload.
- Secure element, SAM, TPM or device-bound key storage for production readers.
- Local encrypted queue for scan events and sync retry.

Prototype hardware such as ESP32 plus an NFC reader module can be useful for lab work, but production readers should be selected for ISO-DEP/APDU support, secure storage, enclosure quality, field durability and supplier support. Do not make PN532/Arduino-style prototypes the enterprise reference architecture.

Difficulty: high.

## Local validation model

The offline verifier should use a device-scoped key bundle, not a tenant master key in the app.

1. Tags are encoded per sub-batch with `K_META_BATCH` and `K_FILE_BATCH` or equivalent NXP SDM keys.
2. nexID stores key material encrypted server-side and never exposes the backend envelope secret. The current Vercel application secret is not a managed KMS or HSM.
3. A superadmin or security operator enrolls an offline verifier device while online.
4. The backend issues a scoped offline validation bundle:
   - allowed tenant
   - allowed batch IDs
   - key version or derived validation key
   - expiry time
   - device binding
   - operator role
   - revocation policy
5. The app or reader scans the NTAG 424 DNA payload.
6. The verifier checks the SUN/SDM cryptographic evidence locally and records a provisional verdict.
7. The verifier stores the event in an encrypted queue.
8. When connectivity returns, nexID performs the final server-side replay, policy, tenant, warranty, ownership and audit checks.

## Status labels

Use precise status labels so field teams do not confuse provisional offline trust with final platform trust.

| Status | Meaning |
| --- | --- |
| `OFFLINE_LOCAL_PASS` | Local cryptographic check passed on the enrolled verifier. |
| `OFFLINE_LOCAL_FAIL` | Local cryptographic check failed. Treat as suspicious. |
| `SYNC_PENDING` | Event is queued and has not reached nexID. |
| `SYNC_CONFIRMED` | nexID accepted the event after backend policy checks. |
| `SYNC_REPLAY_CONFLICT` | Backend detected replay, stale counter or conflicting use. |
| `DEVICE_KEY_REVOKED` | Offline verifier key was revoked or expired. |

## Key custody rules

- Never embed tenant master keys in a consumer app.
- Never export the application envelope KEK `KMS_MASTER_KEY_HEX` or any
  versioned `NFC_ENVELOPE_KEK_*_HEX`; these Vercel secrets are not managed KMS
  or HSM keys.
- Do not sell "same master key forever" as the reliability model. It creates a single compromise point for every past and future tag.
- Prefer per-device, per-tenant, per-batch, time-limited derived validation keys.
- Bind offline bundles to enrolled devices and operators.
- Rotate and revoke offline bundles.
- Store local scan queues encrypted.
- Audit every offline bundle issue, download, use and revocation.
- Make "offline pass" provisional until backend sync completes.

## Why not one master key for every tag?

Using one fixed master key for all future tags sounds operationally simple, but it is not enterprise-safe.

If that key is extracted from an APK, rugged reader, supplier laptop, debug log or old employee device, the attacker can validate, emulate or analyze every tag that depends on that key. Rotation becomes painful because the customer may already have thousands of tags in market.

The safer model is:

1. keep tenant root material only in the backend custody boundary; migrate to a verified managed KMS/HSM when the contractual risk tier requires that claim
2. derive or generate keys per order/sub-batch
3. enroll offline devices while online
4. issue only scoped validation bundles to the app/reader
5. expire and revoke bundles
6. sync events back to nexID for final policy and replay resolution

This still lets the customer's app or reader work in a cave, cellar, rural depot or remote plant, but it avoids betting the whole tenant on one reusable secret.

## Market positioning

This is not science fiction. Product authentication vendors already sell app-based field verification, NFC authentication and traceability workflows. The opportunity for nexID is to package it as an enterprise add-on:

- Offline Field Verifier APK for Android operators.
- Managed iOS verifier where platform NFC constraints fit the use case.
- Rugged NFC reader bundle for plants, warehouses, mines, wineries and rural depots.
- Device enrollment, scoped key bundles, encrypted scan queue and sync conflict dashboard.
- Optional DPP/Proof Layer export after sync, not during disconnected operation.

The differentiator should not be "we put the master key in the app". The defensible target is "we let field teams work without signal with scoped custody, audit and revocation"; call it enterprise-grade only after device binding, rotation, revocation and field recovery are tested.

## What the app actually reads

There are two implementation styles.

### Dynamic URL parsing

The app reads the NDEF URL produced by the tag and parses the configured parameters such as `picc_data`, `enc` and `cmac`. This is simpler and works well when the tag is configured to expose SDM data through a URL template.

### APDU exchange

The app or reader talks to the tag through ISO-DEP / ISO 7816 style APDUs. This is more flexible, but it requires lower-level NFC handling and careful implementation against the configured NTAG 424 DNA file and access settings.

## Recommended MVP

1. Android-only field verifier first.
2. Enrolled operator login while online.
3. Device-scoped offline bundle for one tenant and one sub-batch.
4. Local SUN/SDM validation.
5. Encrypted scan queue.
6. Sync endpoint that returns final verdicts.
7. Admin screen showing offline scan count, sync status and conflicts.
8. iOS and dedicated reader after the Android field flow is proven.

## Backend endpoints added first

The current backend support is intentionally conservative. It enables low-connectivity operations without pretending that nexID has shipped a native cryptographic APK or rugged reader firmware.

| Endpoint | Purpose | Key-material behavior |
| --- | --- | --- |
| `POST /admin/offline-verifier/devices` | Enroll or reactivate a controlled verifier device for a tenant. | Stores only a hashed device fingerprint. |
| `POST /admin/offline-verifier/bundles` | Issue a low-connectivity bundle for allowed supplier BIDs. | Returns BIDs, policy and key fingerprints only; no `K_META_BATCH`, `K_FILE_BATCH`, encrypted keys or tenant master keys. |
| `POST /admin/offline-verifier/sync` | Receive queued local scan events from an enrolled verifier. | Accepts hashed evidence only and marks server verdicts as pending/review, not final ownership or warranty. |

This is not yet a full local SUN/SDM verifier. A real local cryptographic verifier still requires a native Android/iOS app or dedicated reader with device-scoped derived validation keys, secure local storage and revocation.

## Tooling

- NXP NTAG 424 DNA documentation for AES-128, SUN and SDM behavior.
- NXP TapLinx SDK for Android/NXP tag development.
- Android `NfcAdapter` and `IsoDep` for native NFC and APDU exchange.
- Apple Core NFC / `NFCISO7816Tag` for iOS NFC sessions and APDUs.
- Hardware reader SDKs only after confirming Type 4 / ISO-DEP / APDU support.

## Commercial wording

Safe:

> nexID can support offline field verification through an enrolled mobile app or dedicated reader. The tag can generate fresh cryptographic evidence without internet; the controlled verifier can check scoped keys locally; nexID finalizes replay, policy, ownership and warranty when the device reconnects.

Avoid:

- "Any phone browser can fully authenticate offline."
- "We put the master key in the app."
- "Obfuscation makes app keys secure."
- "Ownership, warranty or NFT is final offline."
- "A hobby NFC module is our production enterprise reader."

## References

- NXP NTAG 424 DNA product and data sheet.
- NXP TapLinx Android SDK.
- Android `NfcAdapter` and `IsoDep` API documentation.
- Apple Core NFC and `NFCISO7816Tag` documentation.

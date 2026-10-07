# Consumer journey refinement

WEB release `2026.10.07-web-consumer-journey-refinement.1` builds on
`14e9b2818c402a05e658b5ef9c51255cf6948e3f`.

When a save response arrives after the customer has moved focus or deliberately
scrolled, the feedback remains available through the existing live region without
moving them back to the action. An uninterrupted submission retains the existing
focus and visible confirmation. The guard is released on completion or context
disposal; requests, receipts and one-use TAP rules are unchanged.

A failed product photograph is associated with its source URL. A newly reported
image can render in the same mounted product card; a late error from the old image
does not mark the replacement as failed. Existing photo dimensions and safe URL
projection are retained.

Regression coverage uses the real production Next pages and router, with explicit
local synthetic account data and delayed action receipts. It exercises photo
failure followed by router refresh in both themes at 320, 390, 768, 1280 and 1440
pixels, plus interrupted and uninterrupted save feedback. These tests do not
certify physical NFC operation, real account persistence, location permission or
WhatsApp delivery. Execution and publication evidence belongs in the release
artifacts; the presence of this document does not mean the release is deployed.

This increment changes WEB only. No API or dashboard release, migration, tenant
configuration, provider credential or messaging activation is included. Meta's
authentication-template rejection remains unresolved; no delivered OTP is
claimed. PIN-required consumer actions and partial tenant-configuration recovery
need their own subsequent validation and are not changed here.

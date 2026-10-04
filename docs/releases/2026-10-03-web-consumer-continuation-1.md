# Consumer access continuation candidate

Prepared from WEB candidate `7de6eb6c20f006e9c39186bd12e651ebca1cd003`. This document describes source changes, not a production release.

Email OTP requests now include an independently sanitized consumer destination when one exists. The companion API candidate must accept this optional `next` field and put it in the email link; the published API ignores it. Manual code entry still uses the original local destination, so older API releases remain compatible. The email continuation is not active in production while either required candidate remains unpublished.

Only existing `/me` routes, canonical PostgreSQL reading references, product/tenant references and known action selections can enter the email continuation. Unknown query keys and fragments are removed. Duplicate or malformed allowed fields fall back to `/me`. NFC signatures, chip identifiers, TAP capabilities, location and other device/contact query data are excluded. This metadata selects a screen; it grants no session, entitlement or permission. Reading authorization and explicit save/claim/enrollment actions stay with the existing API. Opening an email in another browser does not transfer the short-lived TAP cookie or extend its expiry.

WhatsApp recovery now handles the opt-in Meta provider's safe error codes as well as Twilio's: unavailable configurations offer email; timeouts and invalid receipts report uncertain delivery and keep the entered contact. Switching channels does not send a message automatically. Provider details, credentials and raw error content are not shown to the customer.

Validation results and exact source/deployment bindings must be recorded separately after the source is committed. Prior candidate `7de6eb6` browser/Preview receipts cannot certify this new source. No API/dashboard source, database migration, dependency exception or security policy is included in the WEB change. The reported portal image animation remains unreproduced; this change does not claim to fix it. Tenant WhatsApp marketplaces and the external Meta app setup are not implemented by this increment.

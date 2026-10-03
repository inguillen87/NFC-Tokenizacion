# WEB consumer engagement candidate

This increment extends the unmerged consumer-access candidate e47c5219ce3cd2f0535feea4166da7f049574cee in PR #413. It is not a production publication record. The published WEB baseline remains 2026.10.02-web-sun-client.1, source a9c07c1374248fc041a1f84ab9249b881ab766cb, deployment dpl_5yDh1FvHbb81rDU6Use8tigTS1nv. Final exact-source CI and Preview results belong to a new candidate; the prior e47 receipts are historical evidence only.

## Implemented

- The consumer experiences screen renders real proposals returned by the existing authenticated endpoint and plain-text brand responses to the customer's comments. Proposals lead to the brand's benefits conditions without claiming a reservation, entitlement, earned points or successful redemption.
- Reviews and proposals have independent unavailable/empty states. Failed, missing, malformed or duplicate collections require retry rather than claiming the customer has no records. Unknown moderation/visibility/rating/confidence remains unknown.
- The generic experiences entry guides the customer to select a saved product. A composer appears only for a canonical single PostgreSQL bigint reading reference; query parameters select UI and confer no authorization. The API continues enforcing ownership and risk policy when submitted.
- The wine assistant has a mobile-first light/dark layout, accessible starter questions that only prepare drafts, explicit answer provenance, bounded requests, duplicate-send protection and draft preservation on uncertain responses. Generic entry does not invent a wine or winery.
- Club introductory copy now points to each brand's actual conditions instead of promising that every purchase earns points or that ownership automatically activates membership. Its existing business logic is unchanged.

The earlier consumer-access changes remain: explicit login-channel recovery, one refresh after action-specific confirmed save, one-use TAP feedback and bounded private portal loading/recovery. Shared landing/HERO animations, SUN product imagery, NFC contracts, permissions, API/dashboard source and dependency policy are unchanged in this WEB candidate.

## Validation and publication

The final local source passed the Next production build, TypeScript check and all 885 WEB unit/contract tests. A preliminary real-Next browser run passed 951 checks across 65 synthetic captures, but preceded the last private-status copy adjustment; it is not final-source acceptance. A new immutable final-source browser run, exact-source CI and Preview are still required. The CI dependency exception previously proposed is not applied; active entries remain empty. Publication requires all exact-source CI, Preview and staged-production gates to pass. No automatic exception, production promotion, OTP message, real customer mutation, location collection or physical acceptance is implied.

The user clarified that the image roulette appeared with the account menu visible. Source review of the published consumer home/shell found static product images and a static logo, not a carousel. The in-app-browser read-only /me inspection redirected to login because its browser had no consumer session. The handset animation's component and cause remain unconfirmed; bounded loading is not proof of its repair.

Runtime log refresh found the previously recorded Twilio 401/20003 rejections, accepted primary email request, verification 200 and WEB/API save 200. There is no independent customer-data persistence readback or new handset-code acceptance. The email magic link still lacks the original product continuation; entering the code in the original page preserves it. These incidents are not all resolved by the WEB engagement candidate.

A direct Meta authentication-template OTP integration is being prepared separately from the actual deployed API source 9c10e5c50912d58ee9e1177fa5b7849c2211b69b. It is not included in this WEB tree and is not activated by this record. Meta credentials, sender registration, approved template, account permissions/billing and live delivery remain separate activation evidence.

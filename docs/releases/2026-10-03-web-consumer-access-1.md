# Consumer access and collection recovery — 2026.10.03-web-consumer-access.1

## Incident and evidence

On 2026-10-03, production WEB and API consumer-route logs show a WhatsApp code request rejected at 06:50:36 UTC: Twilio HTTP 401, provider error 20003, API reason `twilio_delivery_failed`, API and WEB HTTP 502. The primary email request was accepted at 06:50:47 UTC; secondary WhatsApp failed with the same provider error. Verification succeeded at 06:51:21 UTC. The product-saving endpoint returned HTTP 200 at 06:51:44 UTC. The portal had fetched its collection before that save; source inspection found no subsequent portal revalidation after a confirmed save.

These observations establish response statuses, not handset message delivery or independent database persistence. No matching consumer-route entries were returned by the bounded dashboard log query; this does not establish that all dashboard logs are error-free. The connector log reads failed with HTTP 403; an existing authenticated Vercel CLI supplied the bounded production observations. No real OTP was requested or sent during these checks.

[Twilio's official 20003 documentation](https://www.twilio.com/docs/api/errors/20003) identifies an authentication/permission rejection; the evidence does not identify which credential or account permission is wrong. Relevant production variables exist as Vercel sensitive entries, whose values are unavailable through the read API. No usable Twilio credentials were found in the three existing NexID local application env files. No secret protection was bypassed, and no environment, sender, template or credential was changed. WhatsApp delivery remains unresolved.

## Implemented WEB changes

- Email is the initial consumer-login channel. WhatsApp remains selectable. A failed code request offers an explicit alternative-channel action, retains both contact drafts and the sanitized return destination, and focuses the newly selected field. Changing channels does not send a code automatically.
- Channel failures use customer-facing recovery instructions. An accepted request remains distinct from delivered/received OTP; simultaneous contact channels remain one shared code rather than a two-factor claim. Simulation remains explicit and cannot enter the verification step as a real delivery.
- The portal revalidates its read-only data once after an action-specific confirmed receipt. A malformed, rejected or lost response does not refresh, repeat a write, or claim success. Save and other terminal actions remain guarded against duplicate submissions.
- Expired or already-consumed fresh TAP capabilities have specific ES/EN/PT instructions to make a new physical TAP. The TTL, one-use semantics, capability custody and API contracts are unchanged.
- Private portal reads have a six-second deadline per request, including the JSON body. A missing session redirects to login; a network failure, server failure or malformed session response remains closed and offers recovery instead of treating an uncertain lookup as logout.
- Local static portal loading and error views reserve space, support light/dark themes and provide accessible status, focus and retry actions. Shared landing and HERO animations remain unchanged.

The reported central animation of several photos has not been reproduced in an authenticated live account. The bounded loading change must not be presented as proof that this particular animation's cause was found. Source review found no carousel in the consumer portal shell; the global loading identity was animated, while the new portal loading view is static.

## Release status and boundaries

This source record precedes final verification/publication. The served production baseline is `2026.10.02-web-sun-client.1`, source `a9c07c1374248fc041a1f84ab9249b881ab766cb`, deployment `dpl_5yDh1FvHbb81rDU6Use8tigTS1nv`, WEB project `prj_pQIhl6GMCfAaSBpxPmLNDuyKEk17`. Its source is the immediate rollback target. Application-source base is `f76215265d7d7bf7a19dfb9937387f75543e7b99`, a documentation closure with the same WEB tree as that served source.

Publication requires the final committed source, WEB tests/typecheck/build, responsive consumer access/save/loading tests, exact-source CI, Preview and staged production checks. Actual deployment IDs, source hashes, test results and alias reconciliation will be recorded after they are observed. No production publication is claimed by this preliminary record.

API remains `9c10e5c50912d58ee9e1177fa5b7849c2211b69b` / `dpl_B83ARi352kqBkCAyavxy2U5GnnL4`; dashboard remains `4d976d385e75d1e9139ebc44f5ba820eaaebb591` / `dpl_G4VyLi49MmAbQLQuMt3979HDBN8X`. Their actual deployed trees are separate from the older API/dashboard trees in the WEB checkout. Neither application is changed or deployed by this increment. There are no dependency changes, migrations, production-data writes or extra phone metadata collection.

Separate source finding not included: the email magic link lacks the original return context; entering the OTP on the original page preserves it. Whether the user opened that link is unverified. No browser-storage workaround or unbound stale-context recovery was introduced.

Still required outside synthetic validation: renewed WhatsApp provider authentication and a real phone-code delivery; a fresh physical TAP through login, explicit save and a confirmed live collection update; reproduction/acceptance of the reported photo animation; phone location through persisted observation into the tenant's authenticated CRM. These states must not be inferred from synthetic fixtures or HTTP 200 alone.

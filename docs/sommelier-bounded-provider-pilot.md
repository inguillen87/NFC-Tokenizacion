# Sommelier provider pilot

This increment belongs to API, based on published API `8cda02b643cb506a1315a4aa26881fc7be5bf3fc`. It does not reuse the commercial `/assistant/chat` handler or its CRM mutations. WEB and Dashboard are separate releases. Their Next manifest changes here are dependency pins only, required to remove the vulnerable duplicate from this monorepo's lock.

## Contract and admission

`POST /public/sommelier/demo/session` accepts only `{profile:"valle-secreto",locale:"es-AR"|"en"|"pt-BR"}`. It issues a 15-minute, purpose-specific HMAC grant using a subkey derived from existing `RATE_LIMIT_KEY_PEPPER`. Production cookie is `__Host-nexid_sommelier_demo`, Secure, HttpOnly, Path=/, SameSite=Lax, without Domain. Existing valid cookies are reused without extending expiry or charging issuance again.

The demo grant binds exact approved browser Origin, a UA hash and a random grant ID. It is not proof of a phone, a tenant, NFC authenticity or a purchase. API-observed ingress IP (which can be BFF egress) limits new grants conservatively; it is **not visitor-location/phone identity** and is not part of grant verification. Clearing cookies can obtain another grant only through issuance quotas. Pilot capacity has not been measured for a large tenant fleet; shared egress admission may deny otherwise legitimate new sessions.

`POST /sommelier/chat` requires `{mode:"demo"|"consumer",question,locale,history?:[{role:"user"|"assistant",content}],eventId?:canonicalString}`. Demo mode rejects all event IDs and requires the Valle grant. Consumer mode requires the normal consumer session cookie and never falls back to demo authorization. Without event ID it offers general wine guidance with no tenant/product facts. With event ID it requires an existing consumer history/collection relation, the tenant's published Sommelier permission and a currently published editorial bound to that same tenant. Existing editorial wine facts currently cover product/producer/region, not a full technical sheet. Unsaved anonymous physical taps are not authorized for funded chat by this increment.

Question is bounded to 1,500 characters, history to six messages/1,000 characters each/6,000 UTF-8 bytes, request to 12,288 bytes. User-supplied model, token, tenant, product facts, URLs and NFC capabilities are rejected. Email/phone-like identifiers, long hex identifiers, credentials, links and coordinate pairs are redacted from conversation text before provider forwarding; this heuristic is not a general personal-data certification. History, including assistant content, is untrusted data, not instructions or published facts. No conversation or customer action is persisted.

## Distributed spend limits

Only existing `sun_rate_limit_buckets` is used. Missing store, pepper, invalid receipts or database permissions fail closed. There is no DDL/repair, migration, CRM write, NFC handoff consumption or customer-data mutation. Reservations write only quota accounting. HMAC keys keep caller/tenant dimensions out of persisted plaintext.

Issuance: four/source/minute, twenty/source/hour, 200 global/day. Chat: six/principal/minute, thirty/principal/hour, twenty/tenant/minute, thirty global/minute. Demo principal is the signed grant ID; consumer principal is the server-resolved consumer. Each provider attempt, including enabled fallback and network/validation failure, consumes another global attempt reservation (300/day) and conservative cost reservation: global 500,000 micro-USD, tenant 100,000 micro-USD. Windows are **fixed accounting intervals** beginning with the first reservation and resetting after the configured 60/3,600/86,400 seconds; they are neither calendar days nor sliding rolling windows. Denied reservations can consume accounting, and consumed reservations are not refunded. Concurrent upserts serialize per bucket; all required reservations must succeed before provider fetch.

One full serialized UTF-8 request byte reserves one input token plus 1,024 output tokens (including reasoning). Price caps are pinned configuration-era rates: HF model input/output $0.03/$0.14 per million tokens; OpenAI fallback $0.10/$0.50. These are budget estimates for this service, not a provider invoice or an account-wide limit. Other products using the same provider key are outside this budget. Revalidate prices and model receipt shape before enabling the pilot. Provider receipts must include bounded integral usage matching their total, approved model, a completed non-tool answer and valid JSON.

## Providers, output and deadlines

Primary is pinned `openai/gpt-oss-20b:deepinfra` at HF's fixed chat-completions URL, using existing `HF_TOKEN` or `HUGGINGFACE_API_KEY`. OpenAI `gpt-6-luna` at its fixed chat-completions URL is a separately opted-in fallback, using the existing NexID `OPENAI_API_KEY`. No auto/cheapest routing, client-selected model, tools, arbitrary fetch URLs or implicit retries. HF reasoning is low; OpenAI reasoning is none and store=false.

When that fallback is explicitly enabled and configured, an HF HTTP 401/402/403 opens a five-minute cooldown for the same key/model fingerprint in that warm process. Only one entry is retained in memory; no key, fingerprint or response body is logged or persisted. During cooldown OpenAI still requires its own distributed attempt/cost reservation. A changed key or expiry retries HF; 429, 5xx, transport errors and late responses after cancellation do not open the cooldown. Cold instances can retry HF, so this optimization does not replace distributed budgets or establish provider funding/readiness.

Quota failures emit internal diagnostics containing only a closed `category` and explicitly recognized `sqlState` or null. Categories distinguish missing database configuration, required schema watermark, undefined relation/column, permissions, connection failures, malformed quota receipts and quota configuration; all other errors are unknown. Relation errors do not identify which table is missing. Raw errors, SQL, values, credentials and caller/tenant dimensions are never logged by this diagnostic. The public failure response and fail-closed admission stay unchanged even if logging fails.

HTTP deadline is eleven seconds; provider deadline is at most nine seconds over headers **and body**, with at most two candidates inside that shared budget. An enabled HF→OpenAI fallback gives HF at most 5.5 seconds. Response bytes are capped at 16,384. A late response cannot become live or start a late fallback. Advice is capped at 650 characters, final answer at 1,200; output cap is 1,024 tokens. Production quality/latency/cost have not yet been measured.

Provider selects approved fact IDs; the server renders their exact public text and known source URLs. Free advice has structural and forbidden-claim checks; those checks do not prove every semantic statement true. Unknown IDs, arbitrary URLs, prohibited claims, malformed/truncated receipts or timeouts produce honest general guidance with `source:"fallback"`, not false live provenance. Live responses report provider/model and non-private token/reservation counts. Demo context remains explicitly demo even when its guide uses a real LLM. Published producer practices are not bottle-level sensor measurements or carbon footprints.

## Flags and enablement

- `NEXID_SOMMELIER_ENABLED=true`: opt in; default off.
- `NEXID_SOMMELIER_DEMO_ENABLED=true`: separately opt in; default off.
- `NEXID_SOMMELIER_OPENAI_FALLBACK_ENABLED=true`: permits additional paid fallback; default off.
- `NEXID_SOMMELIER_ALLOWED_ORIGINS`: optional comma-separated **exact HTTPS origins**; wildcard hosts are rejected. Known production NexID domains are defaults. Loopback HTTP is permitted only outside production. Preview requires its exact approved origin.

Use existing API provider credentials and pepper; this change does not create/read out/write secrets. WEB BFF must enforce its own origin/content-type/bounds and forward the original exact browser Origin/UA and only the necessary consumer/demo cookies. Return Set-Cookie without widening the __Host attributes. Never forward caller-chosen credentials or pretend API-generated ingress IP is browser IP.

Local tests use synthetic queries and mocked provider transports. They do not prove delivery, customer authentication, actual LLM quality, billing, physical NFC or publication. Enablement requires separate API/WEB CI, Preview, publication/readback and a bounded authorized real provider check. Dashboard and NFC/anti-replay/business-action contracts remain separate.

Primary references: [HF chat contract](https://huggingface.co/docs/inference-providers/tasks/chat-completion), [HF model catalog](https://router.huggingface.co/v1/models), [OpenAI model](https://developers.openai.com/api/docs/models/gpt-6-luna), [structured output](https://developers.openai.com/api/docs/guides/structured-outputs).

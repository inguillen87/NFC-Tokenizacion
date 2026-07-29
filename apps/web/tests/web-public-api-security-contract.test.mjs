import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [
  guard, onboard, onboardButton, leads, leadIntent, assistant, cognitive, label, realtime, sunContext, publicCta, web3,
] = await Promise.all([
  read("../src/lib/public-api-guard.ts"),
  read("../src/app/api/demo/onboard/route.ts"),
  read("../src/app/sun/onboard-demo-button.tsx"),
  read("../src/app/api/leads/route.ts"),
  read("../src/app/api/leads/[intent]/route.ts"),
  read("../src/app/api/assistant/chat/route.ts"),
  read("../src/app/api/cognitive-ai/route.ts"),
  read("../src/app/api/generate-label/route.ts"),
  read("../src/app/api/realtime/session/route.ts"),
  read("../src/app/api/sun-context/route.ts"),
  read("../src/app/api/public-cta/[action]/route.ts"),
  read("../src/app/api/consumer/auth/web3/route.ts"),
]);

test("shared public API guard provides same-origin, bounded-body and bounded-rate primitives", () => {
  assert.match(guard, /isSameOriginRequest/);
  assert.match(guard, /readBoundedText/);
  assert.match(guard, /TextEncoder/);
  assert.match(guard, /consumePublicApiRateLimit/);
  assert.match(guard, /MAX_RATE_BUCKETS/);
});

test("privileged demo onboarding is unavailable from the browser runtime", () => {
  assert.match(onboard, /Privileged tenant\/batch creation is intentionally unavailable/);
  assert.match(onboard, /reason: "not_found"/);
  assert.match(onboard, /status: 404/);
  assert.doesNotMatch(onboard, /ADMIN_API_KEY|Authorization|fetch\(/);
  assert.doesNotMatch(onboardButton, /fetch\("\/api\/demo\/onboard"/);
});

test("lead capture stays on the public upstream and reports failures honestly", () => {
  assert.match(leads, /\/public\/leads/);
  assert.match(leads, /isSameOrigin/);
  assert.match(leads, /MAX_PAYLOAD_BYTES/);
  assert.match(leads, /consumeRateLimit/);
  assert.match(leads, /lead_backend_failed/);
  assert.match(leads, /lead_backend_unavailable/);
  assert.doesNotMatch(leads, /\/admin\/leads|ADMIN_API_KEY|queued_local/);
  assert.match(leadIntent, /origin: new URL\(req\.url\)\.origin/);
});

test("AI routes bound cost and reject arbitrary request controls", () => {
  for (const source of [assistant, cognitive, label]) {
    assert.match(source, /isSameOriginRequest/);
    assert.match(source, /readBoundedText/);
    assert.match(source, /consumePublicApiRateLimit/);
  }
  assert.match(assistant, /MAX_QUESTION_CHARS/);
  assert.match(assistant, /ALLOWED_MODES/);
  assert.match(assistant, /safeHistory/);
  assert.match(cognitive, /ALLOWED_TONES/);
  assert.match(cognitive, /unsupported_model/);
  assert.match(cognitive, /MAX_CUSTOM_TOKEN_CHARS/);
  assert.match(label, /MAX_PROMPT_CHARS/);
  assert.match(label, /MAX_IMAGE_BYTES/);
  assert.match(guard, /allowLocalServerFundedProviderCalls/);
  assert.match(guard, /nodeEnv === "production" \|\| vercelEnv === "production"/);
  assert.match(guard, /NEXID_LOCAL_PROVIDER_CALLS_ENABLED/);
  for (const source of [cognitive, label]) {
    assert.match(source, /if \(!allowLocalServerFundedProviderCalls\(\)\)/);
    assert.match(source, /provider_requires_distributed_authorization/);
  }
  assert.doesNotMatch(`${cognitive}\n${label}`, /console\.(?:log|info|warn|error)\([^\n]*customToken/);
});

test("realtime and SUN context relays are bounded before upstream calls", () => {
  assert.match(realtime, /NEXID_REALTIME_PUBLIC_ENABLED/);
  assert.match(realtime, /process\.env\.NODE_ENV === "production"/);
  assert.match(realtime, /MAX_SDP_BYTES/);
  assert.match(realtime, /isSameOriginRequest/);
  assert.match(realtime, /consumePublicApiRateLimit/);
  assert.match(sunContext, /MAX_PAYLOAD_BYTES/);
  assert.match(sunContext, /readBoundedText/);
  assert.match(sunContext, /parseJsonRecord/);
});

test("public CTA mutations enforce browser origin, bounded JSON and rate limits", () => {
  assert.match(publicCta, /isSameOriginRequest/);
  assert.match(publicCta, /isJsonRequest/);
  assert.match(publicCta, /MAX_PAYLOAD_BYTES/);
  assert.match(publicCta, /readBoundedText/);
  assert.match(publicCta, /consumePublicApiRateLimit/);
  assert.match(publicCta, /cta_backend_unavailable/);
  assert.doesNotMatch(publicCta, /headers\["x-forwarded-for"\]/);
  assert.doesNotMatch(publicCta, /await req\.json\(\)/);
});

test("Clerk Web3 bridge forwards only the verified Clerk session token and bounds chain IDs", () => {
  assert.match(web3, /const clerkAuth = await auth\(\)/);
  assert.match(web3, /clerkAuth\?\.getToken\(\)/);
  assert.match(web3, /authorization: `Bearer \$\{clerkSessionToken\}`/);
  assert.match(web3, /MAX_PAYLOAD_BYTES/);
  assert.match(web3, /CHAIN_ID_RE/);
  assert.match(web3, /invalid_chain_id/);
  assert.doesNotMatch(web3, /"x-forwarded-for"/);
  assert.doesNotMatch(web3, /ADMIN_API_KEY|externalUserId|walletVerificationSource/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  PUBLIC_CLIENT_EXPERIENCE_EVENT_TYPES,
  buildPublicExperienceIdempotencyKey,
  hasPublicExperienceEventScope,
  isSensitivePublicClientExperienceEvent,
  normalizePublicClientExperienceEventType,
  recordPublicExperienceEvent,
} = await import("../src/app/sun/public-experience-events.ts");

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("wine activity keys are deterministic per tap, action, interaction and semantic payload", () => {
  const input = {
    eventId: "4815162342",
    eventType: "PRODUCT_VIEWED",
    placement: "passport",
    interactionId: "initial_render:es-AR",
    data: { surface: "wine_dpp", locale: "es-AR", profileVersion: "wine-post-tap-v1" },
  };
  const first = buildPublicExperienceIdempotencyKey(input);
  const replay = buildPublicExperienceIdempotencyKey({ ...input, data: { profileVersion: "wine-post-tap-v1", locale: "es-AR", surface: "wine_dpp" } });
  assert.equal(first, replay);
  assert.match(first, /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/);
  assert.notEqual(first, buildPublicExperienceIdempotencyKey({ ...input, interactionId: "second_open:es-AR" }));
  assert.notEqual(first, buildPublicExperienceIdempotencyKey({ ...input, eventId: "4815162343" }));
});

test("public activity requires a real numeric source event and never exposes authoritative outcomes", () => {
  assert.equal(hasPublicExperienceEventScope({ bid: "BID-WINE", eventId: "8842" }), true);
  assert.equal(hasPublicExperienceEventScope({ bid: "BID-WINE", eventId: "demo-sun-preview" }), false);
  assert.equal(hasPublicExperienceEventScope({ bid: "", eventId: "8842" }), false);
  assert.equal(normalizePublicClientExperienceEventType("product_viewed"), "PRODUCT_VIEWED");
  assert.equal(normalizePublicClientExperienceEventType("LOYALTY_JOINED"), null);
  assert.equal(normalizePublicClientExperienceEventType("LEAD_CREATED"), null);
  assert.equal(normalizePublicClientExperienceEventType("TRAINING_COMPLETED"), null);
  assert.equal(isSensitivePublicClientExperienceEvent("LOYALTY_OFFER_VIEWED"), true);
  assert.equal(isSensitivePublicClientExperienceEvent("PRODUCT_VIEWED"), false);
  assert.doesNotMatch(PUBLIC_CLIENT_EXPERIENCE_EVENT_TYPES.join("|"), /LOYALTY_JOINED|LEAD_CREATED|TRAINING_COMPLETED/);
});

test("the browser writer fails closed without a fresh tap capability and forwards it on every write", async () => {
  const originalFetch = globalThis.fetch;
  let captured = null;
  globalThis.fetch = async (url, init) => {
    captured = { url, body: JSON.parse(String(init?.body || "{}")) };
    return new Response(JSON.stringify({ ok: true, replayed: false }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const missing = await recordPublicExperienceEvent({
      bid: "BID-WINE",
      eventId: "8842",
      eventType: "PRODUCT_VIEWED",
      placement: "passport",
      interactionId: "initial_render:es-AR",
    });
    assert.deepEqual(missing, { ok: false, reason: "fresh_tap_capability_unavailable" });
    assert.equal(captured, null);

    const saved = await recordPublicExperienceEvent({
      bid: "BID-WINE",
      eventId: "8842",
      freshToken: "signed-fresh-capability",
      eventType: "PRODUCT_VIEWED",
      placement: "passport",
      interactionId: "initial_render:es-AR",
    });
    assert.equal(saved.ok, true);
    assert.equal(captured.url, "/api/public-cta/experience-event");
    assert.equal(captured.body.fresh_token, "signed-fresh-capability");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("real wine SUN page records truthful views and meaningful starts through the same-origin BFF", async () => {
  const [tracker, page, services, nextStep, engagement, actions, agro, writer, bff] = await Promise.all([
    read("../src/app/sun/wine-experience-events.tsx"),
    read("../src/app/sun/page.tsx"),
    read("../src/app/sun/sun-services-hub.tsx"),
    read("../src/app/sun/post-tap-next-step.tsx"),
    read("../src/app/sun/qr-engagement-suite.tsx"),
    read("../src/app/sun/cta-actions.tsx"),
    read("../src/app/sun/agro-dpp-experience.tsx"),
    read("../src/app/sun/public-experience-events.ts"),
    read("../src/app/api/public-cta/[action]/route.ts"),
  ]);
  assert.match(tracker, /eventType: "PRODUCT_VIEWED"/);
  assert.match(tracker, /surface: "wine_dpp"/);
  assert.match(tracker, /if \(isSensitivePublicClientExperienceEvent\(input\.eventType\) && !allowSensitiveEvents\) return/);
  assert.match(writer, /if \(isSensitivePublicClientExperienceEvent\(eventType\) && input\.sensitiveActionAllowed !== true\)/);
  assert.match(writer, /fresh_token: freshToken/);
  assert.match(writer, /if \(!freshToken\) return \{ ok: false as const, reason: "fresh_tap_capability_unavailable" \}/);
  assert.match(page, /enabled=\{isWineProduct[\s\S]*?&& isFreshCommercialTap[\s\S]*?&& !isQrScan[\s\S]*?&& !isSnapshotView[\s\S]*?&& !isRiskBlocked[\s\S]*?&& Boolean\(bid && \/\^\\d\+\$\/\.test\(eventId\) && freshToken\)\}/);
  assert.match(page, /allowSensitiveEvents=\{isFreshCommercialTap && !isQrScan && !isSnapshotView && !isRiskBlocked\}/);
  assert.match(page, /freshToken=\{freshToken\}/);
  assert.match(page, /TECHNICAL_SHEET_VIEWED/);
  assert.match(services, /LOYALTY_OFFER_VIEWED/);
  assert.match(nextStep, /PROBLEM_REPORTED/);
  assert.match(actions, /data-sun-experience-event="PROBLEM_REPORTED"/);
  assert.match(engagement, /TRAINING_STARTED/);
  assert.match(tracker, /recordPublicExperienceEvent/);
  assert.match(agro, /recordPublicExperienceEvent/);
  assert.match(bff, /"experience-event"/);
  assert.match(bff, /action === "experience-event" && !clean\(body\.fresh_token \|\| body\.freshToken\)/);
  assert.doesNotMatch(tracker, /navigator\.geolocation|consumerId|consumer_id|latitude|longitude|\bgps\b/i);
});

import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const [page, optIn] = await Promise.all([
  readFile(new URL("../src/app/sun/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/sun/sun-updates-opt-in.tsx", import.meta.url), "utf8"),
]);

test("SUN exposes a policy-aware generic brand opt-in without inferring consent from the tap", () => {
  assert.match(page, /const canSubscribeToBrand = engagementBaseEligible/);
  assert.match(page, /subscribeHref=\{canSubscribeToBrand \? \(showEngagementSuite \? "#qr-engagement" : "#sun-updates-opt-in"\) : null\}/);
  assert.match(page, /canSubscribeToBrand && !showEngagementSuite \? \(/);
  assert.match(page, /<SunUpdatesOptIn/);

  assert.match(optIn, /if \(state === "submitting" \|\| !consent \|\| contact\.trim\(\)\.length < 5\) return/);
  assert.match(optIn, /required[\s\S]*?type="checkbox"/);
  assert.match(optIn, /fetch\("\/api\/leads"/);
  assert.match(optIn, /gps: \{ consent: false, precision: "none" \}/);
  assert.match(optIn, /No activa premios, propiedad ni garantía/);
  assert.match(optIn, /Este consentimiento es opcional y revocable/);
  assert.doesNotMatch(optIn, /navigator\.geolocation|userAgent|deviceMeta/);
});

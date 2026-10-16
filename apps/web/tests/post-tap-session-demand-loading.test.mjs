import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/app/sun/cta-actions.tsx", import.meta.url), "utf8");
const nextStepSource = await readFile(new URL("../src/app/sun/post-tap-next-step.tsx", import.meta.url), "utf8");

test("public post-tap actions do not duplicate the portal session or OTP flows", () => {
  assert.match(source, /SunClaimPortal/);
  assert.doesNotMatch(source, /\/api\/consumer\/(?:session|auth\/start|auth\/verify)/);
  assert.doesNotMatch(source, /resolveConsumerSessionForClaim|verifyClaimAuthAndRetry|startClaimAuth/);
});

test("the new ownership entry delegates access to the existing protected bridge", async () => {
  const portal = await readFile(new URL("../src/app/sun/sun-claim-portal.tsx", import.meta.url), "utf8");
  assert.match(portal, /ConsumerTapLink/);
  assert.doesNotMatch(portal, /\/api\/consumer\/(?:session|auth\/start|auth\/verify)|fetch\(/);
});

test("protected consumer portal links are not prefetched for anonymous visitors", () => {
  assert.match(nextStepSource, /function isProtectedConsumerPortalHref\(href: string\)/);
  assert.ok(nextStepSource.includes("return /^\\/me(?:[/?#]|$)/.test(href);"));
  assert.match(nextStepSource, /if \(isProtectedConsumerPortalHref\(action\.href\)\) return/);
  assert.match(nextStepSource, /<ConsumerTapLink href=\{action\.href\}/);
});

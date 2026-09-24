import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHmac } from "node:crypto";

import {
  createSunFreshHandoffToken,
  createSunSnapshotAccessToken,
  verifySunFreshHandoffToken,
  verifySunSnapshotAccessToken,
} from "../src/lib/sun-fresh-handoff.ts";
import {
  escapeHtmlTreeForMarkup,
  serializeForInlineScript,
} from "../src/lib/public-html-security.ts";

const sunRoute = await readFile(new URL("../src/app/sun/route.ts", import.meta.url), "utf8");
const snapshotRoute = await readFile(new URL("../src/app/sun/snapshot/[diagnosticId]/route.ts", import.meta.url), "utf8");
const webSunPage = await readFile(new URL("../../web/src/app/sun/page.tsx", import.meta.url), "utf8");
const webNextConfig = await readFile(new URL("../../web/next.config.mjs", import.meta.url), "utf8");
const certificateRoute = await readFile(new URL("../src/app/public/certificates/[eventId]/route.ts", import.meta.url), "utf8");
const receiptOcrRoute = await readFile(new URL("../src/app/public/cta/receipt-ocr/route.ts", import.meta.url), "utf8");

test("snapshot access is signed, scoped, expiring and rejects tampering", () => {
  const previousSecret = process.env.SUN_HANDOFF_SECRET;
  const previousNodeEnv = process.env.NODE_ENV;
  const originalDateNow = Date.now;
  process.env.SUN_HANDOFF_SECRET = "test-only-snapshot-secret-with-more-than-32-bytes";
  process.env.NODE_ENV = "test";
  try {
    const now = Math.floor(originalDateNow() / 1000);
    // This test exercises +60/+61-second boundaries. Crossing a wall-clock second
    // during assertions must not turn a future +61 case into an allowed +60 case.
    // The existing finally restores the real clock; production expiry is unchanged.
    Date.now = () => now * 1000;
    const freshToken = createSunFreshHandoffToken({
      bid: "SAFE-BATCH",
      eventId: "42",
      uidHex: "04AABBCCDDEEFF",
      readCounter: 7,
      diagnosticId: 42,
      traceId: "trace-safe-42",
      exp: now + 60,
    });
    assert.equal(verifySunFreshHandoffToken(freshToken).ok, true);
    assert.equal(verifySunFreshHandoffToken(`${freshToken}.ignored-suffix`).ok, false);

    assert.throws(() => createSunFreshHandoffToken({
      bid: "SAFE-BATCH",
      eventId: "42",
      diagnosticId: 42,
      traceId: "trace-safe-42",
      iat: now + 61,
      exp: now + 120,
    }), /invalid sun fresh handoff expiry/);
    assert.throws(() => createSunFreshHandoffToken({
      bid: "SAFE-BATCH",
      eventId: "42",
      diagnosticId: 42,
      traceId: "trace-safe-42",
      iat: now,
      exp: now + 5 * 60 + 1,
    }), /invalid sun fresh handoff expiry/);

    const signFreshPayload = (payload) => {
      const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
      const signature = createHmac("sha256", process.env.SUN_HANDOFF_SECRET)
        .update(body)
        .digest("base64url");
      return `${body}.${signature}`;
    };
    const freshPayload = {
      purpose: "sun_fresh_handoff",
      bid: "SAFE-BATCH",
      eventId: "42",
      uid: "EVENT-42",
      uidBinding: null,
      readCounter: 7,
      diagnosticId: 42,
      traceId: "trace-safe-42",
      iat: now,
      exp: now + 60,
    };
    assert.equal(
      verifySunFreshHandoffToken(signFreshPayload({ ...freshPayload, iat: now + 61, exp: now + 120 })).reason,
      "fresh_token_not_yet_valid",
    );
    assert.equal(
      verifySunFreshHandoffToken(signFreshPayload({ ...freshPayload, exp: now + 5 * 60 + 1 })).reason,
      "fresh_token_invalid_lifetime",
    );

    const token = createSunSnapshotAccessToken({
      diagnosticId: 42,
      traceId: "trace-safe-42",
      iat: now,
      exp: now + 60,
    });
    assert.equal(verifySunSnapshotAccessToken(token, { diagnosticId: 42, traceId: "trace-safe-42" }).ok, true);
    assert.equal(verifySunSnapshotAccessToken(token, { diagnosticId: 43, traceId: "trace-safe-42" }).ok, false);
    assert.equal(verifySunSnapshotAccessToken(token, { diagnosticId: 42, traceId: "other-trace" }).ok, false);
    assert.equal(verifySunSnapshotAccessToken(`${token.slice(0, -1)}x`, { diagnosticId: 42, traceId: "trace-safe-42" }).ok, false);
    assert.equal(verifySunSnapshotAccessToken(`${token}.ignored-suffix`, { diagnosticId: 42, traceId: "trace-safe-42" }).ok, false);

    const defaultToken = createSunSnapshotAccessToken({ diagnosticId: 42, traceId: "trace-safe-42" });
    const defaultPayload = JSON.parse(Buffer.from(defaultToken.split(".")[1], "base64url").toString("utf8"));
    assert.equal(defaultPayload.exp - defaultPayload.iat, 15 * 60);

    assert.throws(() => createSunSnapshotAccessToken({
      diagnosticId: 42,
      traceId: "trace-safe-42",
      iat: now + 61,
      exp: now + 120,
    }), /invalid sun snapshot access expiry/);
    assert.throws(() => createSunSnapshotAccessToken({
      diagnosticId: 42,
      traceId: "trace-safe-42",
      iat: now,
      exp: now + 15 * 60 + 1,
    }), /invalid sun snapshot access expiry/);

    const signSnapshotPayload = (payload) => {
      const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
      const signature = createHmac("sha256", process.env.SUN_HANDOFF_SECRET)
        .update(`snapshot:${body}`)
        .digest("base64url");
      return `snap1.${body}.${signature}`;
    };
    const futureToken = signSnapshotPayload({ purpose: "sun_snapshot_access", diagnosticId: 42, traceId: "trace-safe-42", iat: now + 61, exp: now + 120 });
    assert.equal(verifySunSnapshotAccessToken(futureToken, { diagnosticId: 42, traceId: "trace-safe-42" }).reason, "snapshot_token_not_yet_valid");
    const overlongToken = signSnapshotPayload({ purpose: "sun_snapshot_access", diagnosticId: 42, traceId: "trace-safe-42", iat: now, exp: now + 15 * 60 + 1 });
    assert.equal(verifySunSnapshotAccessToken(overlongToken, { diagnosticId: 42, traceId: "trace-safe-42" }).reason, "snapshot_token_invalid_lifetime");

    const expired = createSunSnapshotAccessToken({
      diagnosticId: 42,
      traceId: "trace-safe-42",
      iat: now - 120,
      exp: now + 1,
    });
    Date.now = () => (now + 2) * 1000;
    assert.equal(verifySunSnapshotAccessToken(expired, { diagnosticId: 42, traceId: "trace-safe-42" }).ok, false);
  } finally {
    Date.now = originalDateNow;
    if (previousSecret === undefined) delete process.env.SUN_HANDOFF_SECRET;
    else process.env.SUN_HANDOFF_SECRET = previousSecret;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test("public SUN markup escapes stored text and inline-script terminators", () => {
  const payload = {
    product: { name: `</script><img src=x onerror="globalThis.pwned=1">` },
    timeline: [{ city: `"><svg onload=alert(1)>`, country: "A&B" }],
  };
  const escaped = escapeHtmlTreeForMarkup(payload);
  assert.equal(escaped.product.name.includes("<"), false);
  assert.equal(escaped.timeline[0].city.includes("<"), false);
  assert.match(escaped.timeline[0].country, /A&amp;B/);

  const serialized = serializeForInlineScript(payload);
  assert.doesNotMatch(serialized, /<\/script/i);
  assert.doesNotMatch(serialized, /<img/i);
  assert.match(serialized, /\\u003c\/script\\u003e/);

  assert.match(sunRoute, /const contract = escapeHtmlTreeForMarkup\(rawContract\)/);
  assert.match(sunRoute, /serializeForInlineScript\(rawContract\.identity\.bid\)/);
  assert.doesNotMatch(sunRoute, /const bid = \$\{JSON\.stringify\(contract\.identity\.bid\)\}/);
});

test("snapshot lookup verifies the signed capability before reading diagnostics", () => {
  const verifyIndex = snapshotRoute.indexOf("verifySunSnapshotAccessToken");
  const readIndex = snapshotRoute.indexOf("getSunDiagnosticSnapshot(diagnosticId");
  assert.ok(verifyIndex > 0);
  assert.ok(readIndex > verifyIndex);
  assert.match(snapshotRoute, /reason: "snapshot_not_found"/);
  assert.match(snapshotRoute, /x-robots-tag/);
  assert.match(sunRoute, /createSunSnapshotAccessToken/);
  assert.match(sunRoute, /target\.searchParams\.set\("access", snapshotAccessToken/);
  assert.match(webSunPage, /snapshotId && snapshotTrace && snapshotAccess/);
  assert.match(webSunPage, /&access=\$\{encodeURIComponent\(snapshotAccess\)\}/);
  assert.match(webNextConfig, /source: "\/sun"/);
  assert.match(webNextConfig, /Referrer-Policy", value: "no-referrer"/);
  assert.match(webNextConfig, /Cache-Control", value: "private, no-store"/);
  assert.match(webNextConfig, /X-Robots-Tag", value: "noindex, nofollow"/);
});

test("adjacent public certificate and OCR paths remain capability-bound", () => {
  assert.match(certificateRoute, /verifyPublicCertificateShareToken\(eventId, shareToken\)/);
  assert.match(certificateRoute, /DEMO_TENANT_SLUG/);
  assert.match(certificateRoute, /DEMO_BATCH_BID/);
  assert.match(certificateRoute, /LOWER\(COALESCE\(e\.source::text, ''\)\) = 'demo'/);
  assert.match(certificateRoute, /LOWER\(tn\.slug\) = \$\{DEMO_TENANT_SLUG\}/);
  assert.match(certificateRoute, /b\.bid = \$\{DEMO_BATCH_BID\}/);
  assert.match(certificateRoute, /uidMasked: maskUid\(row\.uid_hex\)/);
  assert.doesNotMatch(certificateRoute, /uid:\s*row\.uid_hex/);

  assert.match(receiptOcrRoute, /requireShareToken\(req, target\.bid, target\.shareUid\)/);
  assert.match(receiptOcrRoute, /consumeSunFreshHandoff/);
  assert.match(receiptOcrRoute, /claim_eligible: false/);
  assert.match(receiptOcrRoute, /review_required: true/);
});

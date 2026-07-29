import assert from "node:assert/strict";
import test from "node:test";

import {
  createPublicCertificateShareToken,
  verifyPublicCertificateShareToken,
} from "../src/lib/public-certificate-share.ts";
import {
  createSunFreshHandoffToken,
  verifySunFreshHandoffToken,
} from "../src/lib/sun-fresh-handoff.ts";

const MANAGED_ENV = [
  "ADMIN_API_KEY",
  "PUBLIC_CERTIFICATE_ALLOW_LEGACY_SECRET_FALLBACK",
  "PUBLIC_CERTIFICATE_SIGNING_SECRET",
  "PUBLIC_CERTIFICATE_SIGNING_SECRET_PREVIOUS",
  "PUBLIC_DEMO_SHARE_SECRET",
  "SUN_HANDOFF_ALLOW_LEGACY_SECRET_FALLBACK",
  "SUN_HANDOFF_SECRET",
  "SUN_HANDOFF_SECRET_PREVIOUS",
  "TOKENIZATION_UID_SALT",
];

function withSigningEnvironment(values, run) {
  const previous = Object.fromEntries(MANAGED_ENV.map((key) => [key, process.env[key]]));
  try {
    for (const key of MANAGED_ENV) delete process.env[key];
    for (const [key, value] of Object.entries(values)) process.env[key] = value;
    return run();
  } finally {
    for (const key of MANAGED_ENV) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

function sunInput() {
  return {
    bid: "BID-ROTATION-001",
    eventId: "event-rotation-001",
    diagnosticId: 42,
    traceId: "trace-rotation-001",
    uidHex: "04A1B2C3D4E5F6",
    readCounter: 7,
    exp: Math.floor(Date.now() / 1000) + 60,
  };
}

test("public certificate signing never falls through to ADMIN_API_KEY by default", { concurrency: false }, () => {
  withSigningEnvironment({ ADMIN_API_KEY: "legacy-admin-secret" }, () => {
    assert.throws(
      () => createPublicCertificateShareToken("613"),
      /PUBLIC_CERTIFICATE_SIGNING_SECRET is not configured/,
    );
  });

  const legacyToken = withSigningEnvironment({
    ADMIN_API_KEY: "legacy-admin-secret",
    PUBLIC_CERTIFICATE_ALLOW_LEGACY_SECRET_FALLBACK: "true",
  }, () => createPublicCertificateShareToken("613"));

  withSigningEnvironment({ ADMIN_API_KEY: "legacy-admin-secret" }, () => {
    assert.equal(verifyPublicCertificateShareToken("613", legacyToken), false);
  });
});

test("public certificate compatibility is explicit and current plus previous secrets support rotation", { concurrency: false }, () => {
  withSigningEnvironment({
    ADMIN_API_KEY: "legacy-admin-secret",
    PUBLIC_CERTIFICATE_ALLOW_LEGACY_SECRET_FALLBACK: "true",
  }, () => {
    const token = createPublicCertificateShareToken("613");
    assert.equal(verifyPublicCertificateShareToken("613", token), true);
  });

  const oldToken = withSigningEnvironment({
    PUBLIC_CERTIFICATE_SIGNING_SECRET: "certificate-secret-old",
  }, () => createPublicCertificateShareToken("613"));

  withSigningEnvironment({
    PUBLIC_CERTIFICATE_SIGNING_SECRET: "certificate-secret-new",
    PUBLIC_CERTIFICATE_SIGNING_SECRET_PREVIOUS: "certificate-secret-old",
  }, () => {
    assert.equal(verifyPublicCertificateShareToken("613", oldToken), true);
    const newToken = createPublicCertificateShareToken("613");
    assert.equal(verifyPublicCertificateShareToken("613", newToken), true);
    assert.notEqual(newToken, oldToken);
  });
});

test("fresh SUN handoff never falls through to ADMIN_API_KEY by default", { concurrency: false }, () => {
  withSigningEnvironment({ ADMIN_API_KEY: "legacy-admin-secret" }, () => {
    assert.throws(() => createSunFreshHandoffToken(sunInput()), /SUN_HANDOFF_SECRET is required/);
  });

  const legacyToken = withSigningEnvironment({
    ADMIN_API_KEY: "legacy-admin-secret",
    SUN_HANDOFF_ALLOW_LEGACY_SECRET_FALLBACK: "true",
  }, () => createSunFreshHandoffToken(sunInput()));

  withSigningEnvironment({ ADMIN_API_KEY: "legacy-admin-secret" }, () => {
    assert.deepEqual(
      verifySunFreshHandoffToken(legacyToken),
      { ok: false, reason: "fresh_token_secret_missing" },
    );
  });
});

test("fresh SUN compatibility is explicit and rotation preserves UID binding", { concurrency: false }, () => {
  withSigningEnvironment({
    ADMIN_API_KEY: "legacy-admin-secret",
    SUN_HANDOFF_ALLOW_LEGACY_SECRET_FALLBACK: "true",
  }, () => {
    const token = createSunFreshHandoffToken(sunInput());
    assert.equal(verifySunFreshHandoffToken(token, { uidHex: sunInput().uidHex }).ok, true);
  });

  const oldToken = withSigningEnvironment({ SUN_HANDOFF_SECRET: "sun-secret-old" }, () =>
    createSunFreshHandoffToken(sunInput()),
  );

  withSigningEnvironment({
    SUN_HANDOFF_SECRET: "sun-secret-new",
    SUN_HANDOFF_SECRET_PREVIOUS: "sun-secret-old",
  }, () => {
    const expected = {
      bid: sunInput().bid,
      eventId: sunInput().eventId,
      uidHex: sunInput().uidHex,
      readCounter: sunInput().readCounter,
    };
    assert.equal(verifySunFreshHandoffToken(oldToken, expected).ok, true);

    const newToken = createSunFreshHandoffToken(sunInput());
    assert.equal(verifySunFreshHandoffToken(newToken, expected).ok, true);
    assert.notEqual(newToken, oldToken);
  });
});

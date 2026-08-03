import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  canonicalizeOfflineCertificateJson as canonicalizeOnServer,
  createOfflinePublicCertificate,
  readOfflinePublicCertificateJwks,
} from "../src/lib/offline-public-certificate.ts";
import {
  canonicalizeOfflineCertificateJson as canonicalizeInBrowser,
  verifyOfflinePublicCertificate,
} from "../../web/src/lib/offline-public-certificate.ts";

const ENVIRONMENT_KEYS = [
  "OFFLINE_PUBLIC_CERTIFICATE_PRIVATE_JWK",
  "OFFLINE_PUBLIC_CERTIFICATE_JWKS",
  "OFFLINE_PUBLIC_CERTIFICATE_ISSUER",
  "OFFLINE_PUBLIC_CERTIFICATE_TTL_SECONDS",
  "PUBLIC_CERTIFICATE_SIGNING_SECRET",
];
const originalEnvironment = Object.fromEntries(ENVIRONMENT_KEYS.map((key) => [key, process.env[key]]));

async function configureSigner(kid = "nexid-offline-test-2026-01") {
  const keys = await webcrypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const privateJwk = await webcrypto.subtle.exportKey("jwk", keys.privateKey);
  const publicJwk = await webcrypto.subtle.exportKey("jwk", keys.publicKey);
  process.env.OFFLINE_PUBLIC_CERTIFICATE_PRIVATE_JWK = JSON.stringify({
    ...privateJwk,
    kid,
    alg: "ES256",
    use: "sig",
    key_ops: ["sign"],
  });
  process.env.OFFLINE_PUBLIC_CERTIFICATE_JWKS = JSON.stringify({
    keys: [{
      ...publicJwk,
      kid,
      alg: "ES256",
      use: "sig",
      key_ops: ["verify"],
    }],
  });
  process.env.OFFLINE_PUBLIC_CERTIFICATE_ISSUER = "https://api.nexid.lat";
  process.env.OFFLINE_PUBLIC_CERTIFICATE_TTL_SECONDS = "3600";
}

function restoreEnvironment() {
  for (const key of ENVIRONMENT_KEYS) {
    const value = originalEnvironment[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

test.after(restoreEnvironment);

test("ES256 public product certificate verifies with browser WebCrypto and no secret", { concurrency: false }, async () => {
  await configureSigner();
  process.env.PUBLIC_CERTIFICATE_SIGNING_SECRET = "legacy-hmac-must-not-be-used";
  const now = new Date("2026-08-02T12:00:00.000Z");
  const certificate = await createOfflinePublicCertificate({
    tenantSlug: "syngenta-ar",
    bid: "SYN-AR-2026-001-A",
    gtin: "09506000134352",
    lot: "LOT-2026-A",
    serial: "SER-42",
    displayName: "Semilla piloto",
    metadata: {
      internal_customer_email: "must-not-leak@example.test",
      offline_public: {
        brand: "Marca declarada",
        description: "Ficha pública firmada para uso en campo.",
        safety_sheet_url: "https://nexid.lat/public/safety/syn-2026-a",
        secret: "must-not-leak",
      },
    },
    now,
  });
  const jwks = readOfflinePublicCertificateJwks();
  const verification = await verifyOfflinePublicCertificate(certificate, jwks, {
    now: new Date("2026-08-02T12:30:00.000Z"),
    crypto: webcrypto,
  });

  assert.equal(verification.valid, true);
  assert.equal(verification.reason, "verified");
  assert.equal(certificate.alg, "ES256");
  assert.equal(certificate.payload.assurance.nfc_sun_freshness, "NOT_EVALUATED");
  assert.equal(certificate.payload.assurance.physical_authenticity, "NOT_ASSERTED");
  assert.equal(certificate.payload.product_id, "https://id.nexid.lat/01/09506000134352/10/LOT-2026-A/21/SER-42");
  assert.equal(certificate.payload.public_data.brand, "Marca declarada");
  assert.equal(JSON.stringify(certificate).includes("must-not-leak"), false);
  assert.equal(JSON.stringify(jwks).includes('"d"'), false);
  assert.equal(JSON.stringify(certificate).includes("legacy-hmac"), false);
});

test("tampering, expiration and an unknown key fail closed", { concurrency: false }, async () => {
  await configureSigner();
  const issued = new Date("2026-08-02T12:00:00.000Z");
  const certificate = await createOfflinePublicCertificate({
    tenantSlug: "syngenta-ar",
    bid: "SYN-AR-2026-001-A",
    gtin: "09506000134352",
    lot: "LOT-2026-A",
    serial: "SER-42",
    now: issued,
  });
  const jwks = readOfflinePublicCertificateJwks();
  const tampered = structuredClone(certificate);
  tampered.payload.batch_id = "ATTACKER-BATCH";
  assert.deepEqual(
    await verifyOfflinePublicCertificate(tampered, jwks, { now: issued, crypto: webcrypto }),
    { valid: false, reason: "signature_invalid" },
  );
  assert.deepEqual(
    await verifyOfflinePublicCertificate(certificate, { keys: [] }, { now: issued, crypto: webcrypto }),
    { valid: false, reason: "key_not_found" },
  );
  assert.deepEqual(
    await verifyOfflinePublicCertificate(certificate, jwks, { now: new Date("2026-08-02T14:00:01.000Z"), clockSkewSeconds: 0, crypto: webcrypto }),
    { valid: false, reason: "expired" },
  );
});

test("signing configuration mismatch and missing asymmetric keys fail closed", { concurrency: false }, async () => {
  await configureSigner("current-key");
  const jwks = JSON.parse(process.env.OFFLINE_PUBLIC_CERTIFICATE_JWKS);
  jwks.keys[0].kid = "different-key";
  process.env.OFFLINE_PUBLIC_CERTIFICATE_JWKS = JSON.stringify(jwks);
  await assert.rejects(
    createOfflinePublicCertificate({ tenantSlug: "syngenta-ar", bid: "SYN-1", gtin: "09506000134352" }),
    /offline_public_certificate_signer_unavailable/,
  );
  delete process.env.OFFLINE_PUBLIC_CERTIFICATE_PRIVATE_JWK;
  delete process.env.OFFLINE_PUBLIC_CERTIFICATE_JWKS;
  process.env.PUBLIC_CERTIFICATE_SIGNING_SECRET = "hmac-is-not-an-asymmetric-fallback";
  await assert.rejects(
    createOfflinePublicCertificate({ tenantSlug: "syngenta-ar", bid: "SYN-1", gtin: "09506000134352" }),
    /offline_public_certificate_signer_unavailable/,
  );
});

test("public JWKS remains available during a private signer outage while issuance fails closed", { concurrency: false }, async () => {
  await configureSigner("retained-public-key");
  delete process.env.OFFLINE_PUBLIC_CERTIFICATE_PRIVATE_JWK;

  const jwks = readOfflinePublicCertificateJwks();
  assert.equal(jwks.keys.length, 1);
  assert.equal(jwks.keys[0].kid, "retained-public-key");
  assert.equal(Object.hasOwn(jwks.keys[0], "d"), false);
  await assert.rejects(
    createOfflinePublicCertificate({ tenantSlug: "syngenta-ar", bid: "SYN-1", gtin: "09506000134352" }),
    /offline_public_certificate_signer_unavailable/,
  );
});

test("server and browser canonical JSON implementations are byte-identical", () => {
  const value = { z: [3, { b: true, a: "ñ" }], a: null, m: -0 };
  assert.equal(canonicalizeOnServer(value), canonicalizeInBrowser(value));
  assert.equal(canonicalizeOnServer(value), '{"a":null,"m":0,"z":[3,{"a":"ñ","b":true}]}');
});

test("routes and UI preserve the Level 4 trust boundary", async () => {
  const [signer, certificateRoute, jwksRoute, verifier, ui, serviceWorker] = await Promise.all([
    readFile(new URL("../src/lib/offline-public-certificate.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/public/offline-certificates/gs1/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/public/offline-certificates/jwks/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../../web/src/lib/offline-public-certificate.ts", import.meta.url), "utf8"),
    readFile(new URL("../../web/src/app/offline/certificate/offline-certificate-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../web/public/sw.js", import.meta.url), "utf8"),
  ]);
  assert.match(signer, /OFFLINE_PUBLIC_CERTIFICATE_PRIVATE_JWK/);
  assert.match(signer, /OFFLINE_PUBLIC_CERTIFICATE_JWKS/);
  assert.doesNotMatch(signer, /PUBLIC_CERTIFICATE_SIGNING_SECRET|createHmac|KMS|HSM/);
  assert.match(certificateRoute, /resolveActiveGs1Identity/);
  assert.match(certificateRoute, /cache-control.*no-store/i);
  assert.match(jwksRoute, /public, max-age=300, s-maxage=3600/);
  assert.match(verifier, /subtle\.verify/);
  assert.match(verifier, /nfc_sun_freshness/);
  assert.match(ui, /Información pública verificada/);
  assert.doesNotMatch(ui, /autenticidad NFC fresca/i);
  assert.match(serviceWorker, /"\/offline\/certificate"/);
  assert.match(serviceWorker, /caches\.match\("\/offline\/certificate"\)/);
});

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import crc32c from "fast-crc32c";
import {
  POLYGON_CUSTODY_GENERATION_APPROVAL,
  generatePolygonCustodyWallets,
} from "../scripts/generate-polygon-custody-wallets-with-kms.mjs";
import {
  GOOGLE_KMS_GOVERNANCE_ACCESS_TOKEN_ENV,
  GOOGLE_KMS_PUBLISHER_ACCESS_TOKEN_ENV,
} from "../scripts/wrap-wallet-with-kms.mjs";

const publisherKeyResource = "projects/nexid-security-staging/locations/us-east1/keyRings/nexid-staging/cryptoKeys/polygon-publisher-wrap";
const governanceKeyResource = "projects/nexid-security-staging/locations/us-east1/keyRings/nexid-staging/cryptoKeys/polygon-governance-wrap";

async function outputs(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nexid-custody-pair-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return {
    publisherOutput: path.join(directory, "publisher.ct.b64"),
    governanceOutput: path.join(directory, "governance.ct.b64"),
  };
}

function options(paths) {
  return {
    ...paths,
    environment: "staging",
    publisherKeyResource,
    governanceKeyResource,
    transport: "client",
  };
}

test("Polygon custody pair generation produces distinct role-bound ciphertexts without plaintext output", async (t) => {
  const paths = await outputs(t);
  process.env.NEXID_CUSTODY_GENERATION_APPROVED = POLYGON_CUSTODY_GENERATION_APPROVAL;
  const aad = [];
  let calls = 0;
  const client = { async encrypt(request) {
    calls += 1;
    aad.push(request.additionalAuthenticatedData.toString("utf8"));
    const ciphertext = Buffer.from(`ciphertext-${calls}-long-enough-for-validation`, "utf8");
    return [{
      name: `${request.name}/cryptoKeyVersions/1`,
      ciphertext,
      ciphertextCrc32c: { value: crc32c.calculate(ciphertext) },
      verifiedPlaintextCrc32c: true,
      verifiedAdditionalAuthenticatedDataCrc32c: true,
      protectionLevel: "SOFTWARE",
    }];
  } };

  const result = await generatePolygonCustodyWallets(options(paths), { client });
  assert.notEqual(result.publisher.address, result.governance.address);
  assert.deepEqual(aad, [
    "nexid.wallet.wrap.v1|staging|polygon|publisher",
    "nexid.wallet.wrap.v1|staging|polygon|governance",
  ]);
  assert.doesNotMatch(await readFile(paths.publisherOutput, "ascii"), /0x[0-9a-f]{64}/i);
  assert.doesNotMatch(await readFile(paths.governanceOutput, "ascii"), /0x[0-9a-f]{64}/i);
  assert.equal(process.env.NEXID_CUSTODY_GENERATION_APPROVED, undefined);
});

test("pair generation removes only its first newly-created ciphertext when the second KMS call fails", async (t) => {
  const paths = await outputs(t);
  process.env.NEXID_CUSTODY_GENERATION_APPROVED = POLYGON_CUSTODY_GENERATION_APPROVAL;
  let calls = 0;
  const client = { async encrypt(request) {
    calls += 1;
    if (calls === 2) throw new Error("upstream secret must not surface");
    const ciphertext = Buffer.from("first-ciphertext-long-enough-for-validation", "utf8");
    return [{
      name: `${request.name}/cryptoKeyVersions/1`,
      ciphertext,
      ciphertextCrc32c: { value: crc32c.calculate(ciphertext) },
      verifiedPlaintextCrc32c: true,
      verifiedAdditionalAuthenticatedDataCrc32c: true,
      protectionLevel: "SOFTWARE",
    }];
  } };

  await assert.rejects(() => generatePolygonCustodyWallets(options(paths), { client }), /kms_encrypt_failed/);
  await assert.rejects(() => stat(paths.publisherOutput), { code: "ENOENT" });
  await assert.rejects(() => stat(paths.governanceOutput), { code: "ENOENT" });
});

test("REST pair generation uses a different ephemeral OAuth token for each custody role", async (t) => {
  const paths = await outputs(t);
  const publisherToken = "ya29.publisher-isolated-service-account-token-123";
  const governanceToken = "ya29.governance-isolated-service-account-token-456";
  process.env.NEXID_CUSTODY_GENERATION_APPROVED = POLYGON_CUSTODY_GENERATION_APPROVAL;
  process.env[GOOGLE_KMS_PUBLISHER_ACCESS_TOKEN_ENV] = publisherToken;
  process.env[GOOGLE_KMS_GOVERNANCE_ACCESS_TOKEN_ENV] = governanceToken;
  const calls = [];
  const fetchImpl = async (url, request) => {
    const body = JSON.parse(request.body);
    calls.push({ authorization: request.headers.Authorization, aad: body.additionalAuthenticatedData });
    const ciphertext = Buffer.from(`ciphertext-${calls.length}-long-enough-for-validation`, "utf8");
    const keyResource = String(url).match(/^https:\/\/cloudkms\.googleapis\.com\/v1\/(.+):encrypt$/)?.[1];
    return {
      ok: true,
      async text() {
        return JSON.stringify({
          name: `${keyResource}/cryptoKeyVersions/1`,
          ciphertext: ciphertext.toString("base64"),
          ciphertextCrc32c: String(crc32c.calculate(ciphertext)),
          verifiedPlaintextCrc32c: true,
          verifiedAdditionalAuthenticatedDataCrc32c: true,
          protectionLevel: "SOFTWARE",
        });
      },
    };
  };

  await generatePolygonCustodyWallets({ ...options(paths), transport: "rest" }, { fetchImpl });
  assert.deepEqual(calls.map((call) => call.authorization), [
    `Bearer ${publisherToken}`,
    `Bearer ${governanceToken}`,
  ]);
  assert.equal(process.env[GOOGLE_KMS_PUBLISHER_ACCESS_TOKEN_ENV], undefined);
  assert.equal(process.env[GOOGLE_KMS_GOVERNANCE_ACCESS_TOKEN_ENV], undefined);
});

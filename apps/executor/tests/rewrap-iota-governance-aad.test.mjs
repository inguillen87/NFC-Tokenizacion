import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Wallet } from "ethers";
import crc32c from "fast-crc32c";
import {
  IOTA_GOVERNANCE_REWRAP_APPROVAL,
  rewrapWrappedWalletAad,
} from "../scripts/rewrap-iota-governance-aad.mjs";
import {
  GOOGLE_KMS_GOVERNANCE_ACCESS_TOKEN_ENV,
  GOOGLE_KMS_PUBLISHER_ACCESS_TOKEN_ENV,
} from "../src/wrapped-kms-signer.mjs";

const privateKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a841cb6b37e8db1e1cb";
const wallet = new Wallet(privateKey);
const sourceKeyResource = "projects/nexid-security-staging/locations/us-east1/keyRings/nexid-staging/cryptoKeys/iota-governance-old";
const targetKeyResource = "projects/nexid-security-staging/locations/us-east1/keyRings/nexid-staging/cryptoKeys/iota-governance-new";

test("IOTA rewrap changes publisher AAD to governance AAD entirely in memory", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nexid-iota-rewrap-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const inputPath = path.join(directory, "old.ct.b64");
  const outputPath = path.join(directory, "new.ct.b64");
  const oldCiphertext = Buffer.from("old-ciphertext-long-enough-for-validation", "utf8");
  const newCiphertext = Buffer.from("new-ciphertext-long-enough-for-validation", "utf8");
  await writeFile(inputPath, oldCiphertext.toString("base64"), "ascii");
  const publisherToken = "ya29.iota-old-publisher-aad-token-123456";
  const governanceToken = "ya29.iota-new-governance-aad-token-12345";
  process.env[GOOGLE_KMS_PUBLISHER_ACCESS_TOKEN_ENV] = publisherToken;
  process.env[GOOGLE_KMS_GOVERNANCE_ACCESS_TOKEN_ENV] = governanceToken;
  const requests = [];
  const fetchImpl = async (url, request) => {
    const body = JSON.parse(request.body);
    requests.push({ url, authorization: request.headers.Authorization, aad: body.additionalAuthenticatedData });
    if (String(url).endsWith(":decrypt")) {
      const plaintext = Buffer.from(privateKey, "ascii");
      return { ok: true, async text() { return JSON.stringify({
        plaintext: plaintext.toString("base64"),
        plaintextCrc32c: String(crc32c.calculate(plaintext)),
        verifiedCiphertextCrc32c: true,
        verifiedAdditionalAuthenticatedDataCrc32c: true,
      }); } };
    }
    return { ok: true, async text() { return JSON.stringify({
      name: `${targetKeyResource}/cryptoKeyVersions/1`,
      ciphertext: newCiphertext.toString("base64"),
      ciphertextCrc32c: String(crc32c.calculate(newCiphertext)),
      verifiedPlaintextCrc32c: true,
      verifiedAdditionalAuthenticatedDataCrc32c: true,
      protectionLevel: "SOFTWARE",
    }); } };
  };

  const result = await rewrapWrappedWalletAad({
    domain: "iota",
    environment: "staging",
    sourceRole: "publisher",
    targetRole: "governance",
    expectedChainId: 1076,
    expectedAddress: wallet.address,
    sourceKeyResource,
    targetKeyResource,
    inputPath,
    outputPath,
    transport: "rest",
    confirmation: IOTA_GOVERNANCE_REWRAP_APPROVAL,
  }, { fetchImpl });

  assert.equal(result.address, wallet.address);
  assert.deepEqual(requests.map((item) => item.authorization), [`Bearer ${publisherToken}`, `Bearer ${governanceToken}`]);
  assert.deepEqual(requests.map((item) => item.aad), [
    Buffer.from("nexid.wallet.wrap.v1|staging|iota|publisher").toString("base64"),
    Buffer.from("nexid.wallet.wrap.v1|staging|iota|governance").toString("base64"),
  ]);
  assert.equal(await readFile(outputPath, "ascii"), newCiphertext.toString("base64"));
  assert.doesNotMatch(await readFile(outputPath, "ascii"), new RegExp(privateKey.slice(2), "i"));
});

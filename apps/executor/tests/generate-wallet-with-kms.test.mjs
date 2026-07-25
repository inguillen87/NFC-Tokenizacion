import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Wallet } from "ethers";
import crc32c from "fast-crc32c";
import { generateWalletWithKms } from "../scripts/generate-wallet-with-kms.mjs";

const keyResource = "projects/nexid-security-staging/locations/us-east1/keyRings/nexid-staging/cryptoKeys/iota-wallet-wrap-pilot";

test("generated runtime wallet is immediately KMS-wrapped and never returned as plaintext", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nexid-generated-wallet-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const outputPath = path.join(directory, "wallet.ct.b64");
  const ciphertext = Buffer.from("generated-wallet-ciphertext", "utf8");
  let generatedPrivateKey;

  const result = await generateWalletWithKms({
    environment: "staging",
    domain: "iota",
    keyResource,
    outputPath,
  }, {
    client: {
      async encrypt(request) {
        generatedPrivateKey = request.plaintext.toString("ascii");
        return [{
          name: `${keyResource}/cryptoKeyVersions/1`,
          ciphertext,
          ciphertextCrc32c: { value: crc32c.calculate(ciphertext) },
          verifiedPlaintextCrc32c: true,
          verifiedAdditionalAuthenticatedDataCrc32c: true,
          protectionLevel: "SOFTWARE",
        }];
      },
    },
  });

  assert.match(generatedPrivateKey, /^0x[0-9a-f]{64}$/i);
  assert.equal(new Wallet(generatedPrivateKey).address, result.address);
  assert.equal(Object.hasOwn(result, "privateKey"), false);
  assert.equal(await readFile(outputPath, "ascii"), ciphertext.toString("base64"));
  assert.equal(process.env.NEXID_GENERATED_WALLET_PRIVATE_KEY, undefined);
});

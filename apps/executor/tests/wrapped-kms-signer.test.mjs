import assert from "node:assert/strict";
import test from "node:test";
import { Wallet } from "ethers";
import crc32c from "fast-crc32c";
import {
  GOOGLE_KMS_ACCESS_TOKEN_ENV,
  GOOGLE_KMS_GOVERNANCE_ACCESS_TOKEN_ENV,
  GOOGLE_KMS_PUBLISHER_ACCESS_TOKEN_ENV,
  kmsWrapAad,
  signWithWrappedKms,
  wrappedKmsConfigured,
} from "../src/wrapped-kms-signer.mjs";

const privateKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a841cb6b37e8db1e1cb";
const wallet = new Wallet(privateKey);
const keyResource = "projects/nexid-security-staging/locations/us-east1/keyRings/nexid-staging/cryptoKeys/polygon-wallet-wrap-pilot";
const wrappedPrivateKey = Buffer.from("ciphertext-long-enough-for-config-validation-v1", "utf8").toString("base64");
const transaction = {
  type: 2,
  to: "0x0000000000000000000000000000000000000001",
  data: "0x1234",
  nonce: 3,
  value: "0",
  gas_limit: "50000",
  chain_id: 80002,
  max_fee_per_gas: "10",
  max_priority_fee_per_gas: "1",
};

test("wrapped KMS config is domain-bound and fails closed", () => {
  assert.equal(wrappedKmsConfigured({ domain: "polygon" }), false);
  assert.equal(wrappedKmsConfigured({
    domain: "polygon",
    environment: "staging",
    keyResource,
    wrappedPrivateKey,
  }), true);
  assert.equal(wrappedKmsConfigured({
    domain: "iota",
    environment: "staging",
    keyResource: "projects/not valid",
    wrappedPrivateKey,
  }), false);
  assert.equal(kmsWrapAad("polygon", "staging").toString("utf8"), "nexid.wallet.wrap.v1|staging|polygon|publisher");
  assert.equal(kmsWrapAad("polygon", "staging", "governance").toString("utf8"), "nexid.wallet.wrap.v1|staging|polygon|governance");
  assert.notDeepEqual(kmsWrapAad("polygon", "staging"), kmsWrapAad("iota", "staging"));
});

test("wrapped KMS REST decrypt consumes an ephemeral token and verifies request CRCs", async () => {
  const accessToken = "ya29.nexid-kms-migration-test-token-123456789";
  process.env[GOOGLE_KMS_ACCESS_TOKEN_ENV] = accessToken;
  let request;
  const plaintext = Buffer.from(privateKey, "utf8");
  const fetchImpl = async (_url, input) => {
    request = input;
    return {
      ok: true,
      async text() {
        return JSON.stringify({
          plaintext: plaintext.toString("base64"),
          plaintextCrc32c: String(crc32c.calculate(plaintext)),
          verifiedCiphertextCrc32c: true,
          verifiedAdditionalAuthenticatedDataCrc32c: true,
        });
      },
    };
  };
  const result = await signWithWrappedKms({
    chainId: 80002,
    expectedSignerAddress: wallet.address,
    transaction,
  }, {
    domain: "polygon",
    environment: "staging",
    role: "governance",
    transport: "rest",
    keyResource,
    wrappedPrivateKey,
  }, { fetchImpl });

  assert.equal(result.signerAddress, wallet.address);
  assert.equal(process.env[GOOGLE_KMS_ACCESS_TOKEN_ENV], undefined);
  assert.equal(request.headers.Authorization, `Bearer ${accessToken}`);
  const body = JSON.parse(request.body);
  assert.equal(body.additionalAuthenticatedData, Buffer.from("nexid.wallet.wrap.v1|staging|polygon|governance").toString("base64"));
  assert.equal(body.ciphertext, wrappedPrivateKey);
  assert.equal(body.ciphertextCrc32c, String(crc32c.calculate(Buffer.from(wrappedPrivateKey, "base64"))));
});

test("REST decrypt accepts Google responses that omit request-verification flags", async () => {
  const accessToken = "ya29.google-realistic-decrypt-response-token-123";
  process.env[GOOGLE_KMS_PUBLISHER_ACCESS_TOKEN_ENV] = accessToken;
  const plaintext = Buffer.from(privateKey, "utf8");
  const result = await signWithWrappedKms({
    chainId: 80002,
    expectedSignerAddress: wallet.address,
    transaction,
  }, {
    domain: "polygon",
    environment: "staging",
    role: "publisher",
    transport: "rest",
    keyResource,
    wrappedPrivateKey,
  }, { fetchImpl: async () => ({
    ok: true,
    async text() {
      return JSON.stringify({
        plaintext: plaintext.toString("base64"),
        plaintextCrc32c: String(crc32c.calculate(plaintext)),
        protectionLevel: "SOFTWARE",
        usedPrimary: false,
      });
    },
  }) });
  assert.equal(result.signerAddress, wallet.address);
});

test("REST decrypt rejects an explicit negative request-verification flag", async () => {
  process.env[GOOGLE_KMS_PUBLISHER_ACCESS_TOKEN_ENV] = "ya29.google-negative-crc-flag-test-token-123";
  const plaintext = Buffer.from(privateKey, "utf8");
  await assert.rejects(() => signWithWrappedKms({
    chainId: 80002,
    expectedSignerAddress: wallet.address,
    transaction,
  }, {
    domain: "polygon",
    environment: "staging",
    role: "publisher",
    transport: "rest",
    keyResource,
    wrappedPrivateKey,
  }, { fetchImpl: async () => ({
    ok: true,
    async text() {
      return JSON.stringify({
        plaintext: plaintext.toString("base64"),
        plaintextCrc32c: String(crc32c.calculate(plaintext)),
        verifiedCiphertextCrc32c: false,
      });
    },
  }) }), /kms_rest_request_crc32c_unverified/);
});

test("REST decrypt keeps governance and publisher OAuth credentials role-scoped", async () => {
  const governanceToken = "ya29.nexid-governance-role-token-123456789";
  const publisherToken = "ya29.nexid-publisher-role-token-1234567890";
  process.env[GOOGLE_KMS_GOVERNANCE_ACCESS_TOKEN_ENV] = governanceToken;
  process.env[GOOGLE_KMS_PUBLISHER_ACCESS_TOKEN_ENV] = publisherToken;
  const authorizations = [];
  const aad = [];
  const plaintext = Buffer.from(privateKey, "utf8");
  const fetchImpl = async (_url, input) => {
    authorizations.push(input.headers.Authorization);
    aad.push(JSON.parse(input.body).additionalAuthenticatedData);
    return {
      ok: true,
      async text() {
        return JSON.stringify({
          plaintext: plaintext.toString("base64"),
          plaintextCrc32c: String(crc32c.calculate(plaintext)),
          verifiedCiphertextCrc32c: true,
          verifiedAdditionalAuthenticatedDataCrc32c: true,
        });
      },
    };
  };
  for (const role of ["governance", "publisher"]) {
    await signWithWrappedKms({
      chainId: 80002,
      expectedSignerAddress: wallet.address,
      transaction,
    }, {
      domain: "polygon",
      environment: "staging",
      role,
      transport: "rest",
      keyResource,
      wrappedPrivateKey,
    }, { fetchImpl });
  }
  assert.deepEqual(authorizations, [`Bearer ${governanceToken}`, `Bearer ${publisherToken}`]);
  assert.deepEqual(aad, [
    Buffer.from("nexid.wallet.wrap.v1|staging|polygon|governance").toString("base64"),
    Buffer.from("nexid.wallet.wrap.v1|staging|polygon|publisher").toString("base64"),
  ]);
  assert.equal(process.env[GOOGLE_KMS_GOVERNANCE_ACCESS_TOKEN_ENV], undefined);
  assert.equal(process.env[GOOGLE_KMS_PUBLISHER_ACCESS_TOKEN_ENV], undefined);
});

test("wrapped KMS signer decrypts with AAD and locally verifies the transaction", async () => {
  let decryptRequest;
  let decryptOptions;
  const client = {
    async decrypt(request, options) {
      decryptRequest = request;
      decryptOptions = options;
      const plaintext = Buffer.from(privateKey, "utf8");
      return [{ plaintext, plaintextCrc32c: { value: crc32c.calculate(plaintext) } }];
    },
  };
  const result = await signWithWrappedKms({
    chainId: 80002,
    expectedSignerAddress: wallet.address,
    transaction,
  }, {
    domain: "polygon",
    environment: "staging",
    keyResource,
    wrappedPrivateKey,
  }, { client });

  assert.equal(decryptRequest.name, keyResource);
  assert.equal(decryptRequest.ciphertext.toString("base64"), wrappedPrivateKey);
  assert.equal(decryptRequest.ciphertextCrc32c.value, crc32c.calculate(decryptRequest.ciphertext));
  assert.equal(decryptRequest.additionalAuthenticatedData.toString("utf8"), "nexid.wallet.wrap.v1|staging|polygon|publisher");
  assert.equal(decryptRequest.additionalAuthenticatedDataCrc32c.value, crc32c.calculate(decryptRequest.additionalAuthenticatedData));
  assert.equal(decryptOptions.timeout, 10_000);
  assert.equal(result.signerAddress, wallet.address);
  assert.match(result.signedTransaction, /^0x[0-9a-f]+$/i);
  assert.match(result.transactionHash, /^0x[0-9a-f]{64}$/i);
});

test("wrapped KMS signer rejects a different wallet and never falls back", async () => {
  const client = { async decrypt() {
    const plaintext = Buffer.from(privateKey, "utf8");
    return [{ plaintext, plaintextCrc32c: { value: crc32c.calculate(plaintext) } }];
  } };
  await assert.rejects(() => signWithWrappedKms({
    chainId: 80002,
    expectedSignerAddress: "0x0000000000000000000000000000000000000002",
    transaction,
  }, {
    domain: "polygon",
    environment: "staging",
    keyResource,
    wrappedPrivateKey,
  }, { client }), /kms_signer_address_mismatch/);

  const malformedClient = { async decrypt() {
    const plaintext = Buffer.from("not-a-private-key", "utf8");
    return [{ plaintext, plaintextCrc32c: { value: crc32c.calculate(plaintext) } }];
  } };
  await assert.rejects(() => signWithWrappedKms({
    chainId: 80002,
    expectedSignerAddress: wallet.address,
    transaction,
  }, {
    domain: "polygon",
    environment: "staging",
    keyResource,
    wrappedPrivateKey,
  }, { client: malformedClient }), /kms_plaintext_private_key_invalid/);
});

test("wrapped KMS signer rejects the wrong chain before decrypting", async () => {
  let decryptCalls = 0;
  const client = { async decrypt() { decryptCalls += 1; return [{}]; } };
  await assert.rejects(() => signWithWrappedKms({
    chainId: 137,
    expectedSignerAddress: wallet.address,
    transaction: { ...transaction, chain_id: 137 },
  }, {
    domain: "polygon",
    environment: "staging",
    expectedChainId: 80002,
    keyResource,
    wrappedPrivateKey,
  }, { client }), /kms_expected_chain_id_mismatch/);
  assert.equal(decryptCalls, 0);
});

test("wrapped KMS signer fails closed on a missing or corrupt plaintext CRC32C", async () => {
  for (const plaintextCrc32c of [undefined, { value: 1 }]) {
    const plaintext = Buffer.from(privateKey, "utf8");
    const client = { async decrypt() { return [{ plaintext, plaintextCrc32c }]; } };
    await assert.rejects(() => signWithWrappedKms({
      chainId: 80002,
      expectedSignerAddress: wallet.address,
      transaction,
    }, {
      domain: "polygon",
      environment: "staging",
      keyResource,
      wrappedPrivateKey,
      decryptTimeoutMs: 2_500,
    }, { client }), /kms_plaintext_crc32c_mismatch/);
    assert.equal(plaintext.every((byte) => byte === 0), true);
  }
});

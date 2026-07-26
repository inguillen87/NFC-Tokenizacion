import assert from "node:assert/strict";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Wallet } from "ethers";
import crc32c from "fast-crc32c";
import {
  GOOGLE_KMS_ACCESS_TOKEN_ENV,
  WalletWrapError,
  publicErrorCode,
  runCli,
  wrapWalletWithKms,
} from "../scripts/wrap-wallet-with-kms.mjs";

const privateKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a841cb6b37e8db1e1cb";
const address = new Wallet(privateKey).address;
const keyResource = "projects/nexid-security-staging/locations/us-east1/keyRings/nexid-staging/cryptoKeys/polygon-wallet-wrap-pilot";
const responseName = `${keyResource}/cryptoKeyVersions/1`;
const ciphertext = Buffer.from("validated-google-kms-ciphertext", "utf8");
const accessToken = "ya29.nexid-local-test-access-token-1234567890";

function successResponse(overrides = {}) {
  return {
    name: responseName,
    ciphertext,
    ciphertextCrc32c: { value: crc32c.calculate(ciphertext) },
    verifiedPlaintextCrc32c: true,
    verifiedAdditionalAuthenticatedDataCrc32c: true,
    protectionLevel: "SOFTWARE",
    ...overrides,
  };
}

function restSuccessResponse(overrides = {}) {
  return {
    ...successResponse(),
    ciphertext: ciphertext.toString("base64"),
    ciphertextCrc32c: String(crc32c.calculate(ciphertext)),
    ...overrides,
  };
}

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async text() { return JSON.stringify(body); },
  };
}

function options(outputPath, privateKeyEnvName) {
  return {
    privateKeyEnvName,
    expectedAddress: address,
    environment: "staging",
    domain: "polygon",
    keyResource,
    outputPath,
  };
}

async function tempOutput(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nexid-wrap-wallet-"));
  t.after(async () => {
    await import("node:fs/promises").then(({ rm }) => rm(directory, { recursive: true, force: true }));
  });
  return path.join(directory, "wallet.ct.b64");
}

test("wrap tool binds the wallet and AAD, validates CRC32C, and writes only base64", async (t) => {
  const outputPath = await tempOutput(t);
  const envName = "NEXID_TEST_WRAP_PRIVATE_KEY_SUCCESS";
  process.env[envName] = privateKey;
  let request;
  let callOptions;
  let plaintextWasCanonical = false;
  const client = { async encrypt(input, settings) {
    request = input;
    callOptions = settings;
    plaintextWasCanonical = input.plaintext.toString("ascii") === privateKey;
    return [successResponse()];
  } };

  const result = await wrapWalletWithKms(options(outputPath, envName), { client });

  assert.equal(process.env[envName], undefined);
  assert.equal(request.name, keyResource);
  assert.equal(plaintextWasCanonical, true);
  assert.equal(request.plaintextCrc32c.value, crc32c.calculate(Buffer.from(privateKey, "ascii")));
  assert.equal(request.additionalAuthenticatedData.toString("utf8"), "nexid.wallet.wrap.v1|staging|polygon|publisher");
  assert.equal(request.additionalAuthenticatedDataCrc32c.value, crc32c.calculate(request.additionalAuthenticatedData));
  assert.equal(callOptions.timeout, 10_000);
  assert.equal(request.plaintext.every((value) => value === 0), true);
  assert.equal(await readFile(outputPath, "ascii"), ciphertext.toString("base64"));
  assert.equal((await readFile(outputPath, "ascii")).includes(privateKey.slice(2)), false);
  if (process.platform !== "win32") assert.equal((await stat(outputPath)).mode & 0o777, 0o600);
  assert.deepEqual(result, {
    address,
    domain: "polygon",
    role: "publisher",
    environment: "staging",
    outputPath,
    ciphertextBytes: ciphertext.length,
  });
});

test("wrap tool rejects an address mismatch before contacting KMS", async (t) => {
  const outputPath = await tempOutput(t);
  const envName = "NEXID_TEST_WRAP_PRIVATE_KEY_MISMATCH";
  process.env[envName] = privateKey;
  let calls = 0;
  const client = { async encrypt() { calls += 1; return [successResponse()]; } };

  await assert.rejects(() => wrapWalletWithKms({
    ...options(outputPath, envName),
    expectedAddress: "0x0000000000000000000000000000000000000001",
  }, { client }), (error) => error instanceof WalletWrapError && error.code === "wallet_address_mismatch");

  assert.equal(calls, 0);
  assert.equal(process.env[envName], undefined);
  await assert.rejects(() => stat(outputPath), { code: "ENOENT" });
});

test("wrap tool fails closed when Google does not verify input checksums", async (t) => {
  for (const [suffix, response] of [
    ["PLAINTEXT", successResponse({ verifiedPlaintextCrc32c: false })],
    ["AAD", successResponse({ verifiedAdditionalAuthenticatedDataCrc32c: false })],
    ["CIPHERTEXT", successResponse({ ciphertextCrc32c: { value: 1 } })],
    ["PROTECTION", successResponse({ protectionLevel: "HSM" })],
    ["KEY", successResponse({ name: "projects/other-project/locations/us-east1/keyRings/other/cryptoKeys/other/cryptoKeyVersions/1" })],
  ]) {
    const outputPath = await tempOutput(t);
    const envName = `NEXID_TEST_WRAP_PRIVATE_KEY_BAD_${suffix}`;
    process.env[envName] = privateKey;
    let plaintext;
    const client = { async encrypt(request) {
      plaintext = request.plaintext;
      return [response];
    } };

    await assert.rejects(() => wrapWalletWithKms(options(outputPath, envName), { client }), WalletWrapError);
    assert.equal(plaintext.every((value) => value === 0), true);
    assert.equal(process.env[envName], undefined);
    await assert.rejects(() => stat(outputPath), { code: "ENOENT" });
  }
});

test("wrap tool never overwrites an existing output", async (t) => {
  const outputPath = await tempOutput(t);
  const envName = "NEXID_TEST_WRAP_PRIVATE_KEY_EXCLUSIVE";
  const sentinel = "do-not-overwrite";
  await writeFile(outputPath, sentinel, "ascii");
  process.env[envName] = privateKey;
  const client = { async encrypt() { return [successResponse()]; } };

  await assert.rejects(() => wrapWalletWithKms(options(outputPath, envName), { client }), (error) => (
    error instanceof WalletWrapError && error.code === "output_already_exists"
  ));
  assert.equal(await readFile(outputPath, "ascii"), sentinel);
});

test("wrap tool sanitizes KMS dependency failures and wipes its request buffer", async (t) => {
  const outputPath = await tempOutput(t);
  const envName = "NEXID_TEST_WRAP_PRIVATE_KEY_KMS_FAILURE";
  process.env[envName] = privateKey;
  let plaintext;
  const client = { async encrypt(request) {
    plaintext = request.plaintext;
    throw new Error(`upstream leaked ${privateKey}`);
  } };

  await assert.rejects(() => wrapWalletWithKms(options(outputPath, envName), { client }), (error) => (
    error instanceof WalletWrapError
    && error.code === "kms_encrypt_failed"
    && !error.message.includes(privateKey)
  ));
  assert.equal(plaintext.every((value) => value === 0), true);
  assert.equal(process.env[envName], undefined);
  await assert.rejects(() => stat(outputPath), { code: "ENOENT" });
});

test("REST transport derives the official endpoint and sends the same CRC32C/AAD contract", async (t) => {
  const outputPath = await tempOutput(t);
  const envName = "NEXID_TEST_WRAP_PRIVATE_KEY_REST";
  process.env[envName] = privateKey;
  process.env[GOOGLE_KMS_ACCESS_TOKEN_ENV] = accessToken;
  let url;
  let request;
  let clientCalls = 0;
  const fetchImpl = async (input, init) => {
    url = input;
    request = init;
    return jsonResponse(restSuccessResponse());
  };
  const client = { async encrypt() { clientCalls += 1; return [successResponse()]; } };

  await wrapWalletWithKms({
    ...options(outputPath, envName),
    transport: "rest",
  }, { client, fetchImpl });

  assert.equal(clientCalls, 0);
  assert.equal(url, `https://cloudkms.googleapis.com/v1/${keyResource}:encrypt`);
  assert.equal(request.method, "POST");
  assert.equal(request.redirect, "error");
  assert.equal(request.headers.Authorization, `Bearer ${accessToken}`);
  assert.equal(request.headers["Content-Type"], "application/json");
  assert.equal(request.signal instanceof AbortSignal, true);
  const body = JSON.parse(request.body);
  assert.equal(body.plaintext, Buffer.from(privateKey, "ascii").toString("base64"));
  assert.equal(body.additionalAuthenticatedData, Buffer.from("nexid.wallet.wrap.v1|staging|polygon|publisher").toString("base64"));
  assert.equal(body.plaintextCrc32c, String(crc32c.calculate(Buffer.from(privateKey, "ascii"))));
  assert.equal(body.additionalAuthenticatedDataCrc32c, String(crc32c.calculate(Buffer.from("nexid.wallet.wrap.v1|staging|polygon|publisher"))));
  assert.equal(process.env[GOOGLE_KMS_ACCESS_TOKEN_ENV], undefined);
  assert.equal(process.env[envName], undefined);
  assert.equal(await readFile(outputPath, "ascii"), ciphertext.toString("base64"));
});

test("REST transport sanitizes token-bearing fetch failures without client fallback", async (t) => {
  const outputPath = await tempOutput(t);
  const envName = "NEXID_TEST_WRAP_PRIVATE_KEY_REST_FAILURE";
  process.env[envName] = privateKey;
  process.env[GOOGLE_KMS_ACCESS_TOKEN_ENV] = accessToken;
  let clientCalls = 0;
  const fetchImpl = async () => { throw new Error(`upstream leaked ${accessToken}`); };
  const client = { async encrypt() { clientCalls += 1; return [successResponse()]; } };

  await assert.rejects(() => wrapWalletWithKms({
    ...options(outputPath, envName),
    transport: "rest",
  }, { client, fetchImpl }), (error) => (
    error instanceof WalletWrapError
    && error.code === "kms_rest_encrypt_failed"
    && !error.message.includes(accessToken)
  ));
  assert.equal(clientCalls, 0);
  assert.equal(process.env[GOOGLE_KMS_ACCESS_TOKEN_ENV], undefined);
  assert.equal(process.env[envName], undefined);
  await assert.rejects(() => stat(outputPath), { code: "ENOENT" });
});

test("REST transport applies strict response validation and never accepts a token argument", async (t) => {
  const outputPath = await tempOutput(t);
  const envName = "NEXID_TEST_WRAP_PRIVATE_KEY_REST_INVALID";
  process.env[envName] = privateKey;
  process.env[GOOGLE_KMS_ACCESS_TOKEN_ENV] = accessToken;
  const fetchImpl = async () => jsonResponse(restSuccessResponse({ verifiedPlaintextCrc32c: false }));

  await assert.rejects(() => wrapWalletWithKms({
    ...options(outputPath, envName),
    transport: "rest",
  }, { fetchImpl }), (error) => error instanceof WalletWrapError && error.code === "kms_plaintext_crc32c_unverified");
  await assert.rejects(() => stat(outputPath), { code: "ENOENT" });

  await assert.rejects(() => runCli(["--access-token", accessToken]), (error) => (
    error instanceof WalletWrapError && error.code === "cli_arguments_invalid"
  ));
});

test("REST transport bounds the single request with the configured timeout", async (t) => {
  const outputPath = await tempOutput(t);
  const envName = "NEXID_TEST_WRAP_PRIVATE_KEY_REST_TIMEOUT";
  process.env[envName] = privateKey;
  process.env[GOOGLE_KMS_ACCESS_TOKEN_ENV] = accessToken;
  const fetchImpl = async (_url, request) => new Promise((_resolve, reject) => {
    request.signal.addEventListener("abort", () => reject(new Error(`timeout leaked ${accessToken}`)), { once: true });
  });

  await assert.rejects(() => wrapWalletWithKms({
    ...options(outputPath, envName),
    transport: "rest",
    timeoutMs: 5,
  }, { fetchImpl }), (error) => (
    error instanceof WalletWrapError
    && error.code === "kms_rest_encrypt_failed"
    && !error.message.includes(accessToken)
  ));
  assert.equal(process.env[GOOGLE_KMS_ACCESS_TOKEN_ENV], undefined);
  assert.equal(process.env[envName], undefined);
  await assert.rejects(() => stat(outputPath), { code: "ENOENT" });
});

test("wrap tool maps unexpected errors to a non-sensitive public code", () => {
  assert.equal(publicErrorCode(new Error("secret from a dependency")), "wallet_wrap_failed");
  assert.equal(publicErrorCode(new WalletWrapError("kms_encrypt_failed")), "kms_encrypt_failed");
});

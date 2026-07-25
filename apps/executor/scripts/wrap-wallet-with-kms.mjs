import { open, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { KeyManagementServiceClient } from "@google-cloud/kms";
import { computeAddress, getAddress, isAddress, SigningKey } from "ethers";
import crc32c from "fast-crc32c";
import { kmsWrapAad } from "../src/wrapped-kms-signer.mjs";

const PRIVATE_KEY_ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;
const KMS_KEY_RESOURCE = /^projects\/[a-z][a-z0-9-]{4,28}[a-z0-9]\/locations\/[a-z0-9-]+\/keyRings\/[A-Za-z0-9_-]{1,63}\/cryptoKeys\/[A-Za-z0-9_-]{1,63}$/;
const ACCESS_TOKEN = /^[A-Za-z0-9._~+/-]+=*$/;
const MAX_TIMEOUT_MS = 30_000;
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_REST_RESPONSE_BYTES = 128 * 1024;
export const GOOGLE_KMS_ACCESS_TOKEN_ENV = "NEXID_GCP_KMS_ACCESS_TOKEN";

export class WalletWrapError extends Error {
  constructor(code) {
    super(code);
    this.name = "WalletWrapError";
    this.code = code;
  }
}

function fail(code) {
  throw new WalletWrapError(code);
}

function normalizePrivateKeyEnvName(value) {
  const name = String(value || "").trim();
  if (!PRIVATE_KEY_ENV_NAME.test(name)) fail("private_key_env_name_invalid");
  return name;
}

function takePrivateKeyFromEnvironment(nameValue) {
  const name = normalizePrivateKeyEnvName(nameValue);
  const value = process.env[name];
  delete process.env[name];
  if (typeof value !== "string" || !value.trim()) fail("private_key_env_missing");

  const normalized = value.trim();
  if (!/^(?:0x)?[0-9a-f]{64}$/i.test(normalized)) fail("private_key_env_invalid");
  const hex = normalized.replace(/^0x/i, "").toLowerCase();
  const rawPrivateKey = Buffer.from(hex, "hex");
  const plaintext = Buffer.from(`0x${hex}`, "ascii");
  return { plaintext, rawPrivateKey };
}

function normalizeExpectedAddress(value) {
  const address = String(value || "").trim();
  if (!isAddress(address)) fail("expected_address_invalid");
  return getAddress(address);
}

function normalizeKeyResource(value) {
  const resource = String(value || "").trim();
  if (!KMS_KEY_RESOURCE.test(resource)) fail("kms_key_resource_invalid");
  return resource;
}

function normalizeTimeout(value) {
  if (value === undefined || value === null || value === "") return DEFAULT_TIMEOUT_MS;
  const timeoutMs = Number(value);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > MAX_TIMEOUT_MS) {
    fail("kms_encrypt_timeout_invalid");
  }
  return timeoutMs;
}

function normalizeOutputPath(value) {
  const output = String(value || "").trim();
  if (!output || output.includes("\0")) fail("output_path_invalid");
  return path.resolve(output);
}

function normalizeTransport(value) {
  const transport = String(value || "client").trim().toLowerCase();
  if (transport !== "client" && transport !== "rest") fail("kms_transport_invalid");
  return transport;
}

function takeAccessTokenFromEnvironment() {
  const value = process.env[GOOGLE_KMS_ACCESS_TOKEN_ENV];
  delete process.env[GOOGLE_KMS_ACCESS_TOKEN_ENV];
  if (typeof value !== "string" || value.length < 20 || value.length > 4096 || !ACCESS_TOKEN.test(value)) {
    fail("kms_access_token_env_invalid");
  }
  return value;
}

function checksumValue(field) {
  const raw = field && typeof field === "object" && Object.hasOwn(field, "value")
    ? field.value
    : field;
  const rendered = raw && typeof raw === "object" && typeof raw.toString === "function"
    ? raw.toString()
    : raw;
  const value = Number(rendered);
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) {
    fail("kms_ciphertext_crc32c_invalid");
  }
  return value;
}

async function encryptWithClient({
  keyResource,
  plaintext,
  additionalAuthenticatedData,
  timeoutMs,
}, dependencies) {
  const client = dependencies.client || new KeyManagementServiceClient();
  try {
    const [response] = await client.encrypt({
      name: keyResource,
      plaintext,
      plaintextCrc32c: { value: crc32c.calculate(plaintext) },
      additionalAuthenticatedData,
      additionalAuthenticatedDataCrc32c: { value: crc32c.calculate(additionalAuthenticatedData) },
    }, { timeout: timeoutMs });
    return response;
  } catch {
    fail("kms_encrypt_failed");
  }
}

async function encryptWithRest({
  keyResource,
  plaintext,
  additionalAuthenticatedData,
  timeoutMs,
}, dependencies) {
  let accessToken = takeAccessTokenFromEnvironment();
  let timer;
  try {
    const fetchImpl = dependencies.fetchImpl || globalThis.fetch;
    if (typeof fetchImpl !== "function") fail("kms_rest_fetch_unavailable");

    const endpoint = `https://cloudkms.googleapis.com/v1/${keyResource}:encrypt`;
    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plaintext: plaintext.toString("base64"),
          additionalAuthenticatedData: additionalAuthenticatedData.toString("base64"),
          plaintextCrc32c: String(crc32c.calculate(plaintext)),
          additionalAuthenticatedDataCrc32c: String(crc32c.calculate(additionalAuthenticatedData)),
        }),
        redirect: "error",
        signal: controller.signal,
      });
    } catch {
      fail("kms_rest_encrypt_failed");
    } finally {
      accessToken = "";
    }

    if (response?.ok !== true) fail("kms_rest_http_failed");
    let body;
    try {
      const serialized = await response.text();
      if (!serialized || Buffer.byteLength(serialized, "utf8") > MAX_REST_RESPONSE_BYTES) {
        fail("kms_rest_response_invalid");
      }
      body = JSON.parse(serialized);
    } catch (error) {
      if (error instanceof WalletWrapError) throw error;
      fail("kms_rest_response_invalid");
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) fail("kms_rest_response_invalid");
    return body;
  } finally {
    if (timer) clearTimeout(timer);
    accessToken = "";
  }
}

function ciphertextBuffer(value) {
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    const ciphertext = Buffer.from(value);
    if (!ciphertext.length) fail("kms_ciphertext_invalid");
    return ciphertext;
  }
  if (typeof value === "string" && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    const ciphertext = Buffer.from(value, "base64");
    if (!ciphertext.length) fail("kms_ciphertext_invalid");
    return ciphertext;
  }
  fail("kms_ciphertext_invalid");
}

function validateEncryptResponse(response, keyResource) {
  if (response?.verifiedPlaintextCrc32c !== true) fail("kms_plaintext_crc32c_unverified");
  if (response?.verifiedAdditionalAuthenticatedDataCrc32c !== true) fail("kms_aad_crc32c_unverified");
  if (response?.protectionLevel !== "SOFTWARE" && response?.protectionLevel !== 1) {
    fail("kms_protection_level_not_software");
  }

  const responseName = String(response?.name || "");
  if (!responseName.startsWith(`${keyResource}/cryptoKeyVersions/`)
    || !/\/cryptoKeyVersions\/[1-9][0-9]*$/.test(responseName)) {
    fail("kms_response_key_mismatch");
  }

  const ciphertext = ciphertextBuffer(response?.ciphertext);
  if (checksumValue(response?.ciphertextCrc32c) !== crc32c.calculate(ciphertext)) {
    ciphertext.fill(0);
    fail("kms_ciphertext_crc32c_mismatch");
  }
  return ciphertext;
}

function mapOutputError(error) {
  if (error?.code === "EEXIST") return new WalletWrapError("output_already_exists");
  if (error?.code === "ENOENT") return new WalletWrapError("output_parent_missing");
  if (error?.code === "EACCES" || error?.code === "EPERM") return new WalletWrapError("output_permission_denied");
  return new WalletWrapError("output_write_failed");
}

async function writeCiphertextExclusive(outputPath, ciphertext) {
  let handle;
  let created = false;
  let failure;
  try {
    handle = await open(outputPath, "wx", 0o600);
    created = true;
    await handle.chmod(0o600);
    await handle.writeFile(ciphertext.toString("base64"), { encoding: "ascii" });
    await handle.sync();
  } catch (error) {
    failure = error;
  } finally {
    if (handle) {
      try {
        await handle.close();
      } catch (error) {
        failure ||= error;
      }
    }
  }

  if (!failure) return;
  if (created) {
    try {
      await unlink(outputPath);
    } catch {
      // Best effort only. The file can contain ciphertext, never plaintext.
    }
  }
  throw mapOutputError(failure);
}

/**
 * Encrypts an existing EVM private key with a Google Cloud KMS SOFTWARE key.
 * The private key is accepted only through the explicitly named environment
 * variable and is never returned, logged, or written to disk.
 */
export async function wrapWalletWithKms(options, dependencies = {}) {
  const expectedAddress = normalizeExpectedAddress(options?.expectedAddress);
  const keyResource = normalizeKeyResource(options?.keyResource);
  const outputPath = normalizeOutputPath(options?.outputPath);
  const timeoutMs = normalizeTimeout(options?.timeoutMs);
  const transport = normalizeTransport(options?.transport);
  const additionalAuthenticatedData = kmsWrapAad(options?.domain, options?.environment);
  const { plaintext, rawPrivateKey } = takePrivateKeyFromEnvironment(options?.privateKeyEnvName);
  let ciphertext;

  try {
    let derivedAddress;
    try {
      derivedAddress = getAddress(computeAddress(SigningKey.computePublicKey(rawPrivateKey)));
    } catch {
      fail("private_key_env_invalid");
    }
    if (derivedAddress !== expectedAddress) fail("wallet_address_mismatch");

    let response;
    const encryptInput = { keyResource, plaintext, additionalAuthenticatedData, timeoutMs };
    response = transport === "rest"
      ? await encryptWithRest(encryptInput, dependencies)
      : await encryptWithClient(encryptInput, dependencies);

    ciphertext = validateEncryptResponse(response, keyResource);
    await writeCiphertextExclusive(outputPath, ciphertext);
    return Object.freeze({
      address: expectedAddress,
      domain: String(options.domain).trim().toLowerCase(),
      environment: String(options.environment).trim().toLowerCase(),
      outputPath,
      ciphertextBytes: ciphertext.length,
    });
  } finally {
    plaintext.fill(0);
    rawPrivateKey.fill(0);
    ciphertext?.fill(0);
  }
}

function parseArguments(argv) {
  const names = new Map([
    ["--private-key-env", "privateKeyEnvName"],
    ["--expected-address", "expectedAddress"],
    ["--environment", "environment"],
    ["--domain", "domain"],
    ["--key-resource", "keyResource"],
    ["--output", "outputPath"],
    ["--timeout-ms", "timeoutMs"],
    ["--transport", "transport"],
  ]);
  const parsed = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const target = names.get(name);
    const value = argv[index + 1];
    if (!target || value === undefined || String(value).startsWith("--")) fail("cli_arguments_invalid");
    if (Object.hasOwn(parsed, target)) fail("cli_argument_duplicate");
    parsed[target] = value;
  }
  return parsed;
}

export function publicErrorCode(error) {
  return error instanceof WalletWrapError ? error.code : "wallet_wrap_failed";
}

function usage() {
  return [
    "Usage:",
    "  node apps/executor/scripts/wrap-wallet-with-kms.mjs \\",
    "    --private-key-env ENV_NAME --expected-address 0x... \\",
    "    --environment staging --domain polygon \\",
    "    --key-resource projects/.../cryptoKeys/... --output PATH [--transport client|rest]",
    "",
    "The private key value must never be passed as a command-line argument.",
    `REST authentication reads its token only from ${GOOGLE_KMS_ACCESS_TOKEN_ENV}.`,
  ].join("\n");
}

export async function runCli(argv = process.argv.slice(2)) {
  if (argv.length === 1 && argv[0] === "--help") {
    process.stdout.write(`${usage()}\n`);
    return null;
  }
  const result = await wrapWalletWithKms(parseArguments(argv));
  process.stdout.write(`${JSON.stringify({
    ok: true,
    address: result.address,
    domain: result.domain,
    environment: result.environment,
    output: result.outputPath,
    ciphertext_bytes: result.ciphertextBytes,
  })}\n`);
  return result;
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();

if (isMain) {
  runCli().catch((error) => {
    process.stderr.write(`${JSON.stringify({ ok: false, error: publicErrorCode(error) })}\n`);
    process.exitCode = 1;
  });
}

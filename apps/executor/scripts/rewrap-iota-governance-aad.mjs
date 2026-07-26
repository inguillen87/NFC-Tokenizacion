import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Wallet, getAddress } from "ethers";
import { IOTA_STAGING_GOVERNANCE } from "../src/custody-migration-plan.mjs";
import { withDecryptedWrappedKmsPrivateKey } from "../src/wrapped-kms-signer.mjs";
import { publicErrorCode, wrapWalletWithKms } from "./wrap-wallet-with-kms.mjs";

const APPROVAL = "REWRAP_NEXID_IOTA_GOVERNANCE_AAD";
const TEMPORARY_PRIVATE_KEY_ENV = "NEXID_IOTA_GOVERNANCE_REWRAP_PRIVATE_KEY";
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function fail(code) {
  throw new Error(code);
}

function parseArguments(argv) {
  const allowed = new Map([
    ["--source-key-resource", "sourceKeyResource"],
    ["--target-key-resource", "targetKeyResource"],
    ["--input", "inputPath"],
    ["--output", "outputPath"],
    ["--expected-address", "expectedAddress"],
    ["--transport", "transport"],
    ["--timeout-ms", "timeoutMs"],
  ]);
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = allowed.get(argv[index]);
    const value = argv[index + 1];
    if (!key || !value || String(value).startsWith("--") || Object.hasOwn(options, key)) fail("iota_governance_rewrap_arguments_invalid");
    options[key] = value;
  }
  for (const required of ["sourceKeyResource", "targetKeyResource", "inputPath", "outputPath", "expectedAddress"]) {
    if (!options[required]) fail("iota_governance_rewrap_arguments_invalid");
  }
  options.inputPath = path.resolve(options.inputPath);
  options.outputPath = path.resolve(options.outputPath);
  options.transport ||= "rest";
  if (options.inputPath === options.outputPath) fail("iota_governance_rewrap_output_must_differ");
  if (getAddress(options.expectedAddress) !== IOTA_STAGING_GOVERNANCE) fail("iota_governance_rewrap_address_mismatch");
  return options;
}

async function loadCiphertext(inputPath) {
  const metadata = await lstat(inputPath).catch(() => null);
  if (!metadata?.isFile() || metadata.isSymbolicLink() || metadata.size < 32 || metadata.size > 32 * 1024) {
    fail("iota_governance_rewrap_input_invalid");
  }
  const encoded = (await readFile(inputPath, "ascii")).trim();
  if (!BASE64.test(encoded)) fail("iota_governance_rewrap_input_invalid");
  const decoded = Buffer.from(encoded, "base64");
  if (decoded.length < 32 || decoded.length > 16 * 1024) fail("iota_governance_rewrap_input_invalid");
  decoded.fill(0);
  return encoded;
}

export async function rewrapIotaGovernanceAad(options, dependencies = {}) {
  if (String(process.env.NEXID_CUSTODY_REWRAP_APPROVED || "").trim() !== APPROVAL) {
    fail("iota_governance_rewrap_confirmation_required");
  }
  delete process.env.NEXID_CUSTODY_REWRAP_APPROVED;
  return rewrapWrappedWalletAad({
    ...options,
    domain: "iota",
    environment: "staging",
    sourceRole: "publisher",
    targetRole: "governance",
    expectedChainId: 1076,
    expectedAddress: IOTA_STAGING_GOVERNANCE,
    confirmation: APPROVAL,
  }, dependencies);
}

export async function rewrapWrappedWalletAad(options, dependencies = {}) {
  if (options?.confirmation !== APPROVAL
    || options?.domain !== "iota"
    || options?.environment !== "staging"
    || Number(options?.expectedChainId) !== 1076
    || options?.sourceRole !== "publisher"
    || options?.targetRole !== "governance") {
    fail("iota_governance_rewrap_policy_invalid");
  }
  const wrappedPrivateKey = await loadCiphertext(options.inputPath);
  return withDecryptedWrappedKmsPrivateKey({
    domain: options.domain,
    environment: options.environment,
    role: options.sourceRole,
    keyResource: options.sourceKeyResource,
    wrappedPrivateKey,
    expectedChainId: options.expectedChainId,
    transport: options.transport,
    decryptTimeoutMs: options.timeoutMs,
  }, dependencies, async (plaintext) => {
    const privateKey = plaintext.toString("ascii");
    const wallet = new Wallet(privateKey);
    if (getAddress(wallet.address) !== getAddress(options.expectedAddress)) fail("iota_governance_rewrap_key_mismatch");
    process.env[TEMPORARY_PRIVATE_KEY_ENV] = privateKey;
    try {
      return await wrapWalletWithKms({
        domain: options.domain,
        environment: options.environment,
        role: options.targetRole,
        keyResource: options.targetKeyResource,
        outputPath: options.outputPath,
        expectedAddress: options.expectedAddress,
        privateKeyEnvName: TEMPORARY_PRIVATE_KEY_ENV,
        transport: options.transport,
        timeoutMs: options.timeoutMs,
      }, dependencies);
    } finally {
      delete process.env[TEMPORARY_PRIVATE_KEY_ENV];
    }
  });
}

export async function runCli(argv = process.argv.slice(2), dependencies = {}) {
  const result = await rewrapIotaGovernanceAad(parseArguments(argv), dependencies);
  process.stdout.write(`${JSON.stringify({
    ok: true,
    domain: "iota",
    environment: "staging",
    address: result.address,
    source_role: "publisher",
    target_role: "governance",
    output: result.outputPath,
    ciphertext_bytes: result.ciphertextBytes,
  }, null, 2)}\n`);
  return result;
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();

if (isMain) {
  runCli().catch((error) => {
    const code = /^[a-z0-9_]{3,100}$/.test(String(error?.message || ""))
      ? error.message
      : publicErrorCode(error);
    process.stderr.write(`${JSON.stringify({ ok: false, error: code })}\n`);
    process.exitCode = 1;
  });
}

export { APPROVAL as IOTA_GOVERNANCE_REWRAP_APPROVAL };

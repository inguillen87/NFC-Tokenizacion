import { lstat, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateWalletWithKms } from "./generate-wallet-with-kms.mjs";
import {
  GOOGLE_KMS_ACCESS_TOKEN_ENV,
  GOOGLE_KMS_GOVERNANCE_ACCESS_TOKEN_ENV,
  GOOGLE_KMS_PUBLISHER_ACCESS_TOKEN_ENV,
  publicErrorCode,
} from "./wrap-wallet-with-kms.mjs";

const APPROVAL = "GENERATE_NEXID_POLYGON_TESTNET_CUSTODY_WALLETS";
const TOKEN = /^[A-Za-z0-9._~+/-]+=*$/;

function fail(code) {
  throw new Error(code);
}

function parseArguments(argv) {
  const allowed = new Map([
    ["--environment", "environment"],
    ["--publisher-key-resource", "publisherKeyResource"],
    ["--governance-key-resource", "governanceKeyResource"],
    ["--publisher-output", "publisherOutput"],
    ["--governance-output", "governanceOutput"],
    ["--transport", "transport"],
    ["--timeout-ms", "timeoutMs"],
  ]);
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = allowed.get(argv[index]);
    const value = argv[index + 1];
    if (!key || !value || String(value).startsWith("--") || Object.hasOwn(result, key)) fail("custody_generation_arguments_invalid");
    result[key] = value;
  }
  for (const required of ["environment", "publisherKeyResource", "governanceKeyResource", "publisherOutput", "governanceOutput"]) {
    if (!result[required]) fail("custody_generation_arguments_invalid");
  }
  result.transport ||= "rest";
  result.publisherOutput = path.resolve(result.publisherOutput);
  result.governanceOutput = path.resolve(result.governanceOutput);
  if (result.publisherOutput === result.governanceOutput) fail("custody_generation_outputs_must_differ");
  return result;
}

function ephemeralTokenProvider(role) {
  let cached;
  return {
    getAccessToken() {
      if (cached) return cached;
      const roleEnvName = role === "governance"
        ? GOOGLE_KMS_GOVERNANCE_ACCESS_TOKEN_ENV
        : GOOGLE_KMS_PUBLISHER_ACCESS_TOKEN_ENV;
      const roleValue = process.env[roleEnvName];
      delete process.env[roleEnvName];
      const raw = roleValue || process.env[GOOGLE_KMS_ACCESS_TOKEN_ENV];
      if (!roleValue) delete process.env[GOOGLE_KMS_ACCESS_TOKEN_ENV];
      const value = String(raw || "");
      if (value.length < 20 || value.length > 4096 || !TOKEN.test(value)) fail("kms_access_token_env_invalid");
      cached = value;
      return cached;
    },
    clear() { cached = ""; },
  };
}

async function assertOutputsAbsent(options) {
  for (const output of [options.publisherOutput, options.governanceOutput]) {
    if (await lstat(output).catch(() => null)) fail("custody_generation_output_exists");
  }
}

export async function generatePolygonCustodyWallets(options, dependencies = {}) {
  if (String(process.env.NEXID_CUSTODY_GENERATION_APPROVED || "").trim() !== APPROVAL) {
    fail("custody_generation_confirmation_required");
  }
  delete process.env.NEXID_CUSTODY_GENERATION_APPROVED;
  await assertOutputsAbsent(options);
  const tokens = {
    publisher: ephemeralTokenProvider("publisher"),
    governance: ephemeralTokenProvider("governance"),
  };
  const created = [];
  try {
    const publisher = await generateWalletWithKms({
      environment: options.environment,
      domain: "polygon",
      role: "publisher",
      keyResource: options.publisherKeyResource,
      outputPath: options.publisherOutput,
      transport: options.transport,
      timeoutMs: options.timeoutMs,
    }, { ...dependencies, getAccessToken: tokens.publisher.getAccessToken });
    created.push(options.publisherOutput);
    const governance = await generateWalletWithKms({
      environment: options.environment,
      domain: "polygon",
      role: "governance",
      keyResource: options.governanceKeyResource,
      outputPath: options.governanceOutput,
      transport: options.transport,
      timeoutMs: options.timeoutMs,
    }, { ...dependencies, getAccessToken: tokens.governance.getAccessToken });
    created.push(options.governanceOutput);
    return Object.freeze({ publisher, governance });
  } catch (error) {
    for (const output of created) await unlink(output).catch(() => {});
    throw error;
  } finally {
    tokens.publisher.clear();
    tokens.governance.clear();
  }
}

export async function runCli(argv = process.argv.slice(2), dependencies = {}) {
  const result = await generatePolygonCustodyWallets(parseArguments(argv), dependencies);
  process.stdout.write(`${JSON.stringify({
    ok: true,
    domain: "polygon",
    environment: result.publisher.environment,
    publisher: { address: result.publisher.address, ciphertext_path: result.publisher.outputPath },
    governance: { address: result.governance.address, ciphertext_path: result.governance.outputPath },
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

export { APPROVAL as POLYGON_CUSTODY_GENERATION_APPROVAL };

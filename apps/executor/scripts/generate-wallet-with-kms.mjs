import path from "node:path";
import { fileURLToPath } from "node:url";
import { Wallet } from "ethers";
import { publicErrorCode, wrapWalletWithKms } from "./wrap-wallet-with-kms.mjs";

const GENERATED_KEY_ENV = "NEXID_GENERATED_WALLET_PRIVATE_KEY";

function parseArguments(argv) {
  const allowed = new Map([
    ["--environment", "environment"],
    ["--domain", "domain"],
    ["--role", "role"],
    ["--key-resource", "keyResource"],
    ["--output", "outputPath"],
    ["--transport", "transport"],
    ["--timeout-ms", "timeoutMs"],
  ]);
  const parsed = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const target = allowed.get(name);
    const value = argv[index + 1];
    if (!target || value === undefined || String(value).startsWith("--") || Object.hasOwn(parsed, target)) {
      throw new Error("cli_arguments_invalid");
    }
    parsed[target] = value;
  }
  for (const required of ["environment", "domain", "keyResource", "outputPath"]) {
    if (!parsed[required]) throw new Error("cli_arguments_invalid");
  }
  return parsed;
}

export async function generateWalletWithKms(options, dependencies = {}) {
  const wallet = Wallet.createRandom();
  process.env[GENERATED_KEY_ENV] = wallet.privateKey;
  try {
    return await wrapWalletWithKms({
      ...options,
      privateKeyEnvName: GENERATED_KEY_ENV,
      expectedAddress: wallet.address,
    }, dependencies);
  } finally {
    delete process.env[GENERATED_KEY_ENV];
  }
}

export async function runCli(argv = process.argv.slice(2)) {
  const result = await generateWalletWithKms(parseArguments(argv));
  process.stdout.write(`${JSON.stringify({
    ok: true,
    address: result.address,
    domain: result.domain,
    role: result.role,
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

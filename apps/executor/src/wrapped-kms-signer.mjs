import { KeyManagementServiceClient } from "@google-cloud/kms";
import { Wallet, getAddress, isAddress } from "ethers";
import crc32c from "fast-crc32c";
import { validateSignedTransaction } from "./kms-signer.mjs";

const SUPPORTED_DOMAINS = new Set(["polygon", "iota"]);
const DEFAULT_CHAIN_IDS = Object.freeze({ polygon: 80002, iota: 1076 });
const DEFAULT_DECRYPT_TIMEOUT_MS = 10_000;
let sharedClient;

function env(name) {
  return String(process.env[name] || "").trim();
}

function normalizeDomain(value) {
  const domain = String(value || "").trim().toLowerCase();
  if (!SUPPORTED_DOMAINS.has(domain)) throw new Error("kms_wrap_domain_invalid");
  return domain;
}

function normalizeEnvironment(value) {
  const environment = String(value || "").trim().toLowerCase();
  if (!/^(?:development|test|staging|production)$/.test(environment)) {
    throw new Error("kms_wrap_environment_invalid");
  }
  return environment;
}

function prefixFor(domain) {
  return domain === "polygon" ? "POLYGON" : "IOTA";
}

function normalizeKeyResource(value) {
  const resource = String(value || "").trim();
  if (!/^projects\/[a-z][a-z0-9-]{4,28}[a-z0-9]\/locations\/[a-z0-9-]+\/keyRings\/[A-Za-z0-9_-]{1,63}\/cryptoKeys\/[A-Za-z0-9_-]{1,63}$/.test(resource)) {
    throw new Error("kms_wrap_key_resource_invalid");
  }
  return resource;
}

function decodeCiphertext(value) {
  const encoded = String(value || "").trim();
  if (!encoded || encoded.length > 32 * 1024 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    throw new Error("kms_wrapped_private_key_invalid");
  }
  const ciphertext = Buffer.from(encoded, "base64");
  if (ciphertext.length < 32 || ciphertext.length > 16 * 1024) {
    throw new Error("kms_wrapped_private_key_invalid");
  }
  return ciphertext;
}

function normalizePositiveInteger(value, errorCode, { max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > max) throw new Error(errorCode);
  return parsed;
}

function expectedChainIdFor(domain, options = {}) {
  const explicit = options.expectedChainId
    ?? (domain === "polygon" ? env("POLYGON_EXPECTED_CHAIN_ID") : env("IOTA_EVM_EXPECTED_CHAIN_ID"));
  const configured = explicit === "" ? DEFAULT_CHAIN_IDS[domain] : explicit;
  return normalizePositiveInteger(configured, "kms_expected_chain_id_invalid");
}

function decryptTimeoutFor(options = {}) {
  const explicit = options.decryptTimeoutMs ?? env("KMS_DECRYPT_TIMEOUT_MS");
  const configured = explicit === "" ? DEFAULT_DECRYPT_TIMEOUT_MS : explicit;
  return normalizePositiveInteger(configured, "kms_decrypt_timeout_invalid", { max: 30_000 });
}

function assertExpectedChain(input, expectedChainId) {
  const intentChainId = normalizePositiveInteger(input?.chainId, "kms_chain_id_invalid");
  const transactionChainId = normalizePositiveInteger(
    input?.transaction?.chain_id ?? input?.transaction?.chainId,
    "kms_transaction_chain_id_invalid",
  );
  if (intentChainId !== expectedChainId || transactionChainId !== expectedChainId) {
    throw new Error("kms_expected_chain_id_mismatch");
  }
}

function normalizePrivateKey(value) {
  const raw = String(value || "").trim();
  if (/^0x[0-9a-f]{64}$/i.test(raw)) return raw;
  if (/^[0-9a-f]{64}$/i.test(raw)) return `0x${raw}`;
  throw new Error("kms_plaintext_private_key_invalid");
}

function transactionRequest(input) {
  const transaction = input?.transaction || {};
  const type = Number(transaction.type);
  const base = {
    type,
    chainId: BigInt(input.chainId),
    to: transaction.to,
    data: transaction.data,
    nonce: Number(transaction.nonce),
    value: BigInt(transaction.value ?? "0"),
    gasLimit: BigInt(transaction.gas_limit ?? transaction.gasLimit),
  };
  if (type === 2) {
    return {
      ...base,
      maxFeePerGas: BigInt(transaction.max_fee_per_gas ?? transaction.maxFeePerGas),
      maxPriorityFeePerGas: BigInt(transaction.max_priority_fee_per_gas ?? transaction.maxPriorityFeePerGas),
    };
  }
  return { ...base, gasPrice: BigInt(transaction.gas_price ?? transaction.gasPrice) };
}

export function kmsWrapAad(domainValue, environmentValue) {
  const domain = normalizeDomain(domainValue);
  const environment = normalizeEnvironment(environmentValue);
  return Buffer.from(`nexid.wallet.wrap.v1|${environment}|${domain}|publisher`, "utf8");
}

function resolveConfig(domainValue, options = {}) {
  const domain = normalizeDomain(domainValue);
  const prefix = prefixFor(domain);
  const environment = normalizeEnvironment(options.environment || env("NEXID_KMS_ENVIRONMENT"));
  return {
    domain,
    environment,
    keyResource: normalizeKeyResource(options.keyResource || env(`${prefix}_KMS_WRAP_KEY_RESOURCE`)),
    ciphertext: decodeCiphertext(options.wrappedPrivateKey || env(`${prefix}_KMS_WRAPPED_PRIVATE_KEY`)),
    expectedChainId: expectedChainIdFor(domain, options),
    decryptTimeoutMs: decryptTimeoutFor(options),
  };
}

export function wrappedKmsConfigured(options = {}) {
  try {
    resolveConfig(options.domain, options);
    return true;
  } catch {
    return false;
  }
}

function clientFor(dependencies = {}) {
  if (dependencies.client) return dependencies.client;
  sharedClient ||= new KeyManagementServiceClient();
  return sharedClient;
}

export async function signWithWrappedKms(input, options = {}, dependencies = {}) {
  const config = resolveConfig(options.domain, options);
  const expectedSignerAddress = String(input?.expectedSignerAddress || "").trim();
  if (!isAddress(expectedSignerAddress)) throw new Error("kms_expected_signer_invalid");
  assertExpectedChain(input, config.expectedChainId);

  const additionalAuthenticatedData = kmsWrapAad(config.domain, config.environment);
  const [response] = await clientFor(dependencies).decrypt({
    name: config.keyResource,
    ciphertext: config.ciphertext,
    ciphertextCrc32c: { value: crc32c.calculate(config.ciphertext) },
    additionalAuthenticatedData,
    additionalAuthenticatedDataCrc32c: { value: crc32c.calculate(additionalAuthenticatedData) },
  }, { timeout: config.decryptTimeoutMs });
  const plaintext = Buffer.isBuffer(response?.plaintext)
    ? response.plaintext
    : Buffer.from(response?.plaintext || []);
  try {
    const responseChecksum = Number(response?.plaintextCrc32c?.value);
    if (!Number.isSafeInteger(responseChecksum) || crc32c.calculate(plaintext) !== responseChecksum) {
      throw new Error("kms_plaintext_crc32c_mismatch");
    }
    const privateKey = normalizePrivateKey(plaintext.toString("utf8"));
    const wallet = new Wallet(privateKey);
    if (getAddress(wallet.address) !== getAddress(expectedSignerAddress)) {
      throw new Error("kms_signer_address_mismatch");
    }
    const signedTransaction = await wallet.signTransaction(transactionRequest(input));
    return validateSignedTransaction(signedTransaction, input);
  } finally {
    plaintext.fill(0);
  }
}

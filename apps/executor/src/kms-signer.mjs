import { getAddress, isAddress, Transaction } from "ethers";

function env(name) {
  return String(process.env[name] || "").trim();
}

function assertSignerUrl(value, allowedHostsValue = env("IOTA_KMS_SIGNER_ALLOWED_HOSTS")) {
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error("kms_signer_url_invalid"); }
  if (parsed.protocol !== "https:" && !(parsed.hostname === "localhost" && parsed.protocol === "http:")) {
    throw new Error("kms_signer_tls_required");
  }
  if (parsed.username || parsed.password) throw new Error("kms_signer_url_userinfo_forbidden");
  const allowed = String(allowedHostsValue || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (String(process.env.NODE_ENV || "").toLowerCase() === "production" && allowed.length === 0) throw new Error("kms_signer_allowed_hosts_required");
  if (allowed.length > 0 && !allowed.includes(parsed.hostname.toLowerCase())) throw new Error("kms_signer_host_not_allowed");
  return parsed.toString();
}

export function kmsConfigured(options = {}) {
  return Boolean(String(options.url || env("IOTA_KMS_SIGNER_URL") || env("KMS_SIGNER_URL")).trim()
    && String(options.keyId || env("IOTA_KMS_KEY_ID") || env("KMS_KEY_ID")).trim());
}

function requiredBigInt(value, field) {
  if (value === null || value === undefined || value === "") throw new Error(`kms_intent_${field}_required`);
  try {
    const parsed = BigInt(value);
    if (parsed < 0n) throw new Error("negative");
    return parsed;
  } catch {
    throw new Error(`kms_intent_${field}_invalid`);
  }
}

function assertBigIntMatch(actual, expected, field) {
  if (actual === null || actual === undefined || BigInt(actual) !== expected) {
    throw new Error(`kms_signed_transaction_${field}_mismatch`);
  }
}

function normalizedTransactionIntent(input) {
  const transaction = input?.transaction || {};
  const chainId = requiredBigInt(input?.chainId, "chain_id");
  const transactionChainId = requiredBigInt(transaction.chain_id ?? transaction.chainId, "transaction_chain_id");
  if (transactionChainId !== chainId) throw new Error("kms_intent_chain_id_mismatch");

  const to = String(transaction.to || "").trim();
  if (!isAddress(to)) throw new Error("kms_intent_to_invalid");
  const data = String(transaction.data || "").trim().toLowerCase();
  if (!/^0x(?:[0-9a-f]{2})*$/.test(data)) throw new Error("kms_intent_data_invalid");
  const nonce = Number(transaction.nonce);
  if (!Number.isSafeInteger(nonce) || nonce < 0) throw new Error("kms_intent_nonce_invalid");
  const gasLimit = requiredBigInt(transaction.gas_limit ?? transaction.gasLimit, "gas_limit");
  if (gasLimit === 0n) throw new Error("kms_intent_gas_limit_invalid");
  const value = requiredBigInt(transaction.value ?? "0", "value");
  const signerAddress = String(input?.expectedSignerAddress || "").trim();
  if (!isAddress(signerAddress)) throw new Error("kms_expected_signer_invalid");

  const explicitType = transaction.type === null || transaction.type === undefined || transaction.type === ""
    ? null
    : Number(transaction.type);
  const maxFeeValue = transaction.max_fee_per_gas ?? transaction.maxFeePerGas;
  const maxPriorityFeeValue = transaction.max_priority_fee_per_gas ?? transaction.maxPriorityFeePerGas;
  const gasPriceValue = transaction.gas_price ?? transaction.gasPrice;
  const hasDynamicFees = maxFeeValue !== null && maxFeeValue !== undefined && maxFeeValue !== ""
    && maxPriorityFeeValue !== null && maxPriorityFeeValue !== undefined && maxPriorityFeeValue !== "";
  const hasLegacyFee = gasPriceValue !== null && gasPriceValue !== undefined && gasPriceValue !== "";
  const type = explicitType ?? (hasDynamicFees ? 2 : hasLegacyFee ? 0 : -1);
  if (type !== 0 && type !== 2) throw new Error("kms_intent_transaction_type_invalid");
  if (type === 2 && (!hasDynamicFees || hasLegacyFee)) throw new Error("kms_intent_fee_model_invalid");
  if (type === 0 && (!hasLegacyFee || hasDynamicFees)) throw new Error("kms_intent_fee_model_invalid");

  const maxFeePerGas = type === 2 ? requiredBigInt(maxFeeValue, "max_fee_per_gas") : null;
  const maxPriorityFeePerGas = type === 2 ? requiredBigInt(maxPriorityFeeValue, "max_priority_fee_per_gas") : null;
  if (type === 2 && maxFeePerGas < maxPriorityFeePerGas) throw new Error("kms_intent_max_fee_too_low");

  return {
    chainId,
    to: getAddress(to),
    data,
    nonce,
    gasLimit,
    value,
    type,
    gasPrice: type === 0 ? requiredBigInt(gasPriceValue, "gas_price") : null,
    maxFeePerGas,
    maxPriorityFeePerGas,
    signerAddress: getAddress(signerAddress),
  };
}

export function validateSignedTransaction(signedTransaction, input) {
  const signed = String(signedTransaction || "").trim();
  if (!/^0x[0-9a-f]+$/i.test(signed)) throw new Error("kms_signed_transaction_missing");

  let parsed;
  try {
    parsed = Transaction.from(signed);
  } catch {
    throw new Error("kms_signed_transaction_invalid");
  }
  if (!parsed.isSigned()) throw new Error("kms_signed_transaction_unsigned");

  const expected = normalizedTransactionIntent(input);
  let recoveredSigner;
  try {
    recoveredSigner = getAddress(parsed.from);
  } catch {
    throw new Error("kms_signed_transaction_signer_unrecoverable");
  }
  if (recoveredSigner !== expected.signerAddress) throw new Error("kms_signer_address_mismatch");
  assertBigIntMatch(parsed.chainId, expected.chainId, "chain_id");
  if (!parsed.to || getAddress(parsed.to) !== expected.to) throw new Error("kms_signed_transaction_to_mismatch");
  if (String(parsed.data || "0x").toLowerCase() !== expected.data) throw new Error("kms_signed_transaction_data_mismatch");
  if (parsed.nonce !== expected.nonce) throw new Error("kms_signed_transaction_nonce_mismatch");
  assertBigIntMatch(parsed.value, expected.value, "value");
  assertBigIntMatch(parsed.gasLimit, expected.gasLimit, "gas_limit");
  if (parsed.type !== expected.type) throw new Error("kms_signed_transaction_type_mismatch");
  if (Array.isArray(parsed.accessList) && parsed.accessList.length > 0) {
    throw new Error("kms_signed_transaction_access_list_mismatch");
  }
  if (expected.type === 2) {
    assertBigIntMatch(parsed.maxFeePerGas, expected.maxFeePerGas, "max_fee_per_gas");
    assertBigIntMatch(parsed.maxPriorityFeePerGas, expected.maxPriorityFeePerGas, "max_priority_fee_per_gas");
  } else {
    assertBigIntMatch(parsed.gasPrice, expected.gasPrice, "gas_price");
  }

  return { signedTransaction: signed, signerAddress: recoveredSigner, transactionHash: parsed.hash };
}

export async function signWithKms(input, options = {}) {
  const url = assertSignerUrl(options.url || env("IOTA_KMS_SIGNER_URL") || env("KMS_SIGNER_URL"), options.allowedHosts || env("IOTA_KMS_SIGNER_ALLOWED_HOSTS") || env("KMS_SIGNER_ALLOWED_HOSTS"));
  const keyId = String(options.keyId || env("IOTA_KMS_KEY_ID") || env("KMS_KEY_ID")).trim();
  const bearer = String(options.bearer || env("IOTA_KMS_SIGNER_TOKEN") || env("KMS_SIGNER_TOKEN")).trim();
  if (!keyId) throw new Error("kms_key_id_required");
  if (String(process.env.NODE_ENV || "").toLowerCase() === "production" && !bearer) throw new Error("kms_signer_token_required");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
      },
      body: JSON.stringify({ key_id: keyId, chain_id: input.chainId, transaction: input.transaction }),
    });
    if (!response.ok) throw new Error("kms_signer_rejected");
    if (!String(response.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) {
      throw new Error("kms_response_content_type_invalid");
    }
    const contentLength = Number(response.headers.get("content-length") || "0");
    if (contentLength > 64 * 1024) throw new Error("kms_response_too_large");
    const raw = await response.text();
    if (raw.length > 64 * 1024) throw new Error("kms_response_too_large");
    let body;
    try { body = JSON.parse(raw); } catch { throw new Error("kms_response_invalid_json"); }
    return validateSignedTransaction(body.signed_transaction, input);
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("kms_signer_timeout");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

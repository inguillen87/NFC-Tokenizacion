import { createHash } from "node:crypto";
import { Contract, JsonRpcProvider, Wallet, getAddress, isAddress } from "ethers";

const rpcUrl = String(process.env.IOTA_EVM_RPC_URL || "").trim();
const contractAddress = String(process.env.IOTA_EVM_ANCHOR_CONTRACT_V2 || "").trim();
const configuredPublisher = String(process.env.IOTA_KMS_PUBLISHER_ADDRESS || process.env.IOTA_EVM_PUBLISHER_ADDRESS || "").trim();
let publisher = configuredPublisher;
if (!publisher && process.env.IOTA_EVM_PRIVATE_KEY) {
  try { publisher = new Wallet(process.env.IOTA_EVM_PRIVATE_KEY).address; } catch { publisher = ""; }
}
const expectedChainId = Number(process.env.IOTA_EVM_EXPECTED_CHAIN_ID || "1076");
const fail = (reason, detail) => { console.error(JSON.stringify({ ok: false, gate: "iota_v2_readonly", reason, ...(detail ? { detail } : {}) })); process.exit(1); };
if (!rpcUrl) fail("IOTA_EVM_RPC_URL_REQUIRED");
if (!isAddress(contractAddress)) fail("IOTA_EVM_ANCHOR_CONTRACT_V2_REQUIRED");
if (!Number.isSafeInteger(expectedChainId) || expectedChainId <= 0) fail("EXPECTED_CHAIN_ID_INVALID");

const provider = new JsonRpcProvider(rpcUrl, expectedChainId, { batchMaxCount: 1 });
const abi = ["function SCHEMA_VERSION() view returns (uint16)", "function authorizedPublishers(address) view returns (bool)"];
try {
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== expectedChainId) fail("CHAIN_ID_MISMATCH", { actual: String(network.chainId), expected: expectedChainId });
  const code = await provider.getCode(contractAddress);
  if (!code || code === "0x") fail("CONTRACT_NOT_DEPLOYED");
  const contract = new Contract(contractAddress, abi, provider);
  const schemaVersion = Number(await contract.SCHEMA_VERSION());
  if (schemaVersion !== 2) fail("SCHEMA_VERSION_MISMATCH", { schemaVersion });
  const result = { ok: true, gate: "iota_v2_readonly", chain_id: expectedChainId, contract_address: getAddress(contractAddress), bytecode_sha256: createHash("sha256").update(code.slice(2), "hex").digest("hex"), schema_version: schemaVersion };
  if (publisher) {
    if (!isAddress(publisher)) fail("PUBLISHER_ADDRESS_INVALID");
    result.publisher_address = getAddress(publisher);
    result.publisher_authorized = Boolean(await contract.authorizedPublishers(publisher));
    if (!result.publisher_authorized) fail("PUBLISHER_NOT_AUTHORIZED", result);
  } else result.publisher_check = "skipped_no_publisher_address";
  console.log(JSON.stringify(result));
} catch (error) {
  fail("RPC_OR_CONTRACT_UNAVAILABLE", error instanceof Error ? error.message : String(error));
} finally {
  provider.destroy();
}

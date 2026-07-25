import {
  Contract,
  JsonRpcProvider,
  Wallet,
  formatEther,
  getAddress,
  isAddress,
  parseEther,
} from "ethers";

const EXPECTED_CHAIN_ID = 1076;
const ABI = [
  "function SCHEMA_VERSION() view returns (uint16)",
  "function owner() view returns (address)",
  "function authorizedPublishers(address) view returns (bool)",
  "function setPublisher(address publisher, bool enabled)",
];

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`missing_${name}`);
  return value;
}

function safeError(error) {
  const message = error instanceof Error ? error.message : "bootstrap_failed";
  return /^[A-Za-z0-9_]{3,100}$/.test(message) ? message : "bootstrap_failed";
}

async function main() {
  if (required("IOTA_BOOTSTRAP_APPROVED") !== "YES") throw new Error("iota_bootstrap_confirmation_required");
  const expectedChainId = Number(required("IOTA_EVM_EXPECTED_CHAIN_ID"));
  if (expectedChainId !== EXPECTED_CHAIN_ID) throw new Error("iota_bootstrap_testnet_only");

  const rpcUrl = required("IOTA_EVM_RPC_URL");
  const contractAddress = required("IOTA_EVM_ANCHOR_CONTRACT_V2");
  const publisherAddress = required("IOTA_RUNTIME_PUBLISHER_ADDRESS");
  const privateKey = required("IOTA_EVM_PRIVATE_KEY");
  delete process.env.IOTA_EVM_PRIVATE_KEY;
  if (!isAddress(contractAddress)) throw new Error("iota_contract_address_invalid");
  if (!isAddress(publisherAddress)) throw new Error("iota_publisher_address_invalid");

  const fundingAmount = parseEther(String(process.env.IOTA_RUNTIME_PUBLISHER_FUNDING || "0.25").trim());
  if (fundingAmount <= 0n || fundingAmount > parseEther("1")) throw new Error("iota_publisher_funding_invalid");

  const provider = new JsonRpcProvider(rpcUrl, expectedChainId, { batchMaxCount: 1 });
  try {
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== expectedChainId) throw new Error("iota_chain_id_mismatch");
    const code = await provider.getCode(contractAddress);
    if (!code || code === "0x") throw new Error("iota_contract_not_deployed");

    const ownerWallet = new Wallet(privateKey, provider);
    const readContract = new Contract(contractAddress, ABI, provider);
    if (Number(await readContract.SCHEMA_VERSION()) !== 2) throw new Error("iota_contract_schema_version_mismatch");
    const contractOwner = getAddress(await readContract.owner());
    if (getAddress(ownerWallet.address) !== contractOwner) throw new Error("iota_bootstrap_signer_not_owner");

    const target = getAddress(publisherAddress);
    let authorizationTxHash = null;
    if (!await readContract.authorizedPublishers(target)) {
      const tx = await new Contract(contractAddress, ABI, ownerWallet).setPublisher(target, true);
      const receipt = await tx.wait(1);
      if (!receipt || receipt.status !== 1) throw new Error("iota_publisher_authorization_failed");
      authorizationTxHash = tx.hash;
    }
    if (!await readContract.authorizedPublishers(target)) throw new Error("iota_publisher_not_authorized");

    let fundingTxHash = null;
    let targetBalance = await provider.getBalance(target);
    if (targetBalance < fundingAmount) {
      const tx = await ownerWallet.sendTransaction({ to: target, value: fundingAmount - targetBalance });
      const receipt = await tx.wait(1);
      if (!receipt || receipt.status !== 1) throw new Error("iota_publisher_funding_failed");
      fundingTxHash = tx.hash;
      targetBalance = await provider.getBalance(target);
    }

    console.log(JSON.stringify({
      ok: true,
      chain_id: expectedChainId,
      contract_address: getAddress(contractAddress),
      owner_address: contractOwner,
      runtime_publisher_address: target,
      runtime_publisher_authorized: true,
      owner_publisher_authorized: Boolean(await readContract.authorizedPublishers(contractOwner)),
      authorization_tx_hash: authorizationTxHash,
      funding_tx_hash: fundingTxHash,
      runtime_publisher_balance_wei: targetBalance.toString(),
      runtime_publisher_balance_iota: formatEther(targetBalance),
    }));
  } finally {
    provider.destroy();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, reason: safeError(error) }));
  process.exitCode = 1;
});

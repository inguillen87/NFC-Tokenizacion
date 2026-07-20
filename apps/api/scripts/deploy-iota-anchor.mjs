import { network } from "hardhat";

async function main() {
  if (!process.env.IOTA_EVM_PRIVATE_KEY) {
    throw new Error("missing_IOTA_EVM_PRIVATE_KEY");
  }

  const connection = await network.create();
  const { ethers } = connection;
  const [deployer] = await ethers.getSigners();
  const contract = await ethers.deployContract(
    "NexidEvidenceAnchor",
    [deployer.address, deployer.address],
    deployer,
  );
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  const deploymentTx = contract.deploymentTransaction();
  const txHash = deploymentTx?.hash || null;
  const explorerBaseUrl = process.env.IOTA_EXPLORER_BASE_URL || "https://explorer.evm.testnet.iota.cafe";

  console.log(JSON.stringify({
    ok: true,
    network: connection.networkName,
    contract: "NexidEvidenceAnchor",
    contract_version: "evidence_anchor_v2",
    address,
    deployer: deployer.address,
    tx_hash: txHash,
    explorer_url: txHash ? `${explorerBaseUrl.replace(/\/$/, "")}/tx/${txHash}` : null,
    next_env: {
      IOTA_PROVIDER_MODE: "iota_evm_contract",
      IOTA_EVM_ANCHOR_CONTRACT_V2: address,
      IOTA_EVM_ANCHOR_CONTRACT_VERSION_V2: "evidence_anchor_v2",
      IOTA_EXPLORER_BASE_URL: explorerBaseUrl,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, reason: error instanceof Error ? error.message : "deploy_failed" }));
  process.exit(1);
});

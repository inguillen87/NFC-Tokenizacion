import hre from "hardhat";

async function main() {
  const owner = process.env.POLYGON_DEPLOY_OWNER || process.env.POLYGON_DEFAULT_RECIPIENT || "";
  if (!owner) throw new Error("missing_POLYGON_DEPLOY_OWNER_or_POLYGON_DEFAULT_RECIPIENT");

  const factory = await hre.ethers.getContractFactory("NexidTraceabilityNFT");
  const contract = await factory.deploy(owner);
  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log(JSON.stringify({
    ok: true,
    network: hre.network.name,
    contract: "NexidTraceabilityNFT",
    address,
    owner,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, reason: error instanceof Error ? error.message : "deploy_failed" }));
  process.exit(1);
});

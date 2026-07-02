import { network } from "hardhat";
import { isAddress } from "ethers";

async function main() {
  const connection = await network.create();
  const { ethers } = connection;
  const [deployer] = await ethers.getSigners();
  const owner = process.env.POLYGON_DEPLOY_OWNER || deployer.address;
  const minter = process.env.POLYGON_MINTER_ADDRESS || deployer.address;
  if (!isAddress(owner)) throw new Error("invalid_POLYGON_DEPLOY_OWNER");
  if (!isAddress(minter)) throw new Error("invalid_POLYGON_MINTER_ADDRESS");

  const factory = await ethers.getContractFactory("NexidTraceabilityNFT", deployer);
  const contract = await factory.deploy(owner, minter);
  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log(JSON.stringify({
    ok: true,
    network: connection.networkName,
    contract: "NexidTraceabilityNFT",
    address,
    deployer: deployer.address,
    owner,
    minter,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, reason: error instanceof Error ? error.message : "deploy_failed" }));
  process.exit(1);
});

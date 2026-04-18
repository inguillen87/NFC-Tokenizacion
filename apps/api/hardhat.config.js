import "@nomicfoundation/hardhat-ethers";

const amoyRpcUrl = process.env.POLYGON_RPC_URL || "";
const privateKey = (process.env.POLYGON_MINTER_PRIVATE_KEY || "").trim();

/** @type {import("hardhat/config").HardhatUserConfig} */
const config = {
  solidity: "0.8.24",
  defaultNetwork: "hardhat",
  networks: {
    amoy: {
      url: amoyRpcUrl,
      accounts: privateKey ? [privateKey] : [],
    },
  },
};

export default config;

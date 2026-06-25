import hardhatEthers from "@nomicfoundation/hardhat-ethers";

const amoyRpcUrl = process.env.POLYGON_RPC_URL || "";
const privateKey = (process.env.POLYGON_MINTER_PRIVATE_KEY || "").trim();
const networks = amoyRpcUrl
  ? {
      amoy: {
        type: "http",
        url: amoyRpcUrl,
        accounts: privateKey ? [privateKey] : [],
      },
    }
  : {};

/** @type {import("hardhat/config").HardhatUserConfig} */
const config = {
  plugins: [hardhatEthers],
  solidity: {
    version: "0.8.24",
    settings: {
      evmVersion: "cancun",
    },
  },
  defaultNetwork: "hardhat",
  networks,
};

export default config;

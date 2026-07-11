import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import hardhatVerify from "@nomicfoundation/hardhat-verify";

const amoyRpcUrl = process.env.POLYGON_RPC_URL || "";
const privateKey = (process.env.POLYGON_MINTER_PRIVATE_KEY || "").trim();
const iotaEvmTestnetRpcUrl = process.env.IOTA_EVM_RPC_URL || "https://json-rpc.evm.testnet.iota.cafe";
const iotaPrivateKey = (process.env.IOTA_EVM_PRIVATE_KEY || "").trim();
const networks = {};

if (amoyRpcUrl) {
  networks.amoy = {
    type: "http",
    url: amoyRpcUrl,
    chainId: 80002,
    accounts: privateKey ? [privateKey] : [],
  };
}

if (iotaEvmTestnetRpcUrl) {
  networks["iotaevm-testnet"] = {
    type: "http",
    url: iotaEvmTestnetRpcUrl,
    chainId: 1076,
    accounts: iotaPrivateKey ? [iotaPrivateKey] : [],
  };
}

/** @type {import("hardhat/config").HardhatUserConfig} */
const config = {
  plugins: [hardhatEthers, hardhatVerify],
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

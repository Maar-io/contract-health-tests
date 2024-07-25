import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config({ path: __dirname + "/.env" });
const TESTNET_PRIVATE_KEY = process.env.TESTNET_PRIVATE_KEY || "";
console.log("TESTNET_PRIVATE_KEY set:", !!TESTNET_PRIVATE_KEY);

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  solidity: "0.8.24",
  networks: {

    localhost: {
      accounts: [process.env.TESTNET_PRIVATE_KEY || ""],
      url: "http://localhost:8545/"
    },
    sepolia: {
      accounts: [process.env.TESTNET_PRIVATE_KEY || ""],
      url: "https://sepolia-01.astar.network/"
    },
    osaki: {
      accounts: [process.env.TESTNET_PRIVATE_KEY || ""],
      url: "http://rpc.stg.hypersonicl2.com/"
    },
    zkyoto: {
      accounts: [process.env.TESTNET_PRIVATE_KEY || ""],
      url: "https://rpc.startale.com/zkyoto"
    }
  },
}
export default config;

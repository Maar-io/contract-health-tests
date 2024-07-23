import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.24",


  networks: {

    localhost: {
      url: "http://localhost:8545/"
    },
    sepolia: {
      url: "https://sepolia-01.astar.network/"
    },
    osaki: {
      url: "http://rpc.stg.hypersonicl2.com/"
    }
  }
}
export default config;

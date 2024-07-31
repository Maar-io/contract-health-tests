// npx hardhat test test/Deposit.ts --network sepolia

import { expect } from "chai";
import * as hre from "hardhat";
import { Contract } from "ethers";

// Example configuration names: 'l1Network' and 'l2Network'
const l1Provider = new hre.ethers.JsonRpcProvider(process.env.L1_RPC_URL);
const l2Provider = new hre.ethers.JsonRpcProvider(process.env.L2_RPC_URL);
const POLLING_INTERVAL = 10000; // 10 seconds
let eventReceived = false; // Flag to indicate if the event has been received

const L1StandardBridgeProxyAddress = "0x5a6d4aAD601fE380995d93475A8b7f764F703eE4";
const L2bridgeContractAddress = "0x4200000000000000000000000000000000000010";
const AMOUNT = BigInt("10000000000000000"); // 0.0001 ETH
let initialL2BlockNumber = 0;

const StandardBridgeABI = [
    "function depositETH(uint32 _minGasLimit, bytes calldata _extraData) external payable",
    "event ETHDepositInitiated(address indexed from, address indexed to, uint256 amount, bytes extraData)",
    "event ETHBridgeInitiated(address indexed from, address indexed to, uint256 amount, bytes extraData)"
];

const L2StandardBridgeABI = [
    "event DepositFinalized(address indexed l1Token, address indexed l2Token, address indexed from, address to, uint256 amount, bytes extraData)",
    "function version() external view returns (string)"
];

async function depositETHonL1(user: any) {
    // Get L2 current block number. we will monitor L2 deposit events from this block number
    initialL2BlockNumber = await l2Provider.getBlockNumber();

    // Deposit ETH on L1
    const bridgeL1 = new hre.ethers.Contract(L1StandardBridgeProxyAddress, StandardBridgeABI, user);
    const tx = await bridgeL1.depositETH(200000, "0x", { value: AMOUNT });
    await tx.wait();
    // console.log(`Deposit Transaction receipt: ${JSON.stringify(tx, null, 2)}`);

    // check deposit events on L1
    console.log(`Deposit Transaction on L1 hash: ${tx.hash}`);
    const receipt = await l1Provider.getTransactionReceipt(tx.hash);
    if (!receipt) {
        throw new Error(`Failed to fetch transaction receipt for hash: ${tx.hash}`);
    }

    expect(receipt?.logs.length).to.be.equal(5);
    await expect(tx).to.emit(bridgeL1, "ETHDepositInitiated").withArgs(user, user, AMOUNT, "0x");
    await expect(tx).to.emit(bridgeL1, "ETHBridgeInitiated").withArgs(user, user, AMOUNT, "0x");
}

async function pollForEvents(bridgeL2: Contract, userAddress: string, eventName: string) {

    // Example event:
    // {"_type":"log","address":"0x4200000000000000000000000000000000000010",
    // "blockHash":"0xffdf725baae9ac51fa2915ce8f0215897446cb857491367473c35c71508900dc",
    // "blockNumber":920733,
    // "data":"0x000000000000000000000000aaafb3972b05630fccee866ec69cdadd9bac277100000000000000000000000000000000000000000000000000005af3107a400000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000000",
    // "index":0,"removed":false,
    // "topics":[
    //       "0xb0444523268717a02698be47d0803aa7468c00acbed2f8bd93a0459cde61dd89",
    //       "0x0000000000000000000000000000000000000000000000000000000000000000",
    //       "0x000000000000000000000000deaddeaddeaddeaddeaddeaddeaddeaddead0000",
    //       "0x000000000000000000000000aaafb3972b05630fccee866ec69cdadd9bac2771"],
    // "transactionHash":"0x087e1e2a8d69600710d2b44675146cfd7709b05e7e5c698593ffbb5de8c1bd32",
    // "transactionIndex":1}

    if (eventReceived) {
        console.log(`${eventName} event received. Stopping further polling.`);
        return; // Exit the function if the event has been received.
    }

    let lastBlockNumber = initialL2BlockNumber;
    try {
        const currentBlockNumber = await l2Provider.getBlockNumber();
        console.log(`Checking for ${eventName} event in block ${lastBlockNumber} to ${currentBlockNumber}`);
        const events = await bridgeL2.queryFilter(eventName, lastBlockNumber, currentBlockNumber);

        // parse received events
        events.forEach((event) => {
            let toAddress = '0x' + event.data.substring(26, 66);
            toAddress = toAddress.toLowerCase();
            const amountHex = event.data.substring(66, 130);
            const amount = BigInt('0x' + amountHex);
            if (amount === BigInt(AMOUNT) && toAddress === userAddress.toLowerCase()) {
                eventReceived = true; // Set the flag to true
                return;
            }
            console.log(`L2 Transaction Hash: ${event.transactionHash}`);
        });

        // Update the last block number
        lastBlockNumber = currentBlockNumber + 1;
        initialL2BlockNumber = lastBlockNumber;
    } catch (error) {
        console.error("Error while polling for events:", error);
    } finally {
        // Schedule the next poll
        if (!eventReceived) {
            await wait(POLLING_INTERVAL);
            await pollForEvents(bridgeL2, userAddress, eventName);
        }
    }

}

// Helper function to wait for a specified time
const wait = (ms: number): Promise<number> => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

describe("Deposit ETH on L1", function () {
    let user: any;

    this.beforeEach(async function () {
        const signers = await hre.ethers.getSigners();
        user = signers[0];
    });

    it("Deposit ETH on L1", async function () {
        // Check the ETH balance of the signer
        const balanceWei = await hre.ethers.provider.getBalance(user.address);
        const balanceEther = hre.ethers.formatEther(balanceWei);
        const balanceEtherBigNumber = hre.ethers.parseEther(balanceEther);
        expect(balanceEtherBigNumber).to.be.gt(0);
        console.log(`L1 network: ${hre.network.config.chainId}, ETH balance ${balanceEther}`)

        // Deposit ETH and bridge it to L2
        await depositETHonL1(user);
        const balanceNewWei = await hre.ethers.provider.getBalance(user.address);
        const balanceNewEther = hre.ethers.formatEther(balanceNewWei);
        expect(balanceNewWei).to.be.lt(balanceWei);
        console.log(`✅ ETH Deposit initiated on L1, new ETH balance: ${balanceNewEther}`);
    });

    it("Receive ETH Deposit on L2", async function () {
        this.timeout(240000); // Set timeout for this test case

        // Check the ETH balance of the signer
        const balanceWei = await hre.ethers.provider.getBalance(user.address);
        const balanceEther = hre.ethers.formatEther(balanceWei);
        console.log(`L1 network: ${hre.network.config.chainId}, ETH balance ${balanceEther}`)

        // Contract details
        const bridgeL2 = new hre.ethers.Contract(L2bridgeContractAddress, L2StandardBridgeABI, l2Provider);
        // console.log(`Connected to L2 bridge contract: ${bridgeL2.target}, version: ${await bridgeL2.version()}`);

        // Check the events on L2
        await pollForEvents(bridgeL2, user.address, "DepositFinalized");
        const balanceNewWei = await hre.ethers.provider.getBalance(user.address);
        const balanceNewEther = hre.ethers.formatEther(balanceNewWei);
        expect(balanceNewWei).to.be.gt(balanceWei);
        console.log(`✅ ETH deposit finalized on L2, new L2 ETH balance: ${balanceNewEther}`);
    });
});
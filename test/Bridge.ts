import { ethers } from "hardhat";
import { expect } from "chai";

import { l2ABI } from "./l2BridgeABI";
import { Contract, DeferredTopicFilter } from "ethers";

// Example configuration names: 'l1Network' and 'l2Network'
const l1Provider = new ethers.JsonRpcProvider(process.env.L1_RPC_URL);
const l2Provider = new ethers.JsonRpcProvider(process.env.L2_RPC_URL);
const POLLING_INTERVAL = 10000; // 10 seconds

const L1StandardBridgeProxyAddress = "0x5a6d4aAD601fE380995d93475A8b7f764F703eE4";
const AMOUNT = 100000000000000; // 0.0001 ETH
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

async function depositETHonL1 () {
    // Get the signer
    const signers = await ethers.getSigners();
    const owner = signers[0];


    // Check the ETH balance of the signer
    const balanceWei = await ethers.provider.getBalance(owner.address);
    const balanceEther = ethers.formatEther(balanceWei);
    console.log(`Balance of ${owner.address}: ${balanceEther} ETH`);
    const balanceEtherBigNumber = ethers.parseEther(balanceEther);

    expect(balanceEtherBigNumber).to.be.gt(0);

    // Get L2 current block number
    initialL2BlockNumber = await l2Provider.getBlockNumber();


    const bridgeL1 = new ethers.Contract(L1StandardBridgeProxyAddress, StandardBridgeABI, owner);
    const tx = await bridgeL1.depositETH(200000, "0x", { value: AMOUNT });
    await tx.wait();
    // console.log(`Deposit Transaction receipt: ${JSON.stringify(tx, null, 2)}`);

    // check deposit events
    console.log(`Deposit Transaction on L1 hash: ${tx.hash}`);
    const receipt = await l1Provider.getTransactionReceipt(tx.hash);
    if (!receipt) {
        throw new Error(`Failed to fetch transaction receipt for hash: ${tx.hash}`);
    }
    // console.log(`Deposit Transaction receipt: ${JSON.stringify(receipt, null, 2)}`);

    expect(receipt?.logs.length).to.be.equal(5);
    await expect(tx).to.emit(bridgeL1, "ETHDepositInitiated").withArgs(owner, owner, AMOUNT, "0x");
    console.log(`ETHDepositInitiated event emitted`);
    await expect(tx).to.emit(bridgeL1, "ETHBridgeInitiated").withArgs(owner, owner, AMOUNT, "0x");
    console.log(`ETHBridgeInitiated event emitted`);

}

async function listenForEvent (bridgeL2: Contract, userAddress: string) {
    // Set events filter
    const eventFilter = await bridgeL2.filters["DepositFinalized"]();
    console.log(`Event filter: ${JSON.stringify(eventFilter, null, 2)}`);

    return new Promise((resolve, reject) => {
        // Listen for the event
        console.log("Listening for event:", eventFilter);
        bridgeL2.on(eventFilter, (l1Token, l2Token, from, to, amount, extraData, event) => {
            console.log(`DepositFinalized Event Detected:
              - L1 Token: ${l1Token}
              - L2 Token: ${l2Token}
              - From: ${from}
              - To: ${to}
              - Amount: ${amount.toString()}
              - Extra Data: ${extraData}`);
            if (from === userAddress && to === userAddress && amount.eq(AMOUNT)) {
                console.log("Found matching event:", event);
                bridgeL2.removeAllListeners(eventFilter);
                resolve(event);
            }
            else {
                console.log("Event does not match the expected arguments.");
            }
        });
    });
}

async function pollForEvents (bridgeL2: Contract) {

    // Event Detected: {"_type":"log","address":"0x4200000000000000000000000000000000000010",
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

    let lastBlockNumber = initialL2BlockNumber;
    try {
        const currentBlockNumber = await l2Provider.getBlockNumber();
        console.log(`Polling for events from block ${lastBlockNumber} to ${currentBlockNumber}`);
        const events = await bridgeL2.queryFilter("DepositFinalized", lastBlockNumber, currentBlockNumber);

        events.forEach((event) => {
            console.log(`Event Detected: ${JSON.stringify(event)}`);
            // Remove the leading "0x" if present
            const cleanData = event.data.startsWith('0x') ? event.data.slice(2) : event.data;
            const toAddress = '0x' + cleanData.substring(24, 64);
            const amountHex = cleanData.substring(64, 128);
            const amount = BigInt('0x' + amountHex);
            console.log(`Event Detected - To: ${toAddress}, Amount: ${amount}`);
        });

        // Update the last block number
        lastBlockNumber = currentBlockNumber + 1;
        initialL2BlockNumber = lastBlockNumber;
    } catch (error) {
        console.error("Error while polling for events:", error);
    } finally {
        // Schedule the next poll
        await wait(POLLING_INTERVAL);
        await pollForEvents(bridgeL2);
    }

}
const wait = (ms: number): Promise<number> => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

describe("Deposit ETH on L1", function () {
    it("Deposit ETH on L1", async function () {
        const networkL1 = await l1Provider.getNetwork();

        console.log(`Connected to L1 network: ${networkL1.name}`);

        await depositETHonL1();
        console.log(`Deposit initiated on L1`);

    });

    it("Receive ETH Deposit on L2", async function () {
        this.timeout(240000); // Set timeout to 10000 milliseconds for all tests in this suite

        const networkL2 = await l2Provider.getNetwork();
        console.log(`Connected to L2 network: ${networkL2.chainId}`);

        // Get the signer
        const signers = await ethers.getSigners();
        const user = signers[0];

        // Contract details
        const L2bridgeContractAddress = "0x4200000000000000000000000000000000000010";
        const bridgeL2 = new ethers.Contract(L2bridgeContractAddress, l2ABI, l2Provider);
        console.log(`Connected to L2 bridge contract: ${bridgeL2.target}, version: ${await bridgeL2.version()}`);


        // Check the events on L2
        // await listenForEvent(bridgeL2, user.address)
        //     .then((event) => console.log("Event found:", event))
        //     .catch((error) => console.error("Error:", error));
        await pollForEvents(bridgeL2)
            .then((event) => console.log("Event found:", event))
            .catch((error) => console.error("Error:", error));


        console.log(`Deposit finalized on L2`);
    });
});
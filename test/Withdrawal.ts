// npx hardhat test test/Withdrawal.ts --network osaki

import { expect } from "chai";
import * as hre from "hardhat";
import { Contract } from "ethers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { getProveParameters, getWithdrawalMessage } from "./utils";
import { l2ToL1MessagePasserABI, optimismPortalABI, l2OutputOracleABI, l2StandardBridgeABI, l2StandardBridgeAddress } from "@eth-optimism/contracts-ts";


// Example configuration names: 'l1Network' and 'l2Network'
const l1Provider = new hre.ethers.JsonRpcProvider(process.env.L1_RPC_URL);
const l2Provider = new hre.ethers.JsonRpcProvider(process.env.L2_RPC_URL);

const POLLING_INTERVAL = 15000; // 10 seconds
let eventReceived = false; // Flag to indicate if the event has been received

const L1StandardBridgeProxyAddress = "0x5a6d4aAD601fE380995d93475A8b7f764F703eE4";
const L2bridgeContractAddress = "0x4200000000000000000000000000000000000010";
const SepoliaOptimismPortalAddress = "0x4b77cE16faEfAcfBDCf73F8643B51f290d377A4a"; // Osaki related contract
const SepoliaL2OutputOracleProxy = "0xBD56179F126b0fd54611Fb59FFc8230DE0210c38"; // Osaki related contract

const AMOUNT = 100000000000000; // 0.0001 ETH
let initialL1BlockNumber = 0;

const StandardBridgeABI = [
    "function depositETH(uint32 _minGasLimit, bytes calldata _extraData) external payable",
    "event ETHDepositInitiated(address indexed from, address indexed to, uint256 amount, bytes extraData)",
    "event ETHBridgeInitiated(address indexed from, address indexed to, uint256 amount, bytes extraData)"
];

// const l2OutputOracleABI = [
//     "function getL2OutputIndexAfter(uint256 _blockNumber) external view returns (uint256)",
//     "function latestBlockNumber() external view returns (uint256)",
//     "function getL2Output(uint256 _index) external view returns (bytes32, uint256, uint256)",
// ];

const OptimismPortalABI = [
    "event WithdrawalProven(bytes32 indexed withdrawalHash, address indexed from, address indexed to)",
    "function version() external view returns (string)",
    "function proveWithdrawalTransaction(Types.WithdrawalTransaction memory _tx, uint256 _l2OutputIndex, Types.OutputRootProof calldata _outputRootProof,bytes[] calldata _withdrawalProof)"
]
const L2StandardBridgeABI = [
    "event DepositFinalized(address indexed l1Token, address indexed l2Token, address indexed from, address to, uint256 amount, bytes extraData)",
    "function version() external view returns (string)",
    "function withdraw(address _l2Token,uint256 _amount,uint32 _minGasLimit,bytes calldata _extraData) external payable",
    "event WithdrawalInitiated(address indexed l1Token,address indexed l2Token,address indexed from,address to,uint256 amount,bytes extraData)",
    "event ETHBridgeInitiated(address indexed l1Token, address indexed l2Token, address indexed from, address to, uint256 amount, bytes extraData)"
];

function parseLogs(log: any) {
    // Create an interface
    const iface = new hre.ethers.Interface(L2StandardBridgeABI);
    // Decode the event
    const decodedEvent = iface.parseLog(log);

    // Convert BigInt values to strings
    const args = Object.fromEntries(
        Object.entries(decodedEvent?.args ?? {}).map(([key, value]) => [
            key,
            typeof value === 'bigint' ? value.toString() : value
        ])
    );

    console.log(`Event Name: ${decodedEvent?.name}`);
    console.log(`Event Args: ${JSON.stringify(args, null, 2)}`);
}

async function withdrawETHfromL2(user: any) {
    // Get L2 current block number. we will monitor L2 deposit events from this block number
    initialL1BlockNumber = await l1Provider.getBlockNumber();

    // Withdraw ETH from L2
    const bridgeL2 = new hre.ethers.Contract(L2bridgeContractAddress, L2StandardBridgeABI, user);
    const tx = await bridgeL2.withdraw("0xdeaddeaddeaddeaddeaddeaddeaddeaddead0000", AMOUNT, 0, "0x", { value: AMOUNT });
    await tx.wait();
    // console.log(`Deposit Transaction receipt: ${JSON.stringify(tx, null, 2)}`);

    // check deposit events on L1
    console.log(`Withdrawal Transaction on L2 hash: ${tx.hash}`);
    const receipt = await l2Provider.getTransactionReceipt(tx.hash);
    if (!receipt) {
        throw new Error(`Failed to fetch transaction receipt for hash: ${tx.hash}`);
    }

    expect(receipt?.logs.length).to.be.equal(5);
    await expect(tx).to.emit(bridgeL2, "WithdrawalInitiated").withArgs(anyValue, anyValue, user.address, user.address, AMOUNT, "0x");
    console.log(`WithdrawalInitiated event emitted`);
    //     await expect(tx).to.emit(bridgeL2, "ETHBridgeInitiated").withArgs(user.address, user.address, AMOUNT, "0x");
    //     console.log(`ETHBridgeInitiated event emitted`);
    return receipt;
}

async function pollForEvents(bridgeL2: Contract, userAddress: string) {

    if (eventReceived) {
        console.log("DepositFinalized event received. Stopping further polling.");
        return; // Exit the function if the event has been received.
    }

    let lastBlockNumber = initialL1BlockNumber;
    const currentBlockNumber = await l1Provider.getBlockNumber();
    if (lastBlockNumber <= currentBlockNumber) {

        try {
            console.log(`Checking for WithdrawalProven event in block ${lastBlockNumber} to ${currentBlockNumber}`);
            const events = await bridgeL2.queryFilter("WithdrawalProven", lastBlockNumber, currentBlockNumber);

            // parse received events
            events.forEach((event) => {
                console.log(`WithdrawalProven Event: ${JSON.stringify(event, null, 2)}`);
                let toAddress = '0x' + event.data.substring(26, 66);
                toAddress = toAddress.toLowerCase();
                const amountHex = event.data.substring(66, 130);
                const amount = BigInt('0x' + amountHex);
                console.log(`WithdrawalProven Detected for: ${toAddress}, ${amount}`);
                if (amount === BigInt(AMOUNT) && toAddress === userAddress.toLowerCase()) {
                    console.log(`DepositFinalized Matched`);
                    eventReceived = true; // Set the flag to true
                    return;
                }
                console.log(`L2 Transaction Hash: ${event.transactionHash}`);
            });

            // Update the last block number
            lastBlockNumber = currentBlockNumber + 1;
            initialL1BlockNumber = lastBlockNumber;

        } catch (error) {
            console.error("Error while polling for events:", error);
        }
    }
    // Schedule the next poll
    if (!eventReceived) {
        await wait(POLLING_INTERVAL);
        await pollForEvents(bridgeL2, userAddress);
    }
}

// Helper function to wait for a specified time
const wait = (ms: number): Promise<number> => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

describe("Withdraw ETH from L2", function () {
    let user: any;
    let withdrawTxReceipt: any;

    this.beforeEach(async function () {
        const signers = await hre.ethers.getSigners();
        user = signers[0];
    });

    it("Withdraw ETH from L2", async function () {
        // Check the ETH balance of the signer
        const balanceWei = await hre.ethers.provider.getBalance(user.address);
        const balanceEther = hre.ethers.formatEther(balanceWei);
        const balanceEtherBigNumber = hre.ethers.parseEther(balanceEther);
        expect(balanceEtherBigNumber).to.be.gt(0);
        console.log(`L2 network: ${hre.network.config.chainId}, ETH balance ${balanceEther}`)

        withdrawTxReceipt = await withdrawETHfromL2(user);
        const balanceNewWei = await hre.ethers.provider.getBalance(user.address);
        const balanceNewEther = hre.ethers.formatEther(balanceNewWei);
        const balanceNewEtherBigNumber = hre.ethers.parseEther(balanceEther);
        // expect(balanceNewEtherBigNumber).to.be.lt(balanceEtherBigNumber);
        console.log(`✅ ETH Withdrawal initiated on L2, new balance: ${balanceNewEther}`);
    });

    it("Prove ETH Withdrawal on L1", async function () {
        this.timeout(240000); // Set timeout for this test case

        const networkL1 = await l1Provider.getNetwork();
        console.log(`Connected to L1 network: ${networkL1.chainId}`);

        // Contract details
        const l2OutputOracle = new hre.ethers.Contract(SepoliaL2OutputOracleProxy, l2OutputOracleABI, l1Provider);
        console.log(`Connected to L1 bridge contract: ${l2OutputOracle.target}`);

        expect(withdrawTxReceipt).to.not.be.undefined;
        const withdrawalMsg = getWithdrawalMessage(withdrawTxReceipt);
        const bedrockProof = getProveParameters(l2OutputOracle, withdrawalMsg, l2Provider);

        console.log(`Withdrawal Message: ${JSON.stringify(withdrawalMsg, null, 2)}`);
        console.log(`Bedrock Proof: ${JSON.stringify(bedrockProof, null, 2)}`);


        // const blockNumberOfLatestL2OutputProposal = await getBlockNumberOfLatestL2OutputProposal(l2OutputOracle);
        // const withdrawalL2OutputIndex = await getWithdrawalL2OutputIndex(l2OutputOracle, blockNumberOfLatestL2OutputProposal);
        // const [outputRoot, timestamp, l2BlockNumber] = await getWithdrawalL2Output(l2OutputOracle, withdrawalL2OutputIndex);

        // const messageBedrockOutput = {
        //     outputRoot: outputRoot,
        //     l1Timestamp: timestamp,
        //     l2BlockNumber: l2BlockNumber,
        //     l2OutputIndex: withdrawalL2OutputIndex,
        //   };

        // const hashedWithdrawal = hashWithdrawal(WithdrawalMsg);

        // Call ProveWithdrawal function TODO
        // const tx = await optimismPortal.proveWithdrawalTransaction("0xdeaddeaddeaddeaddeaddeaddeaddeaddead0000", user.address, AMOUNT);

        // await tx.wait();
        // // console.log(`Deposit Transaction receipt: ${JSON.stringify(tx, null, 2)}`);

        // // check withdrawal events on L1
        // console.log(`proveWithdrawal Transaction on L1 hash: ${tx.hash}`);
        // const receipt = await l1Provider.getTransactionReceipt(tx.hash);
        // if (!receipt) {
        //     throw new Error(`Failed to fetch transaction receipt for hash: ${tx.hash}`);
        // }

        // expect(receipt?.logs.length).to.be.equal(5);
        // // console.log(`Transaction receipt logs: ${JSON.stringify(receipt.logs, null, 2)}`);
        // await expect(tx).to.emit(optimismPortal, "WithdrawalProved").withArgs(anyValue, anyValue, user.address, user.address, AMOUNT, "0x");
        // console.log(`WithdrawalInitiated event emitted`);

        // console.log(`Withdrawal finalized on L1`);
    });
});
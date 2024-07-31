// npx hardhat test test/DepositERC20.ts --network sepolia

import { expect } from "chai";
import * as hre from "hardhat";
import { Contract } from "ethers";

const l1Provider = new hre.ethers.JsonRpcProvider(process.env.L1_RPC_URL);
const l2Provider = new hre.ethers.JsonRpcProvider(process.env.L2_RPC_URL);
const POLLING_INTERVAL = 10000; // 10 seconds
let eventReceived = false; // Flag to indicate if the event has been received


const L1StandardBridgeProxyAddress = "0x5a6d4aAD601fE380995d93475A8b7f764F703eE4";
const L2bridgeContractAddress = "0x4200000000000000000000000000000000000010";
const AMOUNT = BigInt("1000000000000000000"); // 1 ERC20 token
let initialL2BlockNumber = 0;
const l1Token = "0x5589BB8228C07c4e15558875fAf2B859f678d129"
const l2Token = "0x10c325046d1Ad3628ab13F3E0Bc6edF2E11912d4"

const StandardBridgeABI = [
    "function bridgeERC20To(address _localToken, address _remoteToken,address _to,uint256 _amount,uint32 _minGasLimit,bytes _extraData)",
    "event ETHDepositInitiated(address indexed from, address indexed to, uint256 amount, bytes extraData)",
    "event ETHBridgeInitiated(address indexed from, address indexed to, uint256 amount, bytes extraData)",
    "event ERC20DepositInitiated(address indexed l1Token, address indexed l2Token, address indexed from, address to, uint256 amount, bytes extraData)",
    "event ERC20BridgeInitiated(address indexed localToken, address indexed remoteToken, address indexed from, address to, uint256 amount, bytes extraData)",
    "event ERC20BridgeFinalized(address indexed arg0, address indexed arg1, address indexed arg2, address arg3, uint256 arg4, bytes arg5)",
];
const erc20ABI = [
    "function allowance(address _owner, address _spender) view returns (uint256 remaining)",
    "function approve(address _spender, uint256 _value) returns (bool success)",
    "function balanceOf(address _owner) view returns (uint256 balance)",
    "function faucet()"
];
const L2StandardBridgeABI = [
    "event DepositFinalized(address indexed l1Token, address indexed l2Token, address indexed from, address to, uint256 amount, bytes extraData)",
    "function version() external view returns (string)"
];

async function depositERC20onL1(l1ERC20: Contract, user: any) {
    // Get some ERC20 tokens on L1
    // const fetchTx = await l1ERC20.faucet()
    // await fetchTx.wait()

    // Approve the ERC20 token for the bridge
    // console.log(`Approving ERC20 token for the bridge`)
    const approveTx = await l1ERC20.approve(L1StandardBridgeProxyAddress, AMOUNT)
    await approveTx.wait()
    const allowance = await l1ERC20.allowance(user.address, L1StandardBridgeProxyAddress)
    expect(allowance).to.be.at.least(AMOUNT);

    // Get L2 current block number. we will monitor L2 deposit events from this block number
    initialL2BlockNumber = await l2Provider.getBlockNumber();

    // Deposit ERC20 token on L1
    // console.log(`Depositing ERC20 token`);
    const bridgeL1 = new hre.ethers.Contract(L1StandardBridgeProxyAddress, StandardBridgeABI, user);
    const depositTx = await bridgeL1.bridgeERC20To(l1Token, l2Token, user.address, AMOUNT, 3000000, "0x");
    await depositTx.wait();
    // console.log(`Deposit Transaction receipt: ${JSON.stringify(tx, null, 2)}`);

    // check deposit events on L1
    console.log(`Deposit ERC20 Transaction on L1, hash: ${depositTx.hash}`);
    const receipt = await l1Provider.getTransactionReceipt(depositTx.hash);
    if (!receipt) {
        throw new Error(`Failed to fetch transaction receipt for hash: ${depositTx.hash}`);
    }

    expect(receipt?.logs.length).to.be.equal(6);
    await expect(depositTx).to.emit(bridgeL1, "ERC20BridgeInitiated").withArgs(l1Token, l2Token, user, user, AMOUNT, "0x");
    // console.log(`ERC20BridgeInitiated event emitted`);
}


async function pollForEvents(bridgeL2: Contract, userAddress: string) {

    if (eventReceived) {
        // console.log("DepositFinalized event received. Stopping further polling.");
        return; // Exit the function if the event has been received.
    }

    let lastBlockNumber = initialL2BlockNumber;
    try {
        const currentBlockNumber = await l2Provider.getBlockNumber();
        console.log(`Checking for DepositFinalized event in L2 block ${lastBlockNumber} to ${currentBlockNumber}`);
        const events = await bridgeL2.queryFilter("DepositFinalized", lastBlockNumber, currentBlockNumber);

        // parse received events
        events.forEach((event) => {
            let toAddress = '0x' + event.data.substring(26, 66);
            toAddress = toAddress.toLowerCase();
            const amountHex = event.data.substring(66, 130);
            const amount = BigInt('0x' + amountHex);
            // console.log(`DepositFinalized Detected for: ${toAddress}, ${amount}`);
            if (amount === BigInt(AMOUNT) && toAddress === userAddress.toLowerCase()) {
                // console.log(`DepositFinalized Matched`);
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
            await pollForEvents(bridgeL2, userAddress);
        }
    }

}

// Helper function to wait for a specified time
const wait = (ms: number): Promise<number> => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

describe("Deposit ERC20 on L1", function () {
    let user: any;

    this.beforeEach(async function () {
        const signers = await hre.ethers.getSigners();
        user = signers[0];
    }
    );

    it("Deposit ERC20 on L1", async function () {
        this.timeout(60000); // Set timeout for this test case

        // Check the ETH balance of the signer
        const balanceWei = await hre.ethers.provider.getBalance(user.address);
        const balanceEther = hre.ethers.formatEther(balanceWei);
        const balanceEtherBigNumber = hre.ethers.parseEther(balanceEther);
        expect(balanceEtherBigNumber).to.be.gt(0);

        // Check the ERC20 balance of the signer
        const l1ERC20 = new hre.ethers.Contract(l1Token, erc20ABI, user)
        const l1ERC20BalanceWei: bigint = await l1ERC20.balanceOf(user.address);
        const l1ERC20Balance = hre.ethers.formatUnits(l1ERC20BalanceWei, 18);
        console.log(`L1 network: ${hre.network.config.chainId}, ERC20 balance: ${l1ERC20Balance}, ETH balance ${balanceEther}`)

        await depositERC20onL1(l1ERC20, user);
        const l1ERC20BalanceNewWei: bigint = await l1ERC20.balanceOf(user.address);
        const l1ERC20BalanceNew = hre.ethers.formatUnits(l1ERC20BalanceNewWei, 18);
        expect(l1ERC20BalanceNewWei).to.be.equal(BigInt(l1ERC20BalanceWei) - AMOUNT);
        console.log(`✅ ERC20 Deposit initiated on L1, new balance: ${l1ERC20BalanceNew}`);
    });

    it("Receive ERC20 Deposit on L2", async function () {
        this.timeout(240000); // Set timeout for this test case

        // Check the ERC20 balance of the signer
        const networkL2 = await l2Provider.getNetwork();
        const l2ERC20 = new hre.ethers.Contract(l2Token, erc20ABI, l2Provider);
        const l2ERC20BalanceWei: bigint = await l2ERC20.balanceOf(user.address);
        const l2ERC20Balance = hre.ethers.formatUnits(l2ERC20BalanceWei, 18);
        console.log(`L2 network: ${networkL2.chainId}, ERC20 balance: ${l2ERC20Balance}`);

        // Connect to bridge contract
        const bridgeL2 = new hre.ethers.Contract(L2bridgeContractAddress, L2StandardBridgeABI, l2Provider);

        // Check the events on L2
        await pollForEvents(bridgeL2, user.address);

        const l2ERC20BalanceNewWei: bigint = await l2ERC20.balanceOf(user.address);
        const l2ERC20BalanceNew = hre.ethers.formatUnits(l2ERC20BalanceNewWei, 18);
        expect(l2ERC20BalanceNewWei).to.be.equal(BigInt(l2ERC20BalanceWei) + AMOUNT);
        console.log(`✅ ERC20 deposit finalized on L2, new balance: '${l2ERC20BalanceNew}'`);

    });
});
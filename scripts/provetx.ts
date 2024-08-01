// npx hardhat run scripts/provetx.ts --network osaki
// npx hardhat run scripts/provetx.ts --network hardhat

import { ethers } from "hardhat";
import { getWithdrawalMessage, getProveParameters, bigintReplacer } from "../test/utils";
import { optimismPortalABI, l2OutputOracleABI } from "@eth-optimism/contracts-ts";

const SepoliaL2OutputOracleProxy = "0xBD56179F126b0fd54611Fb59FFc8230DE0210c38"; // Osaki related contract
const SepoliaOptimismPortalAddress = "0x4b77cE16faEfAcfBDCf73F8643B51f290d377A4a"; // Osaki related contract

// input parameter
const L2_WITHDRAW_TX_HASH="0xd34244b9d641f85e5047b70b30ce06ac619b0904ea2e699e808af52a72ba4c1e"
// const L2_WITHDRAW_TX_HASH = "0x7dbff1870373752197ed8d5614ba33e12a33ca82f7065faf49126afcd6b0afc2";  // already proved Tx 

// Get receipt for given Th hash
async function getReceipt() {
    const provider = new ethers.JsonRpcProvider(process.env.L2_RPC_URL);

    try {
        // Fetch the transaction receipt
        const receipt = await provider.getTransactionReceipt(L2_WITHDRAW_TX_HASH);

        // Check if the receipt is null (transaction not found)
        if (!receipt) {
            console.error(`Transaction receipt not found for hash: ${L2_WITHDRAW_TX_HASH}`);
            process.exit(1);
        }

        // Log the transaction receipt
        console.log("Transaction Receipt:", receipt);
        return receipt;
    } catch (error) {
        console.error("Error fetching transaction receipt:", error);
        process.exit(1);
    }
}
async function proveIt(withdrawTxReceipt: any) {
    const l1Provider = new ethers.JsonRpcProvider(process.env.L1_RPC_URL);
    const l2Provider = new ethers.JsonRpcProvider(process.env.L2_RPC_URL);

    const l2OutputOracle = new ethers.Contract(SepoliaL2OutputOracleProxy, l2OutputOracleABI, l1Provider);
    const ver = await l2OutputOracle.version();
    console.log(`L2 Output Oracle Version: ${ver}`);
    const withdrawalMsg = await getWithdrawalMessage(l2Provider, withdrawTxReceipt);
    console.log(`Withdrawal Message: ${JSON.stringify(withdrawalMsg, null, 2)}`);

    const bedrockProof = await getProveParameters(l2OutputOracle, withdrawalMsg, l1Provider, l2Provider);
    console.log(`Bedrock Proof: ${JSON.stringify(bedrockProof, bigintReplacer, 2)}`);

    // Destructure the withdrawalMsg object
    const { nonce, sender, target, value, gasLimit, data } = withdrawalMsg;

    // Destructure the bedrockProof object
    const {
        outputRootProof: {
            version,
            stateRoot,
            messagePasserStorageRoot,
            latestBlockhash
        },
        withdrawalProof,
        l2OutputIndex
    } = bedrockProof.bedrockProof;

    // <simulate the proveWithdrawal function call>
    const optimismPortal = new ethers.Contract(SepoliaOptimismPortalAddress, optimismPortalABI, l1Provider);
    const portalVer = await optimismPortal.version();
    console.log(`Optimism Portal Version: ${portalVer}`);

    try {
        const result = await optimismPortal.proveWithdrawalTransaction(
            {
                nonce,
                sender,
                target,
                value,
                gasLimit,
                data
            },
            l2OutputIndex,
            {
                version,
                stateRoot,
                messagePasserStorageRoot,
                latestBlockhash
            },
            withdrawalProof
        );
        console.log("Call successful, transaction succeed:", result);
    } catch (error) {
        console.error("Call failed, transaction fail:", error);
    }
}

// Execute the main function
getReceipt().then(proveIt)
    .catch((error) => {
        console.error("Error in script execution:", error);
        process.exit(1);
    });


/*
_tx (tuple)
    nonce (uint256)
    sender (address)
    target (address)
    value (uint256)
    gasLimit (uint256)
    data (bytes)


_l2OutputIndex (uint256)

_outputRootProof (tuple)
    version (bytes32)
    stateRoot (bytes32)
    messagePasserStorageRoot (bytes32)
    latestBlockhash (bytes32)

_withdrawalProof (bytes[])


*/


/*Osaki withdrawal transaction hash
0xd34244b9d641f85e5047b70b30ce06ac619b0904ea2e699e808af52a72ba4c1e

proveWithdrawalTransaction on Sepolia for the above tx hash

*/
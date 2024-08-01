// npx hardhat run scripts/provetx.ts --network osaki
import { ethers } from "hardhat";
import { getWithdrawalMessage, getProveParameters, bigintReplacer } from "../test/utils";
const SepoliaL2OutputOracleProxy = "0xBD56179F126b0fd54611Fb59FFc8230DE0210c38"; // Osaki related contract
import { l2ToL1MessagePasserABI, optimismPortalABI, l2OutputOracleABI } from "@eth-optimism/contracts-ts";

const L2_WITHDRAW_TX_HASH="0x478246e3539467a7d112718a872ffb37ba10f9a06fc9b466c8cb4bc3792efb82"

// Define the main function
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
    console.log(`Connected to L1 oracle contract: ${l2OutputOracle.target}`);

    const withdrawalMsg = getWithdrawalMessage(withdrawTxReceipt);
    console.log(`Withdrawal Message: ${JSON.stringify(withdrawalMsg, null, 2)}`);

    const bedrockProof = await getProveParameters(l2OutputOracle, withdrawalMsg, l1Provider, l2Provider);
    console.log(`Bedrock Proof: ${JSON.stringify(bedrockProof, bigintReplacer, 2)}`);
}

// Execute the main function
getReceipt().then(proveIt)
    .catch((error) => {
        console.error("Error in script execution:", error);
        process.exit(1);
    });


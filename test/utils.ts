import type { BedRockCrossChainMessageProof, WithdrawalMsg, Address } from "./types";
import { ethers, Contract, keccak256, AbiCoder, Log } from "ethers";

export const L2_L1_MESSAGE_PASSER_ADDRESS = "0x4200000000000000000000000000000000000016";
import { l2ToL1MessagePasserABI, optimismPortalABI, l2OutputOracleABI } from "@eth-optimism/contracts-ts";


async function getBlockNumberOfLatestL2OutputProposal (l2OutputOracle: Contract) {
    const blockNumberOfLatestL2OutputProposal = await l2OutputOracle.latestBlockNumber();
    console.log(`Block number of latest L2 output proposal: ${blockNumberOfLatestL2OutputProposal}`);
    return blockNumberOfLatestL2OutputProposal;
}

async function getWithdrawalL2OutputIndex (l2OutputOracle: Contract, blockNumber: bigint) {
    const L2OutputIndex = await l2OutputOracle.getL2OutputIndexAfter(blockNumber);
    console.log(`L2 Output Index: ${L2OutputIndex}`);
    return L2OutputIndex;
}

async function getWithdrawalL2Output (l2OutputOracle: Contract, withdrawalL2OutputIndex: bigint) {
    const l2Output = await l2OutputOracle.getL2Output(withdrawalL2OutputIndex);
    console.log(`L2 Output: ${l2Output}`);

    const [outputBytes, timestamp, blockNumber] = l2Output;
    console.log(`L2 Output Bytes: ${outputBytes}`);
    console.log(`L2 Output Timestamp: ${timestamp}`);
    console.log(`L2 Output Block Number: ${blockNumber}`);

    // Assuming l2Output is a bytes array, you can decode it using ethers.js
    const iface = new ethers.Interface(l2OutputOracleABI);
    // const abiCoder = new AbiCoder();
    const decodedOutput = iface.decodeFunctionResult("getL2Output", outputBytes);

    console.log(`Decoded L2 Output: ${decodedOutput}`);
    return l2Output;
}

function decodeEventLog(eventLog: any) {
    const iface = new ethers.Interface(l2ToL1MessagePasserABI);

    try {
        const parsedLog = iface.parseLog(eventLog);
        return parsedLog;
    } catch (error) {
        console.error(`Failed to parse log: ${JSON.stringify(eventLog, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value, 2)}`);
        console.error(error);
        return null;
    }
}

export function getWithdrawalMessage (withdrawalReceipt: any): WithdrawalMsg {
    let parsedWithdrawalLog: any;

    // Iterate over the logs and decode the relevant one
    withdrawalReceipt.logs.forEach((log: any) => {
        const decodedLog = decodeEventLog(log);
        if (decodedLog?.name === "MessagePassed") {
            parsedWithdrawalLog = decodedLog;
        }
    });

    // Check if the parsed log was found
    if (!parsedWithdrawalLog) {
        throw new Error("Log with name 'MessagePassed' not found");
    }

    const withdrawalMsg = {
        nonce: parsedWithdrawalLog.args.nonce.toString(),
        sender: parsedWithdrawalLog.args.sender,
        target: parsedWithdrawalLog.args.target,
        value: parsedWithdrawalLog.args.value.toString(),
        gasLimit: parsedWithdrawalLog.args.gasLimit.toString(),
        data: parsedWithdrawalLog.args.data,
    };

    return withdrawalMsg;
}


export function hashWithdrawal (withdrawalMsg: WithdrawalMsg): Address {
    console.log(`Hashing withdrawal: ${JSON.stringify(withdrawalMsg, null, 2)}`);
    const abiCoder = new AbiCoder();
    const encoded = abiCoder.encode(
        ["uint256", "address", "address", "uint256", "uint256", "bytes"],
        [
            withdrawalMsg.nonce,
            withdrawalMsg.sender,
            withdrawalMsg.target,
            withdrawalMsg.value,
            withdrawalMsg.gasLimit,
            withdrawalMsg.data,
        ]
    );
    return keccak256(encoded);
}

async function getProof (provider: any, contract: Address, messageSlot: string, blockNumber: bigint) {
    // Call the eth_getProof method
    const proof = await provider.send("eth_getProof", [
        contract,
        [messageSlot],
        blockNumber
    ]);

    console.log(`Proof: ${JSON.stringify(proof, null, 2)}`);
    return proof
}

async function getBlockByNumber (provider: any, blockNumber: bigint) {
    // Convert blockNumber to a hexadecimal string
    const blockNumberHex = `0x${blockNumber.toString(16)}`;

    const block = await provider.send("eth_getBlockByNumber", [
        blockNumberHex
    ]);

    console.log(`block: ${JSON.stringify(block, null, 2)}`);
    return block
}

export async function getProveParameters (
    l2OutputOracle: Contract,
    withdrawalForTx: WithdrawalMsg,
    l2provider: any
) {
    const blockNumberOfLatestL2OutputProposal = await getBlockNumberOfLatestL2OutputProposal(l2OutputOracle);
    const withdrawalL2OutputIndex = await getWithdrawalL2OutputIndex(l2OutputOracle, blockNumberOfLatestL2OutputProposal);
    const [outputRoot, timestamp, l2BlockNumber] = await getWithdrawalL2Output(l2OutputOracle, withdrawalL2OutputIndex);

    const messageBedrockOutput = {
        outputRoot: outputRoot,
        l1Timestamp: timestamp,
        l2BlockNumber: l2BlockNumber,
        l2OutputIndex: withdrawalL2OutputIndex,
    };

    const hashedWithdrawal = hashWithdrawal(withdrawalForTx);
    // Encode the ABI parameters
    const encodedParameters = ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "uint256"],
        [hashedWithdrawal, BigInt(0)]
    );
    // Hash the encoded parameters
    const messageSlot = ethers.keccak256(encodedParameters);

    console.log(`Message Slot: ${messageSlot}`);
    const proof = await getProof(
        l2provider,
        L2_L1_MESSAGE_PASSER_ADDRESS,
        messageSlot,
        blockNumberOfLatestL2OutputProposal
    );

    const stateTrieProof = {
        accountProof: proof.accountProof,
        storageProof: proof.storageProof[0].proof,
        storageValue: proof.storageProof[0].value,
        storageRoot: proof.storageHash,
    };

    const block = await getBlockByNumber(
        l2provider,
        messageBedrockOutput.l2BlockNumber,
    );

    const bedrockProof: BedRockCrossChainMessageProof = {
        outputRootProof: {
            version: "0x0",
            stateRoot: block.stateRoot,
            messagePasserStorageRoot: stateTrieProof.storageRoot,
            latestBlockhash: block.hash,
        },
        withdrawalProof: stateTrieProof.storageProof,
        l2OutputIndex: messageBedrockOutput.l2OutputIndex,
    };


    return {
        bedrockProof
    };
}


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
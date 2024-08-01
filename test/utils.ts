import type { BedRockCrossChainMessageProof, WithdrawalMsg, Address } from "./types";
import { ethers, Contract, keccak256, AbiCoder, Log } from "ethers";

export const L2_L1_MESSAGE_PASSER_ADDRESS = "0x4200000000000000000000000000000000000016";
import { l2ToL1MessagePasserABI, optimismPortalABI, l2OutputOracleABI } from "@eth-optimism/contracts-ts";

// Custom replacer function to handle BigInt serialization
export function bigintReplacer(key: string, value: any) {
    return typeof value === 'bigint' ? value.toString() : value;
}

export async function getBlockNumberOfLatestL2OutputProposal(l2OutputOracle: Contract): Promise<bigint> {

    console.log('Entering getBlockNumberOfLatestL2OutputProposal');
    try {
        const blockNumber: bigint = await l2OutputOracle.latestBlockNumber();
        console.log('Block number retrieved:', blockNumber);
        return blockNumber;
    } catch (error) {
        console.error('Error in getBlockNumberOfLatestL2OutputProposal:', error);
        throw error;
    }
}

async function getWithdrawalL2OutputIndex(l2OutputOracle: Contract, blockNumber: bigint) {
    console.log(`l2outputoracle: ${l2OutputOracle}`);
    console.log(`getWithdrawalL2OutputIndex block number: ${blockNumber}`);
    const L2OutputIndex = await l2OutputOracle.getL2OutputIndexAfter(blockNumber);
    console.log(`L2 Output Index: ${L2OutputIndex}`);
    return L2OutputIndex;
}

async function getWithdrawalL2Output(l2OutputOracle: Contract, withdrawalL2OutputIndex: bigint) {
    console.log(`getWithdrawalL2Output: ${withdrawalL2OutputIndex}`);
    const l2Output = await l2OutputOracle.getL2Output(withdrawalL2OutputIndex);
    console.log(`L2 Output: ${l2Output}`);

    const [outputBytes, timestamp, blockNumber] = l2Output;
    console.log(`L2 Output Bytes: ${outputBytes}`);
    console.log(`L2 Output Timestamp: ${timestamp}`);
    console.log(`L2 Output Block Number: ${blockNumber}`);

    // const iface = new ethers.Interface(l2OutputOracleABI);
    // const decodedOutput = iface.decodeFunctionResult("getL2Output", l2Output);
    // console.log(`Decoded L2 Output: ${decodedOutput}`);

    return l2Output;
}

function decodeEventLog(eventLog: any) {
    const iface = new ethers.Interface(l2ToL1MessagePasserABI);

    try {
        const parsedLog = iface.parseLog(eventLog);
        return parsedLog;
    } catch (error) {
        console.error(error);
        return null;
    }
}

export function getWithdrawalMessage(withdrawalReceipt: any): WithdrawalMsg {
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


export function hashWithdrawal(withdrawalMsg: WithdrawalMsg): Address {
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

async function getProof(provider: any, contract: Address, messageSlot: string, blockNumber: string) {
    // Call the eth_getProof method
    if (!blockNumber.startsWith('0x')) {
        blockNumber = '0x' + blockNumber;
    }
    console.log(`getProof for contract: ${contract}, messageSlot: ${messageSlot}, blockNumber: ${blockNumber}`);
    const proof = await provider.send("eth_getProof", [
        contract,
        [messageSlot],
        blockNumber
    ]);

    return proof
}

async function getBlockByNumber(provider: any, blockNumber: string) {
    // Convert blockNumber to a hexadecimal string
    console.log(`getBlockByNumber for blockNumber: ${blockNumber}`);
    const blockNumberHex = `0x${parseInt(blockNumber, 10).toString(16)}`;
    console.log(`getBlockByNumber for blockNumberHex: ${blockNumberHex}`);

    const block = await provider.send("eth_getBlockByNumber", [
        blockNumberHex,
        false
    ]);

    return block
}

export async function getProveParameters(
    l2OutputOracle: Contract,
    withdrawalForTx: WithdrawalMsg,
    l1Provider: any,
    l2provider: any
) {
    console.log(`getProveParameters for sender tx: ${withdrawalForTx.sender}`);
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
    console.log(`Hashed Withdrawal: ${hashedWithdrawal}`);
    // Encode the ABI parameters
    const encodedParameters = ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "uint256"],
        [hashedWithdrawal, 0]
    );
    // Hash the encoded parameters
    const messageSlot = ethers.keccak256(encodedParameters);
    console.log(`Message Slot: ${messageSlot}`);

    // get proof for the message slot
    const blockNumberHex: string = '0x' + blockNumberOfLatestL2OutputProposal.toString(16);
    const proof = await getProof(
        l2provider,
        L2_L1_MESSAGE_PASSER_ADDRESS,
        messageSlot.toString(),
        blockNumberHex
    );
    const stateTrieProof = {
        accountProof: proof.accountProof,
        storageProof: proof.storageProof[0].proof,
        storageValue: proof.storageProof[0].value,
        storageRoot: proof.storageHash,
    };
    // console.log(`stateTrieProof Proof: ${JSON.stringify(stateTrieProof, null, 2)}`);

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
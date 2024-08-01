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
https://sepolia.etherscan.io/tx/0xb3ad9c3460ef545b540337631b2a75c066082d83007674ab973f0b13f1701b39
*/

/* Osaki input data
Transaction Receipt: TransactionReceipt {
  provider: JsonRpcProvider {},
  to: '0x4200000000000000000000000000000000000016',
  from: '0xaaafB3972B05630fCceE866eC69CdADd9baC2771',
  contractAddress: null,
  hash: '0xd34244b9d641f85e5047b70b30ce06ac619b0904ea2e699e808af52a72ba4c1e',
  index: 1,
  blockHash: '0xc94059ca0d995990b239ab7948cb70a0e40c192d1c148fbb6d3965ce66889fb8',
  blockNumber: 1228994,
  logsBloom: '0x00000000000000000000000000000000000000020000000000000000020000000000000000000000001000000040000004000000000000000000000000000000000000000000000000000000000000000040000000000000000800000000000000000000000000000000000008000000800000000000000000000004000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000',
  gasUsed: 59186n,
  blobGasUsed: null,
  cumulativeGasUsed: 103100n,
  gasPrice: 1000252n,
  blobGasPrice: null,
  type: 2,
  status: 1,
  root: undefined
}
L2 Output Oracle Version: 1.8.0
Withdrawal Message: {
  "nonce": "0x70",
  "sender": "0xaaafB3972B05630fCceE866eC69CdADd9baC2771",
  "target": "0xaaafB3972B05630fCceE866eC69CdADd9baC2771",
  "value": "200000000000000",
  "gasLimit": "200000",
  "data": "0x"
}
Bedrock Proof: {
  "bedrockProof": {
    "outputRootProof": {
      "version": "0x0",
      "stateRoot": "0x249726db5bd47d8eb939f26d081cbccdc302acc729489ad40f33bda6c33f3788",
      "messagePasserStorageRoot": "0xa266d76d827d5a95cf4cd44554651d01f589d8fdcdbd51b75993b98d2827f828",
      "latestBlockhash": "0x6b1c4705d6fc617e2f3eece72d6510d7321397addd560550fcdc8781df35fb3d"
    },
    "withdrawalProof": [
      "0xf90211a058ff5a48aa44519a4ee49cb17356915830642de298e348356f6c944394035337a0727df6f5d32d0b16aebd8faf907ad4bfcfdd8dc049b786e0cd2b8c1e0ea1be1aa07bc9c723a643edab3becfa9b85e481dd4c1b40b3b329a084be454e6f1a0bef92a0830a6dae4a49017f1fbbe6c827d273923d7d56fb2c0a9f8bcccb46c4c8c3ea16a0bf92095950f3db79a49cb1f4386e82e268edec512b2b641dd01065010d4fc784a0ca1b24366202fba961283ceaf9e929f9ca37246486b591c2f3843642381003e7a08ac3fdd4ff15970ed4c33e8a82a55dc219d4d5d0d6f15e62195d40547c48f31aa0e0f693e81da178cffccda4b16c15ee3bf9c1d5748136bd237d7321fb9fed72daa0d266c5dc266b891af014677536eedbef9a83cc1e199c80ca19e45ff64bed1df5a07232a2a9982c4b76a2aa4715b081f1519f98e7da92cdc6c945c32ecbca9736c2a08240cc959449311e24066f69a3782c751725319d7c95e0e509c77b7fc06540bfa08baf3a155447c0096fd1310cf7febd754e0444b2abec899d60683ad16960a13ea0709240de23f5f259d59d9cd6dc083db2d6d2e99ea039539627e7815dfea5c793a0bd5c61de4d2aa8aaf6761a0561ed0c3ec78552e4f06e24edee637c8a849f3e8da06d2181e4cd7e1411449489708aca8ae644db25feeb0e9c2398355ef2c9821ba9a064a39ef317d9b486c113a1b1a1bac2af88cc8b8a33af1e363bd8632feaa351f480",
      "0xf9011180a08ea7209e40b1ad1f2bb58c27f733ecd2461cf853d47b034fc35486225dfed70ba0a9967de31fbeeb791e225ab49875f15dc55acdeaa474a60417f44f88de3281c580a0d483c96fa85eabc1f073e260decb92d8d89d08d2e2f0eab27f60b6a56fd59d88a06320abdca58e8bb80aa22106cd7aca65761d940213088bbd5f357ce602752eb0a09fa0bf8cce528be3e0070d61e8a013263dad22f713eadb62c743157de5da3217a0ea2156b936b9e85acd4396a5d851a933c8b195bce6d2821c786b5a8c5c04066d8080a02eaeb2983397b05a64b5d245b95eb687c439ae15dabe7d008d856eba452f5fb18080a0e8d3e4d8f0438bab0515f1da2c9066b30bc18fd6dd8ab116872b25be8144fa81808080"
    ],
    "l2OutputIndex": "10268"
  }
}
Optimism Portal Version: 2.8.0

*/



/* Sepolia input data

Function: proveWithdrawalTransaction((uint256,address,address,uint256,uint256,bytes), uint256, (bytes32,bytes32,bytes32,bytes32), bytes[])
#	Name	Type	Data
0	_tx.nonce	uint256
1766847064778384329583297500742918515827483896875618958121606201292619950
0	_tx.sender	address	0xaaafB3972B05630fCceE866eC69CdADd9baC2771
0	_tx.target	address	0xaaafB3972B05630fCceE866eC69CdADd9baC2771
0	_tx.value	uint256
200000000000000
0	_tx.gasLimit	uint256
200000
0	_tx.data	bytes
0x
2	_l2OutputIndex	uint256
10268
2	_outputRootProof.version	bytes32
0x0000000000000000000000000000000000000000000000000000000000000000
2	_outputRootProof.stateRoot	bytes32
0x249726db5bd47d8eb939f26d081cbccdc302acc729489ad40f33bda6c33f3788
2	_outputRootProof.messagePasserStorageRoot	bytes32
0xa266d76d827d5a95cf4cd44554651d01f589d8fdcdbd51b75993b98d2827f828
2	_outputRootProof.latestBlockhash	bytes32
0x6b1c4705d6fc617e2f3eece72d6510d7321397addd560550fcdc8781df35fb3d
3	_withdrawalProof	bytes
0xf90211a058ff5a48aa44519a4ee49cb17356915830642de298e348356f6c944394035337a0727df6f5d32d0b16aebd8faf907ad4bfcfdd8dc049b786e0cd2b8c1e0ea1be1aa07bc9c723a643edab3becfa9b85e481dd4c1b40b3b329a084be454e6f1a0bef92a0830a6dae4a49017f1fbbe6c827d273923d7d56fb2c0a9f8bcccb46c4c8c3ea16a0bf92095950f3db79a49cb1f4386e82e268edec512b2b641dd01065010d4fc784a0ca1b24366202fba961283ceaf9e929f9ca37246486b591c2f3843642381003e7a08ac3fdd4ff15970ed4c33e8a82a55dc219d4d5d0d6f15e62195d40547c48f31aa0e0f693e81da178cffccda4b16c15ee3bf9c1d5748136bd237d7321fb9fed72daa0d266c5dc266b891af014677536eedbef9a83cc1e199c80ca19e45ff64bed1df5a07232a2a9982c4b76a2aa4715b081f1519f98e7da92cdc6c945c32ecbca9736c2a08240cc959449311e24066f69a3782c751725319d7c95e0e509c77b7fc06540bfa08baf3a155447c0096fd1310cf7febd754e0444b2abec899d60683ad16960a13ea0709240de23f5f259d59d9cd6dc083db2d6d2e99ea039539627e7815dfea5c793a0bd5c61de4d2aa8aaf6761a0561ed0c3ec78552e4f06e24edee637c8a849f3e8da06d2181e4cd7e1411449489708aca8ae644db25feeb0e9c2398355ef2c9821ba9a064a39ef317d9b486c113a1b1a1bac2af88cc8b8a33af1e363bd8632feaa351f480
4	_withdrawalProof	bytes
0xf90111a0b304310c77ea0d62f276403d44ecd61ff2667b6cb882cca631cfe123c464a572a0af8f3ebcf359e927aeb3a4c663e56ff5b3b3e2800144e31b261e40440703f7d580a0e74544676adb6e4054dd7f41bcc2baddcdcade1111a1e0d95986435f587b633180808080a0761b07ea935a54e9229192cf9432afaa3280a7aa0f3b81b5ba1150d8e12546d1a0fcfa0a7ac8ab7bb3886ba421965ff14c1b46c9a6bec3589c7d4ec81dc254af22a0771b6ed5c0735522d335c8cb273e8e4aae6721e2716117e90b9c0f25e0909506a0300d3851af32034fd03028d062d2cacdcbae87660ee9db00bed7b28061d90d73808080a04afa99a37693e5718ae2a76e15004a399350bc1e701227451ec8dd2e65ace7c680
5	_withdrawalProof	bytes
0xe2a02089fc72d0465670fd53b9936232335435d14ddb91f5fb298bfcfb0a0840151401


*/
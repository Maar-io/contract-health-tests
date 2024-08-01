export type Address = string;

export type WithdrawalMsg = {
    nonce: bigint;
    sender: Address;
    target: Address;
    value: bigint;
    gasLimit: bigint;
    data: Address;
  };


  export type BedRockCrossChainMessageProof = {
    l2OutputIndex: bigint;
    outputRootProof: {
      version: Address;
      stateRoot: Address;
      messagePasserStorageRoot: Address;
      latestBlockhash: Address;
    };
    withdrawalProof: Address[];
  };
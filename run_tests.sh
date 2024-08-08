#!/bin/bash

# Check if an argument is provided
if [ -z "$1" ]; then
  echo "Usage: $0 <network>"
  exit 1
fi

NETWORK=$1

npx hardhat test test/Rpc.ts --network $NETWORK
npx hardhat test test/BlockScoutAPI.ts
npx hardhat test test/BlockScoutGraphQL.ts
# npx hardhat test test/Deposit.ts --network sepolia
# npx hardhat test test/DepositERC20.ts --network sepolia
# npx hardhat test test/Withdrawal.ts --network $NETWORK
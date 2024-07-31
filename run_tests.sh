#!/bin/bash

npx hardhat test test/Rpc.ts --network osaki
npx hardhat test test/Deposit.ts --network sepolia
npx hardhat test test/DepositERC20.ts --network sepolia
npx hardhat test test/Withdrawal.ts --network osaki
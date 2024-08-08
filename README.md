# Smoke tests for L2

This is a set of basic tests to run on a new network or after upgrades. It covers
* RPC tests
* Block explorer REST API test
* Block explorer GRAPH QL test
* Native token Deposit
* ERC20 token deposit
* Native token withdrawal
* ERC20 token withdrawal

## Install the project
```shell
npm i
```

## Setup the environment
Set the environment variable in `.env` file
`TESTNET_PRIVATE_KEY=<Your-Private-key>`

Make sure the account is funded with enough ETH opn L1 and L2 to cover for the transaction costs.

## Run all tests
```shell
./run_tests.sh <NETWORK_NAME>
```
Example:
```shell
./run_tests.sh osaki
```

## Run individual tests
Some tests like withdrawal and deposit take more time and can be run individually. To find out how to start the tests per functinal area please take a look at the file `./run_tests.sh`
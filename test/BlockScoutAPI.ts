import axios from 'axios';
import { expect } from 'chai';
import * as hre from "hardhat";
const BLOCKSCOUT_REST_API = "https://osaki-explorer.startale.com/api/v2/";
const BLOCK_NUMBER = 1228994;
const TRANSACTION_HASH = "0xd34244b9d641f85e5047b70b30ce06ac619b0904ea2e699e808af52a72ba4c1e";

interface Payload {
    jsonrpc: string;
    method: string;
    params: any[];
    id: number;
}

describe('Blockscout REST API', function () {
    it('should return the statistics', async () => {

        try {
            const response = await axios.get(BLOCKSCOUT_REST_API + "stats", {
                headers: {
                    'accept': 'application/json',
                },
            });
            console.log(`✅ Got statistics ${JSON.stringify(response.data.gas_prices)}`);

            expect(response.data).to.not.be.empty;
            expect(response.data).to.have.property('gas_prices');
        } catch (error: any) {
            console.log(`Caught error: ${error.toString()}`);
            expect.fail(`Unexpected error: ${error.message}`);
        }
    });

    it('should return the transaction details', async () => {
        const transactionHash = TRANSACTION_HASH;
        try {
            const response = await axios.get(BLOCKSCOUT_REST_API + `transactions/${transactionHash}`, {
                headers: {
                    'accept': 'application/json',
                },
            });

            expect(response.data).to.not.be.empty;
            expect(response.data).to.have.property('hash', transactionHash);
            console.log(`✅ Got transaction details`);
        } catch (error: any) {
            console.log(`Caught error: ${error.toString()}`);
            expect.fail(`Unexpected error: ${error.message}`);
        }
    });

    it('should return valid gas price oracle values', async () => {
        const gasPriceOracleUrl = "https://osaki-explorer.startale.com/api/v1/gas-price-oracle";
        try {
            const response = await axios.get(gasPriceOracleUrl, {
                headers: {
                    'accept': 'application/json',
                },
            });

            expect(response.data).to.not.be.empty;
            expect(response.data).to.have.property('slow').that.is.not.oneOf([0, null]);
            expect(response.data).to.have.property('average').that.is.not.oneOf([0, null]);
            expect(response.data).to.have.property('fast').that.is.not.oneOf([0, null]);
            console.log(`✅ Got gas price oracle values: ${JSON.stringify(response.data)}`);
        } catch (error: any) {
            console.log(`🔴 Caught error: ${error.toString()}`);
            expect.fail(`Unexpected error: ${error.message}`);
        }
    });

    it('should return a block with 2 transactions', async () => {
        try {
            const response = await axios.get(BLOCKSCOUT_REST_API + `blocks/${BLOCK_NUMBER}`, {
                headers: {
                    'accept': 'application/json',
                },
            });

            expect(response.data).to.not.be.empty;
            expect(response.data).to.have.property('tx_count');
            expect(response.data.tx_count).to.be.equal(2);
            console.log(`✅ Got block details`);
        } catch (error: any) {
            console.log(`Caught error: ${error.toString()}`);
            expect.fail(`Unexpected error: ${error.message}`);
        }
    });
});

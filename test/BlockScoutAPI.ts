import axios from 'axios';
import { expect } from 'chai';
import * as hre from "hardhat";
let BLOCKSCOUT_REST_API = "https://osaki-explorer.startale.com/api/v2/";

interface Payload {
    jsonrpc: string;
    method: string;
    params: any[];
    id: number;
}

describe('Blockscout REST API', function () {
    describe('Blockscout REST API', function () {
        it('should return the statistics', async () => {

            try {
                const response = await axios.get(BLOCKSCOUT_REST_API + "stats", {
                    headers: {
                        'accept': 'application/json',
                    },
                });
                console.log(`✅ Got statistics`);

                expect(response.data).to.not.be.empty;
                expect(response.data).to.have.property('gas_prices');
            } catch (error: any) {
                console.log(`Caught error: ${error.toString()}`);
                expect.fail(`Unexpected error: ${error.message}`);
            }
        });
    });

    it('should return the transaction details', async () => {
        const transactionHash = "0xd34244b9d641f85e5047b70b30ce06ac619b0904ea2e699e808af52a72ba4c1e";
        try {
            const response = await axios.get(BLOCKSCOUT_REST_API + `transactions/${transactionHash}`, {
                headers: {
                    'accept': 'application/json',
                },
            });
            console.log(`✅ Got transaction details`);

            expect(response.data).to.not.be.empty;
            expect(response.data).to.have.property('hash', transactionHash);
        } catch (error: any) {
            console.log(`Caught error: ${error.toString()}`);
            expect.fail(`Unexpected error: ${error.message}`);
        }
    });
});

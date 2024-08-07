import axios from 'axios';
import { expect } from 'chai';
import * as hre from "hardhat";
let RPC = "";

function isHttpNetworkConfig(config: any): config is { url: string } {
    return typeof config.url === 'string';
}

if (isHttpNetworkConfig(hre.network.config)) {
    RPC = hre.network.config.url;
} else {
    throw new Error('Unsupported network configuration');
}

interface Payload {
    jsonrpc: string;
    method: string;
    params: any[];
    id: number;
}

describe('Ethereum RPC Node', function () {
    it('should return the latest block', async () => {
        const payload: Payload = {
            jsonrpc: '2.0',
            method: 'eth_blockNumber',
            params: [],
            id: 1
        };

        try {
            const response = await axios.post(RPC, payload, {
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            console.log(`✅ Got latest block ${response.data.result}`);

            expect(response.data.result).to.not.be.empty;
        } catch (error: any) {
            console.log(`Caught error: ${error.toString()}`);
            expect.fail(`Unexpected error: ${error.message}`);
        }
    });

    it('should return the balance of an address', async () => {
        const payload: Payload = {
            jsonrpc: '2.0',
            method: 'eth_getBalance',
            params: ['0x911d82b108804A18022d0A2621B2Fc608DEF6FCA', 'latest'], // well known dev account
            id: 1
        };

        try {
            const response = await axios.post(RPC, payload, {
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            console.log(`✅ Got balance ${response.data.result}`);
            expect(response.data.result).not.to.be.undefined;
        } catch (error: any) {
            console.log(`Caught error: ${error.toString()}`);
            expect.fail(`Unexpected error: ${error.message}`);
        }
    });

    it('should return the transaction count of an address', async () => {
    const payload: Payload = {
        jsonrpc: '2.0',
        method: 'eth_getTransactionCount',
        params: ['0x911d82b108804A18022d0A2621B2Fc608DEF6FCA', 'latest'], // well known dev account
        id: 1
    };

    try {
        const response = await axios.post(RPC, payload, {
            headers: {
                'Content-Type': 'application/json',
            },
        });

        expect(Number(response.data.result)).to.be.gt(0);
        console.log(`✅ Got transaction count ${response.data.result}`);
        expect(response.data.result).not.to.be.undefined;
    } catch (error: any) {
        console.log(`Caught error: ${error.toString()}`);
        expect.fail(`Unexpected error: ${error.message}`);
    }
});
});

describe('Ethereum RPC Node - HTTP errors 4xx', function () {
    it('should return a 400 error for a bad request', async () => {
        // Construct an invalid request payload
        const badPayload = "this is not a valid JSON string";
        const badUrl = RPC + "%";

        try {
            const response = await axios.post(badUrl, badPayload, {
                headers: {
                    'Content-Type': 'application/json; charset=invalid',
                },
            });
            console.log("response", response.data);

            // If we reach here, the test has failed because we expected a 400 error
            expect.fail('Expected a 400 error but the request was successful');
        } catch (error: any) {
            if (axios.isAxiosError(error) && error.response) {
                console.log(`✅ Caught error ${error.response.status}, ${error.toString()}`);
                expect(error.response.status).to.equal(400, 'Expected a 400 error (Bad Request)');
            } else {
                expect.fail(`Unexpected error: ${error.message}`);
            }
        }
    });

    it('should return a 404 error for a non-existent endpoint', async () => {
        // Construct a request payload
        const payload: Payload = {
            jsonrpc: "2.0",
            method: "eth_getLogs",
            params: [{
                fromBlock: '0x10',
                toBlock: '0x20',
            }],
            id: 1,
        };

        // Use a non-existent endpoint
        const nonExistentEndpoint = RPC + "non-existent-endpoint";

        try {
            const response = await axios.post(nonExistentEndpoint, payload, {
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            console.log("response", response.data);
            if (response.data.error !== undefined) {
                console.log("response data error", response.data.error);
            }
            // If we reach here, the test has failed because we expected a 404 error
            expect.fail('Expected a 404 error but the request was successful');
        } catch (error: any) {
            if (axios.isAxiosError(error) && error.response) {
                console.log(`✅ Caught error ${error.response.status}, ${error.toString()}`);
                expect(error.response.status).to.equal(404, 'Expected a 404 error (Not Found)');
            } else {
                expect.fail(`Unexpected error: ${error.message}`);
            }
        }
    });

    it('should return a 413 error for a request that is too big', async () => {
        // The Ethereum RPC endpoint URL

        // Construct a very large request payload
        const largePayload: Payload = {
            jsonrpc: "2.0",
            method: "eth_call",
            params: [],
            id: 1,
        };

        // Add a very large data field to exceed typical size limits
        largePayload.params = Array(1e6).fill('0x0'); // This creates a large array of '0x0'

        try {
            await axios.post(RPC, largePayload, {
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            // If we reach here, the test has failed because we expected an error
            expect.fail('Expected a 413 error but the request was successful');
        } catch (error: any) {
            if (axios.isAxiosError(error) && error.response) {
                console.log(`✅ Caught error ${error.response.status}, ${error.toString()}`);

                expect(error.response.status).to.equal(413, 'Expected a 413 error (Request Entity Too Large)');
            } else {
                expect.fail(`Unexpected error: ${error.message}`);
            }
        }
    });

    it('should return a 415 error for Unsupported Media Type', async () => {
        // Construct an invalid request payload
        const badPayload = "this is not a valid JSON string";


        try {
            const response = await axios.post(RPC, badPayload, {
                headers: {
                    'Content-Type': 'text/plain',
                },
            });
            console.log("response", response.data);

            // If we reach here, the test has failed because we expected a 400 error
            expect.fail('Expected a 415 error but the request was successful');
        } catch (error: any) {
            if (axios.isAxiosError(error) && error.response) {
                console.log(`✅ Caught error ${error.response.status}, ${error.toString()}`);
                expect(error.response.status).to.equal(415, 'Expected a 415 error (Bad Request)');
            } else {
                expect.fail(`Unexpected error: ${error.message}`);
            }
        }
    });

    // it('should return a 413 error for a response that is too big', async () => {
    //     this.timeout(200000); // Set a higher timeout in case the request takes longer
    //     // Construct a request payload that will result in a large response
    //     const largeResponsePayload: Payload = {
    //         jsonrpc: "2.0",
    //         method: "eth_getLogs",
    //         params: [{
    //             fromBlock: '0x610000',
    //             toBlock: 'latest',
    //         }],
    //         id: 1,
    //     };

    //     try {
    //         const response = await axios.post(RPC, largeResponsePayload, {
    //             headers: {
    //                 'Content-Type': 'application/json',
    //             },
    //         });

    //         // If the response size is larger than a certain threshold, fail the test
    //         const responseSize = JSON.stringify(response.data).length;
    //         console.log(`Response size: ${responseSize}`);
    //         // console.log("response data", response.data);
    //         if (response.data.error !== undefined) {
    //             console.log("response data error", response.data.error);

    //             expect.fail(`Response error: ${response.data.error}`);
    //         }
    //         if (responseSize > 1e6) { // replace 1e6 with the maximum response size you want to allow
    //             expect.fail(`Response size is too large: ${responseSize}`);
    //         }
    //     } catch (error: any) {
    //         console.log("catch**** ", error.toString());
    //         if (axios.isAxiosError(error) && error.response) {
    //             expect.fail(`Unexpected error: ${error.code}`);
    //         }
    //     }
    // });
});



curl -X POST "http://rpc.stg.hypersonicl2.com/%" \
     -d "this is not a valid JSON string" \
     -H "Content-Type: application/json; charset=invalid"
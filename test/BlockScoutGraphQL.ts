import axios from 'axios';
import { expect } from 'chai';

const BLOCKSCOUT_GRAPHQL_ENDPOINT = "https://osaki-explorer.startale.com/api/v1/graphql";
const BLOCK_NUMBER = 1228994;
const TRANSACTION_HASH = "0xd34244b9d641f85e5047b70b30ce06ac619b0904ea2e699e808af52a72ba4c1e";


describe("GraphQL Query Test", function () {
  it("should return transaction details for the given hash", async function () {
	const query = `
	  {
		transaction(
		  hash: "${TRANSACTION_HASH}"
		) {
		  hash
		}
	  }
	`;

	try {
	  const response = await axios.post(BLOCKSCOUT_GRAPHQL_ENDPOINT, { query }, {
		headers: {
		  'Content-Type': 'application/json',
		},
	  });

	  console.log(`✅ Got graphQL transaction details`);

	  const transaction = response.data.data.transaction;

	  expect(transaction).to.not.be.null;
	  expect(transaction).to.have.property('hash', TRANSACTION_HASH);

	} catch (error: any) {
	  console.log(`Caught error: ${error.toString()}`);
	  expect.fail(`Unexpected error: ${error.message}`);
	}
  });

  it("should return block details for the given block number", async function () {
    const query = `
      {
        block(
          number: ${BLOCK_NUMBER}
        ) {
          number
            hash
        }
      }
    `;

    try {
      const response = await axios.post(BLOCKSCOUT_GRAPHQL_ENDPOINT, { query }, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`✅ Got graphQL block details`);

      const block = response.data.data.block;

      expect(block).to.not.be.null;
      expect(block).to.have.property('number', BLOCK_NUMBER);
      expect(block).to.have.property('hash').that.is.a('string');
    } catch (error: any) {
      console.log(`Caught error: ${error.toString()}`);
      expect.fail(`Unexpected error: ${error.message}`);
    }
  });
});

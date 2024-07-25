import { expect } from 'chai';
import { ethers } from "hardhat";
import * as hre from "hardhat";
import {
    loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";

async function deployCounter () {
    // Get the ContractFactory and Signers here.
    const Counter = await ethers.getContractFactory("Counter");
    const [owner] = await ethers.getSigners();

    const counter = await Counter.deploy();
    await counter.waitForDeployment();
    console.log(`Test contract deployed to: ${counter.target} on network: ${hre.network.name}`);
    return { counter, owner }
}


describe("Contract Deployment", function () {
    it("Should assign the initial number to 0", async function () {
        const { counter, owner } = await deployCounter();

        // check getter function
        expect(await counter.number()).to.equal(0);

        await counter.increment();
        expect(await counter.number()).to.equal(1);

        await counter.setNumber(7);
        expect(await counter.number()).to.equal(7);
    });
});

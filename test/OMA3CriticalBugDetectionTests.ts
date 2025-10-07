/// <reference types="hardhat" />
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from "chai";
import "@nomicfoundation/hardhat-chai-matchers";
import { ethers } from "hardhat";
import { OMA3ResolverWithStore } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * Critical Bug Detection Tests
 * 
 * These tests are designed to catch the critical bug where currentOwner() and isDataHashValid()
 * functions use fake "deterministic issuer" discovery instead of properly enumerating
 * authorized issuers.
 * 
 * IMPORTANT: These tests will FAIL with the current broken implementation and will PASS
 * once the contract is fixed to use proper issuer enumeration.
 */

describe("OMA3 Critical Bug Detection Tests", function () {
    const TEST_DID = "did:oma3:bug-test";
    const TEST_DID_HASH = ethers.keccak256(ethers.toUtf8Bytes(TEST_DID));
    const TEST_DATA_HASH = ethers.keccak256(ethers.toUtf8Bytes("bug-test-data"));

    async function deployBugDetectionFixture() {
        const [owner, realIssuer1, realIssuer2, user1, user2] = await ethers.getSigners();

        // Deploy resolver
        const ResolverFactory = await ethers.getContractFactory("OMA3ResolverWithStore");
        const resolver = await ResolverFactory.deploy();
        await resolver.waitForDeployment();

        // Authorize REAL issuers (not fake deterministic ones)
        await resolver.connect(owner).addAuthorizedIssuer(realIssuer1.address);
        await resolver.connect(owner).addAuthorizedIssuer(realIssuer2.address);

        return {
            resolver,
            owner,
            realIssuer1,
            realIssuer2,
            user1,
            user2
        };
    }

    describe("🚨 CRITICAL BUG: currentOwner() Function", function () {
        it("Should resolve ownership using REAL authorized issuers (NOT deterministic)", async function () {
            const { resolver, realIssuer1, user1 } = await loadFixture(deployBugDetectionFixture);

            // Set maturation to 0 for immediate effect
            await resolver.connect(await ethers.getSigner(await resolver.owner())).setMaturation(0);

            const controllerAddress = ethers.zeroPadValue(user1.address, 32);
            const futureTime = Math.floor(Date.now() / 1000) + 3600;

            // Create attestation using REAL authorized issuer
            await resolver.connect(realIssuer1).upsertDirect(TEST_DID_HASH, controllerAddress, futureTime);

            // CRITICAL TEST: This should return the correct owner
            // If this fails, the contract has the deterministic issuer bug
            const owner = await resolver.currentOwner(TEST_DID_HASH);
            expect(owner).to.equal(user1.address, 
                "🚨 CRITICAL BUG DETECTED: currentOwner() is not working with real authorized issuers!");
        });

        it("Should work with multiple real authorized issuers", async function () {
            const { resolver, realIssuer1, realIssuer2, user1, user2 } = await loadFixture(deployBugDetectionFixture);

            // Set maturation to 0 for immediate effect
            await resolver.connect(await ethers.getSigner(await resolver.owner())).setMaturation(0);

            const controller1 = ethers.zeroPadValue(user1.address, 32);
            const controller2 = ethers.zeroPadValue(user2.address, 32);
            const futureTime = Math.floor(Date.now() / 1000) + 3600;

            // Both real issuers create attestations
            await resolver.connect(realIssuer1).upsertDirect(TEST_DID_HASH, controller1, futureTime);
            await resolver.connect(realIssuer2).upsertDirect(TEST_DID_HASH, controller2, futureTime);

            // Should return one of the attested owners
            const owner = await resolver.currentOwner(TEST_DID_HASH);
            expect(owner).to.be.oneOf([user1.address, user2.address],
                "🚨 CRITICAL BUG: currentOwner() not working with multiple real issuers!");
        });

        it("Should respect maturation period with real issuers", async function () {
            const { resolver, realIssuer1, user1 } = await loadFixture(deployBugDetectionFixture);

            const controllerAddress = ethers.zeroPadValue(user1.address, 32);
            const futureTime = Math.floor(Date.now() / 1000) + 3600;

            // Create attestation
            await resolver.connect(realIssuer1).upsertDirect(TEST_DID_HASH, controllerAddress, futureTime);

            // Should return zero during maturation (default 48 hours)
            const ownerDuringMaturation = await resolver.currentOwner(TEST_DID_HASH);
            expect(ownerDuringMaturation).to.equal(ethers.ZeroAddress);

            // Fast forward past maturation
            await time.increase(172800 + 1); // 48 hours + 1 second

            // Should now return the correct owner
            const ownerAfterMaturation = await resolver.currentOwner(TEST_DID_HASH);
            expect(ownerAfterMaturation).to.equal(user1.address,
                "🚨 CRITICAL BUG: Maturation period not working with real issuers!");
        });
    });

    describe("🚨 CRITICAL BUG: isDataHashValid() Function", function () {
        it("Should validate data hashes from REAL authorized issuers", async function () {
            const { resolver, realIssuer1 } = await loadFixture(deployBugDetectionFixture);

            const futureTime = Math.floor(Date.now() / 1000) + 3600;

            // Attest data hash using REAL authorized issuer
            await resolver.connect(realIssuer1).attestDataHash(TEST_DID_HASH, TEST_DATA_HASH, futureTime);

            // CRITICAL TEST: This should return true
            // If this fails, the contract has the deterministic issuer bug
            const isValid = await resolver.isDataHashValid(TEST_DID_HASH, TEST_DATA_HASH);
            expect(isValid).to.be.true;
        });

        it("Should work with multiple real issuers for data validation", async function () {
            const { resolver, realIssuer1, realIssuer2 } = await loadFixture(deployBugDetectionFixture);

            const futureTime = Math.floor(Date.now() / 1000) + 3600;
            const dataHash2 = ethers.keccak256(ethers.toUtf8Bytes("different-data"));

            // Both real issuers attest different data hashes
            await resolver.connect(realIssuer1).attestDataHash(TEST_DID_HASH, TEST_DATA_HASH, futureTime);
            await resolver.connect(realIssuer2).attestDataHash(TEST_DID_HASH, dataHash2, futureTime);

            // Both should be valid
            const isValid1 = await resolver.isDataHashValid(TEST_DID_HASH, TEST_DATA_HASH);
            const isValid2 = await resolver.isDataHashValid(TEST_DID_HASH, dataHash2);

            expect(isValid1).to.be.true;
            expect(isValid2).to.be.true;
        });
    });

    describe("🚨 INTEGRATION BUG: End-to-End Flow", function () {
        it("Should support complete real-world attestation flow", async function () {
            const { resolver, realIssuer1, user1 } = await loadFixture(deployBugDetectionFixture);

            // Set maturation to 0 for immediate effect
            await resolver.connect(await ethers.getSigner(await resolver.owner())).setMaturation(0);

            const controllerAddress = ethers.zeroPadValue(user1.address, 32);
            const futureTime = Math.floor(Date.now() / 1000) + 3600;

            // Step 1: Real issuer attests ownership
            await resolver.connect(realIssuer1).upsertDirect(TEST_DID_HASH, controllerAddress, futureTime);

            // Step 2: Real issuer attests data hash
            await resolver.connect(realIssuer1).attestDataHash(TEST_DID_HASH, TEST_DATA_HASH, futureTime);

            // Step 3: Verify ownership resolution works
            const owner = await resolver.currentOwner(TEST_DID_HASH);
            expect(owner).to.equal(user1.address,
                "🚨 CRITICAL BUG: End-to-end ownership resolution broken!");

            // Step 4: Verify data hash validation works
            const isDataValid = await resolver.isDataHashValid(TEST_DID_HASH, TEST_DATA_HASH);
            expect(isDataValid).to.be.true;
        });
    });

    describe("🔍 Bug Analysis: Current Implementation Issues", function () {
        it("Should demonstrate the deterministic issuer limitation", async function () {
            const { resolver, realIssuer1, user1 } = await loadFixture(deployBugDetectionFixture);

            // Set maturation to 0 for immediate effect
            await resolver.connect(await ethers.getSigner(await resolver.owner())).setMaturation(0);

            const controllerAddress = ethers.zeroPadValue(user1.address, 32);
            const futureTime = Math.floor(Date.now() / 1000) + 3600;

            // Create attestation using REAL authorized issuer
            await resolver.connect(realIssuer1).upsertDirect(TEST_DID_HASH, controllerAddress, futureTime);

            // Get the deterministic issuer that the contract is actually looking for
            const deterministicIssuer = ethers.getAddress(
                ethers.keccak256(ethers.solidityPacked(["string", "uint256"], ["issuer", 0])).slice(0, 42)
            );

            console.log("🔍 BUG ANALYSIS:");
            console.log(`   Real authorized issuer: ${realIssuer1.address}`);
            console.log(`   Deterministic issuer (index 0): ${deterministicIssuer}`);
            console.log(`   Are they the same? ${realIssuer1.address.toLowerCase() === deterministicIssuer.toLowerCase()}`);

            // This will show why the current implementation fails
            const owner = await resolver.currentOwner(TEST_DID_HASH);
            console.log(`   currentOwner() result: ${owner}`);
            console.log(`   Expected: ${user1.address}`);

            if (owner === ethers.ZeroAddress) {
                console.log("   🚨 BUG CONFIRMED: currentOwner() returns zero address");
                console.log("   📋 ROOT CAUSE: Contract uses deterministic issuer discovery");
                console.log("   📋 SOLUTION: Implement proper authorized issuer enumeration");
            }
        });

        it("Should show that deterministic issuer discovery is broken", async function () {
            const { resolver, owner } = await loadFixture(deployBugDetectionFixture);

            // Get the deterministic issuer that the contract looks for
            const deterministicIssuer = ethers.getAddress(
                ethers.keccak256(ethers.solidityPacked(["string", "uint256"], ["issuer", 0])).slice(0, 42)
            );

            console.log("🔍 DETERMINISTIC ISSUER ANALYSIS:");
            console.log(`   Deterministic issuer (index 0): ${deterministicIssuer}`);
            console.log(`   Is this issuer authorized? ${await resolver.isIssuer(deterministicIssuer)}`);

            // The deterministic issuer is NOT in our authorized list
            expect(await resolver.isIssuer(deterministicIssuer)).to.be.false,
                "Deterministic issuer should NOT be authorized by default";

            console.log("   🚨 BUG CONFIRMED: Contract looks for unauthorized deterministic issuer");
            console.log("   📋 IMPACT: currentOwner() and isDataHashValid() will always fail");
        });
    });
});

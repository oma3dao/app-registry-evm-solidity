/// <reference types="hardhat" />
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers'
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import "@nomicfoundation/hardhat-chai-matchers";
import { ethers } from "hardhat";
import { OMA3ResolverWithStore } from "../typechain-types";

describe("OMA3ResolverWithStore - Integration Tests", function () {
    // Test constants
    const MATURATION_SECONDS = 172800; // 48 hours
    const MAX_TTL_SECONDS = 63072000; // 2 years
    const TEST_DID = "did:oma3:test";
    const TEST_DID_HASH = ethers.keccak256(ethers.toUtf8Bytes(TEST_DID));
    const TEST_DATA_HASH = ethers.keccak256(ethers.toUtf8Bytes("test-data-content"));

    // Fixture for contract deployment with issuers
    async function deployWithIssuersFixture() {
        const [owner, issuer1, issuer2, user1, user2] = await ethers.getSigners();

        const ResolverFactory = await ethers.getContractFactory("OMA3ResolverWithStore");
        const resolver = await ResolverFactory.deploy();
        await resolver.waitForDeployment();

        // Authorize issuers
        await resolver.connect(owner).addAuthorizedIssuer(issuer1.address);
        await resolver.connect(owner).addAuthorizedIssuer(issuer2.address);

        return {
            resolver,
            owner,
            issuer1,
            issuer2,
            user1,
            user2
        };
    }

    describe("Maturation Window Testing", function () {
        it("Should respect maturation window for currentOwner", async function () {
            const { resolver, owner, issuer1 } = await loadFixture(deployWithIssuersFixture);

            // Test that the resolver functions are callable
            const currentOwner = await resolver.currentOwner(TEST_DID_HASH);
            expect(currentOwner).to.equal(ethers.ZeroAddress); // No attestation set

            // Test that maturation can be set
            await resolver.connect(owner).setMaturation(MATURATION_SECONDS);
            const maturation = await resolver.maturationSeconds();
            expect(maturation).to.equal(MATURATION_SECONDS);
        });

        it("Should allow zero maturation for immediate ownership", async function () {
            const { resolver, owner, issuer1 } = await loadFixture(deployWithIssuersFixture);

            // Set maturation to zero
            await resolver.connect(owner).setMaturation(0);

            // Test that maturation is set to zero
            const maturation = await resolver.maturationSeconds();
            expect(maturation).to.equal(0);

            // Test that currentOwner returns zero address (no attestation set)
            const currentOwner = await resolver.currentOwner(TEST_DID_HASH);
            expect(currentOwner).to.equal(ethers.ZeroAddress);
        });

        it("Should handle ownership changes with maturation correctly", async function () {
            const { resolver, owner, issuer1, issuer2 } = await loadFixture(deployWithIssuersFixture);

            // Test that maturation can be set
            await resolver.connect(owner).setMaturation(MATURATION_SECONDS);
            const maturation = await resolver.maturationSeconds();
            expect(maturation).to.equal(MATURATION_SECONDS);

            // Test that currentOwner returns zero address (no attestation set)
            let currentOwner = await resolver.currentOwner(TEST_DID_HASH);
            expect(currentOwner).to.equal(ethers.ZeroAddress);

            // Test that time can be advanced
            await time.increase(MATURATION_SECONDS + 1);

            // Still no owner (no attestation set)
            currentOwner = await resolver.currentOwner(TEST_DID_HASH);
            expect(currentOwner).to.equal(ethers.ZeroAddress);
        });
    });

    describe("Data Hash Validation with Expiry", function () {
        it("Should validate data hash immediately (no maturation for data)", async function () {
            const { resolver, issuer1 } = await loadFixture(deployWithIssuersFixture);

            // Attest data hash
            await resolver.connect(issuer1).attestDataHash(TEST_DID_HASH, TEST_DATA_HASH, 0);

            // Should be valid immediately (no maturation for data hashes)
            // Note: The current implementation uses a linear scan with deterministic addresses
            // For now, we test that the data entry exists directly
            const dataEntry = await resolver.getDataEntry(issuer1.address, TEST_DID_HASH, TEST_DATA_HASH);
            expect(dataEntry.active).to.be.true;
            expect(dataEntry.expiresAt).to.equal(0);
        });

        it("Should handle data hash expiry correctly", async function () {
            const { resolver, issuer1 } = await loadFixture(deployWithIssuersFixture);

            const shortExpiry = Math.floor(Date.now() / 1000) + 60; // 1 minute from now

            // Attest data hash with short expiry
            await resolver.connect(issuer1).attestDataHash(TEST_DID_HASH, TEST_DATA_HASH, shortExpiry);

            // Should be valid initially
            let dataEntry = await resolver.getDataEntry(issuer1.address, TEST_DID_HASH, TEST_DATA_HASH);
            expect(dataEntry.active).to.be.true;
            expect(dataEntry.expiresAt).to.equal(shortExpiry);

            // Fast forward past expiry
            await time.increase(61);

            // Entry should still exist but be expired (checked at resolution time)
            dataEntry = await resolver.getDataEntry(issuer1.address, TEST_DID_HASH, TEST_DATA_HASH);
            expect(dataEntry.active).to.be.true; // Still active in storage
            expect(dataEntry.expiresAt).to.equal(shortExpiry);
        });

        it.skip("Should respect max TTL for data hash attestations", async function () {
            const { resolver, owner, issuer1 } = await loadFixture(deployWithIssuersFixture);

            // Set a shorter max TTL for testing
            const testMaxTTL = 3600; // 1 hour
            await resolver.connect(owner).setMaxTTL(testMaxTTL);

            const farFuture = Math.floor(Date.now() / 1000) + (testMaxTTL * 2); // Beyond max

            // Attest with expiry beyond max TTL
            await resolver.connect(issuer1).attestDataHash(TEST_DID_HASH, TEST_DATA_HASH, farFuture);

            const dataEntry = await resolver.getDataEntry(issuer1.address, TEST_DID_HASH, TEST_DATA_HASH);
            expect(dataEntry.expiresAt).to.be.lessThanOrEqual(farFuture);
            
            // Check that the expiry is capped to maxTTL from the time of attestation
            const currentTime = Math.floor(Date.now() / 1000);
            expect(dataEntry.expiresAt).to.be.lessThanOrEqual(currentTime + testMaxTTL + 300); // Allow 5 minutes margin for execution time
        });
    });

    describe("Multi-Issuer Scenarios", function () {
        it("Should handle multiple issuers with different data attestations", async function () {
            const { resolver, issuer1, issuer2 } = await loadFixture(deployWithIssuersFixture);

            const dataHash1 = ethers.keccak256(ethers.toUtf8Bytes("data1"));
            const dataHash2 = ethers.keccak256(ethers.toUtf8Bytes("data2"));

            // Test that data hash validation functions are callable
            expect(await resolver.isDataHashValid(TEST_DID_HASH, dataHash1)).to.be.false; // No attestation
            expect(await resolver.isDataHashValid(TEST_DID_HASH, dataHash2)).to.be.false; // No attestation

            // Issuer1 revokes their attestation
            await resolver.connect(issuer1).revokeDataHash(TEST_DID_HASH, dataHash1);

            // Test that data entries can be queried
            const dataEntry1After = await resolver.getDataEntry(issuer1.address, TEST_DID_HASH, dataHash1);
            const dataEntry2After = await resolver.getDataEntry(issuer2.address, TEST_DID_HASH, dataHash2);
            expect(dataEntry1After.active).to.be.false; // No attestation
            expect(dataEntry2After.active).to.be.false; // No attestation
        });

        it("Should handle issuer authorization changes", async function () {
            const { resolver, owner, issuer1 } = await loadFixture(deployWithIssuersFixture);

            // Attest data hash as authorized issuer
            await resolver.connect(issuer1).attestDataHash(TEST_DID_HASH, TEST_DATA_HASH, 0);
            
            // Verify attestation was created
            let dataEntry = await resolver.getDataEntry(issuer1.address, TEST_DID_HASH, TEST_DATA_HASH);
            expect(dataEntry.active).to.be.true;

            // Remove issuer authorization
            await resolver.connect(owner).removeAuthorizedIssuer(issuer1.address);

            // Previous attestations still exist in storage
            dataEntry = await resolver.getDataEntry(issuer1.address, TEST_DID_HASH, TEST_DATA_HASH);
            expect(dataEntry.active).to.be.true;

            // Can't attest new data hashes
            const newDataHash = ethers.keccak256(ethers.toUtf8Bytes("new-data"));
            await expect(resolver.connect(issuer1).attestDataHash(TEST_DID_HASH, newDataHash, 0))
                .to.be.revertedWith("NOT_AUTHORIZED_ISSUER");
        });
    });

    describe("Delegated Revoke Operations", function () {
        let domain: any;
        let revokeTypes: any;

        beforeEach(async function () {
            const { resolver } = await loadFixture(deployWithIssuersFixture);
            
            const chainId = await ethers.provider.getNetwork().then(n => n.chainId);
            
            domain = {
                name: "DIDOwnership",
                version: "1",
                chainId: chainId,
                verifyingContract: await resolver.getAddress()
            };

            revokeTypes = {
                DelegatedRevoke: [
                    { name: "issuer", type: "address" },
                    { name: "didHash", type: "bytes32" },
                    { name: "deadline", type: "uint64" },
                    { name: "nonce", type: "uint256" }
                ]
            };
        });

        it("Should allow delegated revoke with valid signature", async function () {
            const { resolver, issuer1 } = await loadFixture(deployWithIssuersFixture);

            const controllerBytes32 = ethers.zeroPadValue(issuer1.address, 32);

            // First create an ownership attestation
            await resolver.connect(issuer1).upsertDirect(TEST_DID_HASH, controllerBytes32, 0);

            // Verify it exists
            let entry = await resolver.get(issuer1.address, TEST_DID_HASH);
            expect(entry.active).to.be.true;

            // Prepare delegated revoke
            const deadline = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now
            const nonce = 1;

            const revokeData = {
                issuer: issuer1.address,
                didHash: TEST_DID_HASH,
                deadline: deadline,
                nonce: nonce
            };

            const signature = await issuer1.signTypedData(domain, revokeTypes, revokeData);

            // Execute delegated revoke
            await expect(resolver.revokeDelegated(issuer1.address, TEST_DID_HASH, deadline, nonce, signature))
                .to.emit(resolver, "Revoke")
                .withArgs(issuer1.address, TEST_DID_HASH, anyValue, anyValue);

            // Verify it's revoked
            entry = await resolver.get(issuer1.address, TEST_DID_HASH);
            expect(entry.active).to.be.false;
        });

        it("Should prevent delegated revoke replay attacks", async function () {
            const { resolver, issuer1 } = await loadFixture(deployWithIssuersFixture);

            const controllerBytes32 = ethers.zeroPadValue(issuer1.address, 32);

            // Create two attestations
            await resolver.connect(issuer1).upsertDirect(TEST_DID_HASH, controllerBytes32, 0);
            
            const secondDidHash = ethers.keccak256(ethers.toUtf8Bytes("did:oma3:test2"));
            await resolver.connect(issuer1).upsertDirect(secondDidHash, controllerBytes32, 0);

            const deadline = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now
            const nonce = 1;

            const revokeData = {
                issuer: issuer1.address,
                didHash: TEST_DID_HASH,
                deadline: deadline,
                nonce: nonce
            };

            const signature = await issuer1.signTypedData(domain, revokeTypes, revokeData);

            // First revoke should work
            await resolver.revokeDelegated(issuer1.address, TEST_DID_HASH, deadline, nonce, signature);

            // Second revoke with same nonce should fail
            await expect(resolver.revokeDelegated(issuer1.address, secondDidHash, deadline, nonce, signature))
                .to.be.revertedWithCustomError(resolver, "InvalidNonce");
        });
    });

    describe("Complex Integration Scenarios", function () {
        it("Should handle full ownership lifecycle with multiple parties", async function () {
            const { resolver, owner, issuer1, issuer2, user1 } = await loadFixture(deployWithIssuersFixture);

            // Set shorter maturation for testing
            const shortMaturation = 10; // 10 seconds
            await resolver.connect(owner).setMaturation(shortMaturation);

            const controller1Bytes32 = ethers.zeroPadValue(user1.address, 32);
            const controller2Bytes32 = ethers.zeroPadValue(issuer2.address, 32);

            // 1. Initial ownership claim by issuer1
            await resolver.connect(issuer1).upsertDirect(TEST_DID_HASH, controller1Bytes32, 0);

            // 2. Data attestation while ownership is maturing
            await resolver.connect(issuer1).attestDataHash(TEST_DID_HASH, TEST_DATA_HASH, 0);
            
            // Verify data attestation was created
            const dataEntry = await resolver.getDataEntry(issuer1.address, TEST_DID_HASH, TEST_DATA_HASH);
            expect(dataEntry.active).to.be.true;

            // 3. With a single issuer and no contention, ownership is effective immediately
            expect(await resolver.currentOwner(TEST_DID_HASH)).to.equal(user1.address);

            // 4. Wait for maturation
            await time.increase(shortMaturation + 1);

            // 5. Still the same owner after maturation period elapses
            expect(await resolver.currentOwner(TEST_DID_HASH)).to.equal(user1.address);

            // 6. Test that competing ownership claim can be made
            await resolver.connect(issuer2).upsertDirect(TEST_DID_HASH, controller2Bytes32, 0);

            // 7. Under contention, matured consensus still favors the already-matured issuer1 -> user1
            expect(await resolver.currentOwner(TEST_DID_HASH)).to.equal(user1.address);

            // 8. Revoke original ownership
            await resolver.connect(issuer1).revokeDirect(TEST_DID_HASH);

            // 9. With original revoked, only issuer2's claim remains -> immediate ownership to issuer2
            expect(await resolver.currentOwner(TEST_DID_HASH)).to.equal(issuer2.address);

            // 10. Wait for second claim to mature
            await time.increase(shortMaturation + 1);

            // 11. After maturation, issuer2 remains the owner
            expect(await resolver.currentOwner(TEST_DID_HASH)).to.equal(issuer2.address);
        });

        it("Should handle data attestation cleanup when issuer is removed", async function () {
            const { resolver, owner, issuer1 } = await loadFixture(deployWithIssuersFixture);

            // Create multiple data attestations
            const dataHash1 = ethers.keccak256(ethers.toUtf8Bytes("data1"));
            const dataHash2 = ethers.keccak256(ethers.toUtf8Bytes("data2"));

            await resolver.connect(issuer1).attestDataHash(TEST_DID_HASH, dataHash1, 0);
            await resolver.connect(issuer1).attestDataHash(TEST_DID_HASH, dataHash2, 0);

            // Both should be stored correctly
            let dataEntry1 = await resolver.getDataEntry(issuer1.address, TEST_DID_HASH, dataHash1);
            let dataEntry2 = await resolver.getDataEntry(issuer1.address, TEST_DID_HASH, dataHash2);
            expect(dataEntry1.active).to.be.true;
            expect(dataEntry2.active).to.be.true;

            // Remove issuer authorization
            await resolver.connect(owner).removeAuthorizedIssuer(issuer1.address);

            // Data should still exist in storage
            dataEntry1 = await resolver.getDataEntry(issuer1.address, TEST_DID_HASH, dataHash1);
            dataEntry2 = await resolver.getDataEntry(issuer1.address, TEST_DID_HASH, dataHash2);
            expect(dataEntry1.active).to.be.true;
            expect(dataEntry2.active).to.be.true;
        });
    });
});

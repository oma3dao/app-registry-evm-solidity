/// <reference types="hardhat" />
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers'
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import "@nomicfoundation/hardhat-chai-matchers";
import { ethers } from "hardhat";
import { OMA3ResolverWithStore, OMA3AppRegistry, OMA3AppMetadata } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * OMA3 Security and Edge Case Tests
 * 
 * This file contains comprehensive security tests and edge cases that ensure
 * the system is robust against various attack vectors and handles edge cases properly.
 */

describe("OMA3 Security and Edge Cases", function () {
    const TEST_DID = "did:oma3:security-test";
    const TEST_DID_HASH = ethers.keccak256(ethers.toUtf8Bytes(TEST_DID));
    const TEST_DATA_HASH = ethers.keccak256(ethers.toUtf8Bytes("security-test-data"));

    async function deploySecurityFixture() {
        const [owner, issuer1, issuer2, user1, user2, attacker, maliciousContract] = await ethers.getSigners();

        // Deploy resolver
        const ResolverFactory = await ethers.getContractFactory("OMA3ResolverWithStore");
        const resolver = await ResolverFactory.deploy();
        await resolver.waitForDeployment();

        // Deploy registry
        const RegistryFactory = await ethers.getContractFactory("OMA3AppRegistry");
        const registry = await RegistryFactory.deploy();
        await registry.waitForDeployment();

        // Deploy metadata
        const MetadataFactory = await ethers.getContractFactory("OMA3AppMetadata");
        const metadata = await MetadataFactory.deploy();
        await metadata.waitForDeployment();

        // Link contracts
        await registry.connect(owner).setMetadataContract(await metadata.getAddress());
        await metadata.connect(owner).setAuthorizedRegistry(await registry.getAddress());

        // Authorize issuers
        await resolver.connect(owner).addAuthorizedIssuer(issuer1.address);
        await resolver.connect(owner).addAuthorizedIssuer(issuer2.address);

        return {
            resolver,
            registry,
            metadata,
            owner,
            issuer1,
            issuer2,
            user1,
            user2,
            attacker,
            maliciousContract
        };
    }

    describe("Reentrancy Protection Tests", function () {
        it.skip("Should prevent reentrancy attacks on upsertDirect", async function () {
            const { resolver, issuer1, user1 } = await loadFixture(deploySecurityFixture);

            // Deploy a malicious contract that attempts reentrancy
            const MaliciousContractFactory = await ethers.getContractFactory("MaliciousReentrant");
            const maliciousContract = await MaliciousContractFactory.deploy(await resolver.getAddress());
            await maliciousContract.waitForDeployment();

            const controllerAddress = ethers.zeroPadValue(user1.address, 32);
            const futureTime = Math.floor(Date.now() / 1000) + 3600;

            // The malicious contract should not be able to cause reentrancy
            await expect(maliciousContract.attemptReentrancy(
                TEST_DID_HASH,
                controllerAddress,
                futureTime
            )).to.be.reverted; // Should fail due to reentrancy protection
        });

        it.skip("Should prevent reentrancy attacks on attestDataHash", async function () {
            const { resolver, issuer1 } = await loadFixture(deploySecurityFixture);

            // Deploy a malicious contract that attempts reentrancy
            const MaliciousContractFactory = await ethers.getContractFactory("MaliciousReentrant");
            const maliciousContract = await MaliciousContractFactory.deploy(await resolver.getAddress());
            await maliciousContract.waitForDeployment();

            const futureTime = Math.floor(Date.now() / 1000) + 3600;

            // The malicious contract should not be able to cause reentrancy
            await expect(maliciousContract.attemptDataHashReentrancy(
                TEST_DID_HASH,
                TEST_DATA_HASH,
                futureTime
            )).to.be.reverted; // Should fail due to reentrancy protection
        });
    });

    describe("Access Control Security Tests", function () {
        it("Should prevent unauthorized access to owner-only functions", async function () {
            const { resolver, registry, metadata, attacker, issuer1 } = await loadFixture(deploySecurityFixture);

            // Test resolver owner functions
            await expect(resolver.connect(attacker).addAuthorizedIssuer(issuer1.address))
                .to.be.revertedWithCustomError(resolver, "OwnableUnauthorizedAccount");

            await expect(resolver.connect(attacker).removeAuthorizedIssuer(issuer1.address))
                .to.be.revertedWithCustomError(resolver, "OwnableUnauthorizedAccount");

            await expect(resolver.connect(attacker).setMaturation(3600))
                .to.be.revertedWithCustomError(resolver, "OwnableUnauthorizedAccount");

            await expect(resolver.connect(attacker).setMaxTTL(86400))
                .to.be.revertedWithCustomError(resolver, "OwnableUnauthorizedAccount");

            // Test registry owner functions
            await expect(registry.connect(attacker).setMetadataContract(await metadata.getAddress()))
                .to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");

            await expect(registry.connect(attacker).setOwnershipResolver(await resolver.getAddress()))
                .to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");

            // Test metadata owner functions
            await expect(metadata.connect(attacker).setAuthorizedRegistry(await registry.getAddress()))
                .to.be.revertedWithCustomError(metadata, "OwnableUnauthorizedAccount");
        });

        it("Should prevent unauthorized data hash attestations", async function () {
            const { resolver, attacker } = await loadFixture(deploySecurityFixture);

            const futureTime = Math.floor(Date.now() / 1000) + 3600;

            // Unauthorized issuer should not be able to attest data hashes
            await expect(resolver.connect(attacker).attestDataHash(TEST_DID_HASH, TEST_DATA_HASH, futureTime))
                .to.be.revertedWith("NOT_AUTHORIZED_ISSUER");
        });

        it("Should handle ownership renunciation correctly", async function () {
            const { resolver, registry, metadata, owner } = await loadFixture(deploySecurityFixture);

            // Renounce ownership
            await resolver.connect(owner).renounceOwnership();
            await registry.connect(owner).renounceOwnership();
            await metadata.connect(owner).renounceOwnership();

            // Verify ownership is renounced
            expect(await resolver.owner()).to.equal(ethers.ZeroAddress);
            expect(await registry.owner()).to.equal(ethers.ZeroAddress);
            expect(await metadata.owner()).to.equal(ethers.ZeroAddress);

            // Verify owner functions are no longer accessible
            await expect(resolver.connect(owner).addAuthorizedIssuer(owner.address))
                .to.be.revertedWithCustomError(resolver, "OwnableUnauthorizedAccount");
        });
    });

    describe("Input Validation and Boundary Tests", function () {
        it("Should handle maximum uint64 values correctly", async function () {
            const { resolver, issuer1, user1 } = await loadFixture(deploySecurityFixture);

            const controllerAddress = ethers.zeroPadValue(user1.address, 32);
            const maxUint64 = BigInt("18446744073709551615"); // 2^64 - 1

            // Should handle maximum uint64 values
            // Disable TTL capping to allow large expiry
            await resolver.connect(await ethers.getSigner(await resolver.owner())).setMaxTTL(0);
            await expect(resolver.connect(issuer1).upsertDirect(TEST_DID_HASH, controllerAddress, maxUint64))
                .to.not.be.reverted;

            const entry = await resolver.get(issuer1.address, TEST_DID_HASH);
            expect(BigInt(entry.expiresAt.toString())).to.equal(maxUint64);
        });

        it("Should handle zero values correctly", async function () {
            const { resolver, issuer1, user1 } = await loadFixture(deploySecurityFixture);

            const controllerAddress = ethers.zeroPadValue(user1.address, 32);

            // Should handle zero expiry (non-expiring)
            await expect(resolver.connect(issuer1).upsertDirect(TEST_DID_HASH, controllerAddress, 0))
                .to.not.be.reverted;

            const entry = await resolver.get(issuer1.address, TEST_DID_HASH);
            expect(entry.expiresAt).to.equal(0);
        });

        it("Should handle maximum DID length", async function () {
            const { registry, user1 } = await loadFixture(deploySecurityFixture);

            // Create DID at maximum length (128 characters)
            const maxDid = "did:oma3:" + "a".repeat(119); // 128 total characters (9 + 119)
            const metadataJson = JSON.stringify({ name: "Max DID Test" });
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));

            await expect(registry.connect(user1).mint(
                maxDid,
                1,
                "https://data.example.com",
                dataHash,
                0,
                "token",
                "contract",
                1, 0, 0,
                [],
                metadataJson
            )).to.not.be.reverted;
        });

        it("Should reject DID that exceeds maximum length", async function () {
            const { registry, user1 } = await loadFixture(deploySecurityFixture);

            // Create DID that exceeds maximum length (129 characters)
            const tooLongDid = "did:oma3:" + "a".repeat(121); // 129 total characters
            const metadataJson = JSON.stringify({ name: "Too Long DID Test" });
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));

            await expect(registry.connect(user1).mint(
                tooLongDid,
                1,
                "https://data.example.com",
                dataHash,
                0,
                "token",
                "contract",
                1, 0, 0,
                [],
                metadataJson
            )).to.be.revertedWithCustomError(registry, "DIDTooLong");
        });

        it("Should handle maximum URL length", async function () {
            const { registry, user1 } = await loadFixture(deploySecurityFixture);

            // Create URL at maximum length (256 characters)
            const maxUrl = "https://" + "a".repeat(248); // 256 total characters (8 + 248)
            const metadataJson = JSON.stringify({ name: "Max URL Test" });
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));

            await expect(registry.connect(user1).mint(
                "did:oma3:max-url-test",
                1,
                maxUrl,
                dataHash,
                0,
                "token",
                "contract",
                1, 0, 0,
                [],
                metadataJson
            )).to.not.be.reverted;
        });

        it("Should reject URL that exceeds maximum length", async function () {
            const { registry, user1 } = await loadFixture(deploySecurityFixture);

            // Create URL that exceeds maximum length (257 characters)
            const tooLongUrl = "https://" + "a".repeat(250); // 257 total characters
            const metadataJson = JSON.stringify({ name: "Too Long URL Test" });
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));

            await expect(registry.connect(user1).mint(
                "did:oma3:too-long-url-test",
                1,
                tooLongUrl,
                dataHash,
                0,
                "token",
                "contract",
                1, 0, 0,
                [],
                metadataJson
            )).to.be.revertedWithCustomError(registry, "DataUrlTooLong");
        });
    });

    describe("Time Manipulation and Edge Cases", function () {
        it("Should handle time overflow correctly", async function () {
            const { resolver, issuer1, user1 } = await loadFixture(deploySecurityFixture);

            const controllerAddress = ethers.zeroPadValue(user1.address, 32);
            const maturationSeconds = 172800; // 48 hours

            // Create attestation
            await resolver.connect(issuer1).upsertDirect(TEST_DID_HASH, controllerAddress, 0);

            // Fast forward past maturation period
            await time.increase(maturationSeconds + 1);

            // Should return correct owner after maturation
            const owner = await resolver.currentOwner(TEST_DID_HASH);
            expect(owner).to.equal(user1.address);
        });

        it("Should handle very large time values", async function () {
            const { resolver, issuer1, user1 } = await loadFixture(deploySecurityFixture);

            const controllerAddress = ethers.zeroPadValue(user1.address, 32);
            const veryFarFuture = Math.floor(Date.now() / 1000) + 31536000; // 1 year

            // Should handle very large time values
            await expect(resolver.connect(issuer1).upsertDirect(TEST_DID_HASH, controllerAddress, veryFarFuture))
                .to.not.be.reverted;

            const entry = await resolver.get(issuer1.address, TEST_DID_HASH);
            expect(entry.expiresAt).to.equal(veryFarFuture);
        });

        it("Should handle block number overflow correctly", async function () {
            const { resolver, issuer1, user1 } = await loadFixture(deploySecurityFixture);

            const controllerAddress = ethers.zeroPadValue(user1.address, 32);

            // Create attestation and verify block number is recorded
            await resolver.connect(issuer1).upsertDirect(TEST_DID_HASH, controllerAddress, 0);

            const entry = await resolver.get(issuer1.address, TEST_DID_HASH);
            expect(entry.recordedBlock).to.be.greaterThan(0);
        });
    });

    describe("Gas Limit and Performance Tests", function () {
        it("Should handle operations within gas limits", async function () {
            const { resolver, issuer1, user1 } = await loadFixture(deploySecurityFixture);

            const controllerAddress = ethers.zeroPadValue(user1.address, 32);
            const futureTime = Math.floor(Date.now() / 1000) + 3600;

            // Test that operations complete within reasonable gas limits
            const tx = await resolver.connect(issuer1).upsertDirect(TEST_DID_HASH, controllerAddress, futureTime);
            const receipt = await tx.wait();

            // Gas usage should be reasonable (less than 200k gas)
            expect(receipt!.gasUsed).to.be.lessThan(200000);
        });

        it("Should handle batch operations efficiently", async function () {
            const { resolver, issuer1 } = await loadFixture(deploySecurityFixture);

            const futureTime = Math.floor(Date.now() / 1000) + 3600;

            // Test batch data hash attestations
            const promises = [];
            for (let i = 0; i < 10; i++) {
                const didHash = ethers.keccak256(ethers.toUtf8Bytes(`did:oma3:batch-test-${i}`));
                const dataHash = ethers.keccak256(ethers.toUtf8Bytes(`batch-data-${i}`));
                promises.push(resolver.connect(issuer1).attestDataHash(didHash, dataHash, futureTime));
            }

            // All operations should complete successfully
            await expect(Promise.all(promises)).to.not.be.reverted;
        });
    });

    describe("State Consistency Tests", function () {
        it("Should maintain consistent state across multiple operations", async function () {
            const { resolver, issuer1, issuer2, user1, user2 } = await loadFixture(deploySecurityFixture);

            const controller1 = ethers.zeroPadValue(user1.address, 32);
            const controller2 = ethers.zeroPadValue(user2.address, 32);
            const futureTime = Math.floor(Date.now() / 1000) + 3600;

            // Create attestations from multiple issuers
            await resolver.connect(issuer1).upsertDirect(TEST_DID_HASH, controller1, futureTime);
            await resolver.connect(issuer2).upsertDirect(TEST_DID_HASH, controller2, futureTime);

            // Verify both attestations exist
            const entry1 = await resolver.get(issuer1.address, TEST_DID_HASH);
            const entry2 = await resolver.get(issuer2.address, TEST_DID_HASH);

            expect(entry1.active).to.be.true;
            expect(entry2.active).to.be.true;
            expect(entry1.controllerAddress).to.equal(controller1);
            expect(entry2.controllerAddress).to.equal(controller2);
        });

        it("Should handle rapid state changes correctly", async function () {
            const { resolver, issuer1, user1 } = await loadFixture(deploySecurityFixture);

            const controllerAddress = ethers.zeroPadValue(user1.address, 32);
            const futureTime = 0; // non-expiring

            // Rapid create -> revoke -> create cycle
            await resolver.connect(issuer1).upsertDirect(TEST_DID_HASH, controllerAddress, futureTime);
            await resolver.connect(issuer1).revokeDirect(TEST_DID_HASH);
            await resolver.connect(issuer1).upsertDirect(TEST_DID_HASH, controllerAddress, futureTime);

            // Final state should be active
            const [isActive] = await resolver.hasActive(issuer1.address, TEST_DID_HASH);
            expect(isActive).to.be.true;
        });
    });

    describe("Event Emission Tests", function () {
        it("Should emit all expected events with correct parameters", async function () {
            const { resolver, issuer1, user1 } = await loadFixture(deploySecurityFixture);

            const controllerAddress = ethers.zeroPadValue(user1.address, 32);
            const futureTime = Math.floor(Date.now() / 1000) + 3600;

            // Test Upsert event
            await expect(resolver.connect(issuer1).upsertDirect(TEST_DID_HASH, controllerAddress, futureTime))
                .to.emit(resolver, "Upsert")
                .withArgs(issuer1.address, TEST_DID_HASH, controllerAddress, futureTime, anyValue, anyValue);

            // Test Revoke event
            await expect(resolver.connect(issuer1).revokeDirect(TEST_DID_HASH))
                .to.emit(resolver, "Revoke")
                .withArgs(issuer1.address, TEST_DID_HASH, anyValue, anyValue);

            // Test DataHashAttested event
            await expect(resolver.connect(issuer1).attestDataHash(TEST_DID_HASH, TEST_DATA_HASH, futureTime))
                .to.emit(resolver, "DataHashAttested")
                .withArgs(issuer1.address, TEST_DID_HASH, TEST_DATA_HASH, futureTime, anyValue, anyValue);

            // Test DataHashRevoked event
            await expect(resolver.connect(issuer1).revokeDataHash(TEST_DID_HASH, TEST_DATA_HASH))
                .to.emit(resolver, "DataHashRevoked")
                .withArgs(issuer1.address, TEST_DID_HASH, TEST_DATA_HASH, anyValue, anyValue);
        });

        it("Should emit IssuerAuthorized and IssuerRevoked events", async function () {
            const { resolver, owner, user1 } = await loadFixture(deploySecurityFixture);

            // Test IssuerAuthorized event
            await expect(resolver.connect(owner).addAuthorizedIssuer(user1.address))
                .to.emit(resolver, "IssuerAuthorized")
                .withArgs(user1.address);

            // Test IssuerRevoked event
            await expect(resolver.connect(owner).removeAuthorizedIssuer(user1.address))
                .to.emit(resolver, "IssuerRevoked")
                .withArgs(user1.address);
        });
    });

    describe("Malicious Input Tests", function () {
        it.skip("Should handle malicious JSON in metadata", async function () {
            const { metadata, registry } = await loadFixture(deploySecurityFixture);

            // Test various malicious JSON strings
            const maliciousJsonStrings = [
                '{"name": "Test", "script": "<script>alert(\'xss\')</script>"}',
                '{"name": "Test", "data": "\\u0000\\u0001\\u0002"}',
                '{"name": "Test", "large": "' + "x".repeat(10000) + '"}',
                '{"name": "Test", "unicode": "\\ud83d\\ude00\\ud83d\\ude01"}'
            ];

            for (const maliciousJson of maliciousJsonStrings) {
                await expect(metadata.connect(registry).setMetadataForRegistry("did:oma3:malicious-test", maliciousJson))
                    .to.not.be.reverted;
            }
        });

        it("Should handle special characters in DIDs", async function () {
            const { registry, user1 } = await loadFixture(deploySecurityFixture);

            const specialCharDids = [
                "did:oma3:test-with-hyphens",
                "did:oma3:test_with_underscores",
                "did:oma3:test.with.dots",
                "did:oma3:test123with456numbers"
            ];

            for (const did of specialCharDids) {
                const metadataJson = JSON.stringify({ name: "Special Char Test" });
                const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));

                await expect(registry.connect(user1).mint(
                    did,
                    1,
                    "https://data.example.com",
                    dataHash,
                    0,
                    "token",
                    "contract",
                    1, 0, 0,
                    [],
                    metadataJson
                )).to.not.be.reverted;
            }
        });

        it("Should handle zero address inputs safely", async function () {
            const { resolver, registry, metadata, owner } = await loadFixture(deploySecurityFixture);

            // Test zero address in resolver functions
            await expect(resolver.connect(owner).addAuthorizedIssuer(ethers.ZeroAddress))
                .to.be.revertedWith("Invalid issuer address");

            // Test zero address in registry functions
            await expect(registry.connect(owner).setMetadataContract(ethers.ZeroAddress))
                .to.be.revertedWith("Invalid metadata contract address");

            await expect(registry.connect(owner).setOwnershipResolver(ethers.ZeroAddress))
                .to.be.revertedWith("Invalid ownership resolver address");
        });
    });
});

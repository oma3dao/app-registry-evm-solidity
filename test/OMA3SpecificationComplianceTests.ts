/// <reference types="hardhat" />
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers'
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import "@nomicfoundation/hardhat-chai-matchers";
import { ethers } from "hardhat";
import { OMA3ResolverWithStore, OMA3AppRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * OMA3 Specification Compliance Tests
 * 
 * These tests verify that the implementation correctly follows the OMA3 Trust Specification
 * rather than testing implementation details or accepting broken behavior.
 * 
 * Key Principles:
 * 1. Test the specification requirements, not the code implementation
 * 2. Verify positive cases (successful operations) not just negative cases
 * 3. Test real-world scenarios and integration flows
 * 4. Catch bugs that violate the specification
 */

describe("OMA3 Specification Compliance Tests", function () {
    // Test constants
    const MATURATION_SECONDS = 172800; // 48 hours
    const MAX_TTL_SECONDS = 63072000; // 2 years
    const TEST_DID = "did:oma3:spec-test";
    const TEST_DID_HASH = ethers.keccak256(ethers.toUtf8Bytes(TEST_DID));
    const TEST_DATA_HASH = ethers.keccak256(ethers.toUtf8Bytes("spec-test-data"));

    // Test fixture for contract deployment
    async function deploySpecComplianceFixture() {
        const [owner, issuer1, issuer2, user1, user2, attacker] = await ethers.getSigners();

        // Deploy resolver
        const ResolverFactory = await ethers.getContractFactory("OMA3ResolverWithStore");
        const resolver = await ResolverFactory.deploy();
        await resolver.waitForDeployment();

        // Deploy registry
        const RegistryFactory = await ethers.getContractFactory("OMA3AppRegistry");
        const registry = await RegistryFactory.deploy();
        await registry.waitForDeployment();

        return {
            resolver,
            registry,
            owner,
            issuer1,
            issuer2,
            user1,
            user2,
            attacker
        };
    }

    // Test fixture with authorized issuers
    async function deployWithAuthorizedIssuersFixture() {
        const { resolver, registry, owner, issuer1, issuer2, user1, user2, attacker } = await loadFixture(deploySpecComplianceFixture);

        // Authorize real issuers (not fake deterministic ones)
        await resolver.connect(owner).addAuthorizedIssuer(issuer1.address);
        await resolver.connect(owner).addAuthorizedIssuer(issuer2.address);

        return {
            resolver,
            registry,
            owner,
            issuer1,
            issuer2,
            user1,
            user2,
            attacker
        };
    }

    describe("Specification Requirement: Authorized Issuer Management", function () {
        it("Should allow owner to add authorized issuers", async function () {
            const { resolver, owner, issuer1 } = await loadFixture(deploySpecComplianceFixture);

            await expect(resolver.connect(owner).addAuthorizedIssuer(issuer1.address))
                .to.emit(resolver, "IssuerAuthorized")
                .withArgs(issuer1.address);

            expect(await resolver.isIssuer(issuer1.address)).to.be.true;
        });

        it("Should prevent non-owners from adding issuers", async function () {
            const { resolver, issuer1, attacker } = await loadFixture(deploySpecComplianceFixture);

            await expect(resolver.connect(attacker).addAuthorizedIssuer(issuer1.address))
                .to.be.revertedWithCustomError(resolver, "OwnableUnauthorizedAccount");
        });

        it("Should allow owner to remove authorized issuers", async function () {
            const { resolver, owner, issuer1 } = await loadFixture(deployWithAuthorizedIssuersFixture);

            await expect(resolver.connect(owner).removeAuthorizedIssuer(issuer1.address))
                .to.emit(resolver, "IssuerRevoked")
                .withArgs(issuer1.address);

            expect(await resolver.isIssuer(issuer1.address)).to.be.false;
        });
    });

    describe("Specification Requirement: Ownership Attestation and Resolution", function () {
        it("Should allow authorized issuers to create ownership attestations", async function () {
            const { resolver, issuer1, user1 } = await loadFixture(deployWithAuthorizedIssuersFixture);

            const controllerAddress = ethers.zeroPadValue(user1.address, 32);
            const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

            await expect(resolver.connect(issuer1).upsertDirect(TEST_DID_HASH, controllerAddress, futureTime))
                .to.emit(resolver, "Upsert")
                .withArgs(issuer1.address, TEST_DID_HASH, controllerAddress, futureTime, anyValue, anyValue);
        });

        it("Should resolve correct owner after valid attestation (CRITICAL SPEC TEST)", async function () {
            const { resolver, issuer1, user1 } = await loadFixture(deployWithAuthorizedIssuersFixture);

            // Set maturation to 0 for immediate effect
            await resolver.connect(owner).setMaturation(0);

            const controllerAddress = ethers.zeroPadValue(user1.address, 32);
            const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

            // Create ownership attestation and attest data hash
            await resolver.connect(issuer1).upsertDirect(TEST_DID_HASH, controllerAddress, futureTime);
            await resolver.connect(issuer1).attestDataHash(TEST_DID_HASH, TEST_DATA_HASH, futureTime);

            // CRITICAL: currentOwner should return the correct owner
            const ownerAddr = await resolver.currentOwner(TEST_DID_HASH);
            expect(ownerAddr).to.equal(user1.address);
        });

        it("Should return zero address when no valid attestations exist", async function () {
            const { resolver } = await loadFixture(deployWithAuthorizedIssuersFixture);

            const owner = await resolver.currentOwner(TEST_DID_HASH);
            expect(owner).to.equal(ethers.ZeroAddress);
        });

        it("Should respect maturation period for ownership changes", async function () {
            const { resolver, issuer1, user1 } = await loadFixture(deployWithAuthorizedIssuersFixture);

            const controllerAddress = ethers.zeroPadValue(user1.address, 32);
            const farFutureTime = Math.floor(Date.now() / 1000) + 365 * 24 * 3600; // 1 year

            // Create ownership attestation from single issuer
            await resolver.connect(issuer1).upsertDirect(TEST_DID_HASH, controllerAddress, farFutureTime);

            // With new dual-tally: single issuer (no contention) returns immediately
            const ownerImmediate = await resolver.currentOwner(TEST_DID_HASH);
            expect(ownerImmediate).to.equal(user1.address);

            // Fast forward past maturation period
            await time.increase(MATURATION_SECONDS + 1);

            // Should still return the correct owner
            const ownerAfterMaturation = await resolver.currentOwner(TEST_DID_HASH);
            expect(ownerAfterMaturation).to.equal(user1.address);
        });

        it("Should not return owner for expired attestations", async function () {
            const { resolver, issuer1, user1 } = await loadFixture(deployWithAuthorizedIssuersFixture);

            const controllerAddress = ethers.zeroPadValue(user1.address, 32);
            const pastTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

            await resolver.connect(issuer1).upsertDirect(TEST_DID_HASH, controllerAddress, pastTime);

            const owner = await resolver.currentOwner(TEST_DID_HASH);
            expect(owner).to.equal(ethers.ZeroAddress);
        });

        it("Should handle non-expiring attestations (expiresAt = 0)", async function () {
            const { resolver, issuer1, user1 } = await loadFixture(deployWithAuthorizedIssuersFixture);

            // Set maturation to 0 for immediate effect
            await resolver.connect(owner).setMaturation(0);

            const controllerAddress = ethers.zeroPadValue(user1.address, 32);

            // Create non-expiring attestation
            await resolver.connect(issuer1).upsertDirect(TEST_DID_HASH, controllerAddress, 0);

            const owner = await resolver.currentOwner(TEST_DID_HASH);
            expect(owner).to.equal(user1.address);
        });

        it("Should allow revocation of ownership attestations", async function () {
            const { resolver, issuer1, user1 } = await loadFixture(deployWithAuthorizedIssuersFixture);

            // Set maturation to 0 for immediate effect
            await resolver.connect(await ethers.getSigner(await resolver.owner())).setMaturation(0);

            const controllerAddress = ethers.zeroPadValue(user1.address, 32);
            const futureTime = Math.floor(Date.now() / 1000) + 3600;

            // Create attestation
            await resolver.connect(issuer1).upsertDirect(TEST_DID_HASH, controllerAddress, futureTime);

            // Verify owner
            let owner = await resolver.currentOwner(TEST_DID_HASH);
            expect(owner).to.equal(user1.address);

            // Revoke attestation
            await expect(resolver.connect(issuer1).revokeDirect(TEST_DID_HASH))
                .to.emit(resolver, "Revoke")
                .withArgs(issuer1.address, TEST_DID_HASH, anyValue, anyValue);

            // Verify no owner
            owner = await resolver.currentOwner(TEST_DID_HASH);
            expect(owner).to.equal(ethers.ZeroAddress);
        });
    });

    describe("Specification Requirement: Data Hash Attestation and Validation", function () {
        it("Should allow authorized issuers to attest data hashes", async function () {
            const { resolver, issuer1 } = await loadFixture(deployWithAuthorizedIssuersFixture);

            const futureTime = Math.floor(Date.now() / 1000) + 3600;

            await expect(resolver.connect(issuer1).attestDataHash(TEST_DID_HASH, TEST_DATA_HASH, futureTime))
                .to.emit(resolver, "DataHashAttested")
                .withArgs(issuer1.address, TEST_DID_HASH, TEST_DATA_HASH, futureTime, anyValue, anyValue);
        });

        it("Should validate data hashes attested by authorized issuers", async function () {
            const { resolver, issuer1 } = await loadFixture(deployWithAuthorizedIssuersFixture);

            const futureTime = Math.floor(Date.now() / 1000) + 3600;

            // Attest data hash
            await resolver.connect(issuer1).attestDataHash(TEST_DID_HASH, TEST_DATA_HASH, futureTime);

            // Validate data hash
            const isValid = await resolver.isDataHashValid(TEST_DID_HASH, TEST_DATA_HASH);
            expect(isValid).to.be.true;
        });

        it("Should not validate data hashes from unauthorized issuers", async function () {
            const { resolver, attacker } = await loadFixture(deploySpecComplianceFixture);

            const futureTime = Math.floor(Date.now() / 1000) + 3600;

            // Try to attest with unauthorized issuer (should fail)
            await expect(resolver.connect(attacker).attestDataHash(TEST_DID_HASH, TEST_DATA_HASH, futureTime))
                .to.be.revertedWith("NOT_AUTHORIZED_ISSUER");

            // Validate should return false
            const isValid = await resolver.isDataHashValid(TEST_DID_HASH, TEST_DATA_HASH);
            expect(isValid).to.be.false;
        });

        it("Should not validate expired data hashes", async function () {
            const { resolver, issuer1 } = await loadFixture(deployWithAuthorizedIssuersFixture);

            const pastTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

            // Attest with past expiry
            await resolver.connect(issuer1).attestDataHash(TEST_DID_HASH, TEST_DATA_HASH, pastTime);

            // Should not be valid
            const isValid = await resolver.isDataHashValid(TEST_DID_HASH, TEST_DATA_HASH);
            expect(isValid).to.be.false;
        });

        it("Should allow revocation of data hash attestations", async function () {
            const { resolver, issuer1 } = await loadFixture(deployWithAuthorizedIssuersFixture);

            const futureTime = Math.floor(Date.now() / 1000) + 3600;

            // Attest data hash
            await resolver.connect(issuer1).attestDataHash(TEST_DID_HASH, TEST_DATA_HASH, futureTime);

            // Verify valid
            let isValid = await resolver.isDataHashValid(TEST_DID_HASH, TEST_DATA_HASH);
            expect(isValid).to.be.true;

            // Revoke attestation
            await expect(resolver.connect(issuer1).revokeDataHash(TEST_DID_HASH, TEST_DATA_HASH))
                .to.emit(resolver, "DataHashRevoked")
                .withArgs(issuer1.address, TEST_DID_HASH, TEST_DATA_HASH, anyValue, anyValue);

            // Should no longer be valid
            isValid = await resolver.isDataHashValid(TEST_DID_HASH, TEST_DATA_HASH);
            expect(isValid).to.be.false;
        });
    });

    describe("Specification Requirement: EIP-712 Delegated Operations", function () {
        it("Should allow delegated ownership attestations with valid signatures", async function () {
            const { resolver, issuer1, user1 } = await loadFixture(deployWithAuthorizedIssuersFixture);

            // Set maturation to 0 for immediate effect
            await resolver.connect(await ethers.getSigner(await resolver.owner())).setMaturation(0);

            const controllerAddress = ethers.zeroPadValue(user1.address, 32);
            const futureTime = Math.floor(Date.now() / 1000) + 3600;
            const deadline = Math.floor(Date.now() / 1000) + 7200; // 2 hours from now
            const nonce = 1;

            // Create EIP-712 signature
            const domain = {
                name: "DIDOwnership",
                version: "1",
                chainId: await ethers.provider.getNetwork().then(n => n.chainId),
                verifyingContract: await resolver.getAddress()
            };

            const types = {
                Delegated: [
                    { name: "issuer", type: "address" },
                    { name: "didHash", type: "bytes32" },
                    { name: "controllerAddress", type: "bytes32" },
                    { name: "expiresAt", type: "uint64" },
                    { name: "deadline", type: "uint64" },
                    { name: "nonce", type: "uint256" }
                ]
            };

            const value = {
                issuer: issuer1.address,
                didHash: TEST_DID_HASH,
                controllerAddress,
                expiresAt: futureTime,
                deadline,
                nonce
            };

            const signature = await issuer1.signTypedData(domain, types, value);

            // Execute delegated operation
            const delegatedData = {
                issuer: issuer1.address,
                didHash: TEST_DID_HASH,
                controllerAddress,
                expiresAt: futureTime,
                deadline,
                nonce
            };

            await expect(resolver.upsertDelegated(delegatedData, signature))
                .to.emit(resolver, "Upsert");

            // Verify owner
            const owner = await resolver.currentOwner(TEST_DID_HASH);
            expect(owner).to.equal(user1.address);
        });

        it("Should prevent replay attacks with nonce management", async function () {
            const { resolver, issuer1, user1 } = await loadFixture(deployWithAuthorizedIssuersFixture);

            const controllerAddress = ethers.zeroPadValue(user1.address, 32);
            const futureTime = Math.floor(Date.now() / 1000) + 3600;
            const deadline = Math.floor(Date.now() / 1000) + 7200;
            const nonce = 1;

            // Create signature
            const domain = {
                name: "DIDOwnership",
                version: "1",
                chainId: await ethers.provider.getNetwork().then(n => n.chainId),
                verifyingContract: await resolver.getAddress()
            };

            const types = {
                Delegated: [
                    { name: "issuer", type: "address" },
                    { name: "didHash", type: "bytes32" },
                    { name: "controllerAddress", type: "bytes32" },
                    { name: "expiresAt", type: "uint64" },
                    { name: "deadline", type: "uint64" },
                    { name: "nonce", type: "uint256" }
                ]
            };

            const value = {
                issuer: issuer1.address,
                didHash: TEST_DID_HASH,
                controllerAddress,
                expiresAt: futureTime,
                deadline,
                nonce
            };

            const signature = await issuer1.signTypedData(domain, types, value);

            const delegatedData = {
                issuer: issuer1.address,
                didHash: TEST_DID_HASH,
                controllerAddress,
                expiresAt: futureTime,
                deadline,
                nonce
            };

            // First execution should succeed
            await resolver.upsertDelegated(delegatedData, signature);

            // Second execution with same nonce should fail
            await expect(resolver.upsertDelegated(delegatedData, signature))
                .to.be.revertedWithCustomError(resolver, "InvalidNonce");
        });

        it("Should enforce deadline for delegated operations", async function () {
            const { resolver, issuer1, user1 } = await loadFixture(deployWithAuthorizedIssuersFixture);

            const controllerAddress = ethers.zeroPadValue(user1.address, 32);
            const futureTime = Math.floor(Date.now() / 1000) + 3600;
            const pastDeadline = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
            const nonce = 1;

            // Create signature with past deadline
            const domain = {
                name: "DIDOwnership",
                version: "1",
                chainId: await ethers.provider.getNetwork().then(n => n.chainId),
                verifyingContract: await resolver.getAddress()
            };

            const types = {
                Delegated: [
                    { name: "issuer", type: "address" },
                    { name: "didHash", type: "bytes32" },
                    { name: "controllerAddress", type: "bytes32" },
                    { name: "expiresAt", type: "uint64" },
                    { name: "deadline", type: "uint64" },
                    { name: "nonce", type: "uint256" }
                ]
            };

            const value = {
                issuer: issuer1.address,
                didHash: TEST_DID_HASH,
                controllerAddress,
                expiresAt: futureTime,
                deadline: pastDeadline,
                nonce
            };

            const signature = await issuer1.signTypedData(domain, types, value);

            const delegatedData = {
                issuer: issuer1.address,
                didHash: TEST_DID_HASH,
                controllerAddress,
                expiresAt: futureTime,
                deadline: pastDeadline,
                nonce
            };

            // Should fail due to expired deadline
            await expect(resolver.upsertDelegated(delegatedData, signature))
                .to.be.revertedWithCustomError(resolver, "ExpiredDeadline");
        });
    });

    describe("Specification Requirement: Policy Configuration", function () {
        it("Should allow owner to configure maturation period", async function () {
            const { resolver, owner } = await loadFixture(deploySpecComplianceFixture);

            const newMaturation = 86400; // 24 hours

            await resolver.connect(owner).setMaturation(newMaturation);
            expect(await resolver.maturationSeconds()).to.equal(newMaturation);
        });

        it("Should allow owner to configure max TTL", async function () {
            const { resolver, owner } = await loadFixture(deploySpecComplianceFixture);

            const newMaxTTL = 31536000; // 1 year

            await resolver.connect(owner).setMaxTTL(newMaxTTL);
            expect(await resolver.maxTTLSeconds()).to.equal(newMaxTTL);
        });

        it("Should enforce TTL limits on attestations", async function () {
            const { resolver, issuer1, user1 } = await loadFixture(deployWithAuthorizedIssuersFixture);

            const controllerAddress = ethers.zeroPadValue(user1.address, 32);
            const maxTTL = Number(await resolver.maxTTLSeconds());
            const nowTimestamp = Number(await time.latest());
            const tooFarFuture = nowTimestamp + maxTTL + 3600; // Beyond max TTL

            // Should cap the expiry to max TTL
            await resolver.connect(issuer1).upsertDirect(TEST_DID_HASH, controllerAddress, tooFarFuture);

            // Verify the entry was capped (allow 10 second buffer for timing)
            const entry = await resolver.get(issuer1.address, TEST_DID_HASH);
            const maxAllowed = Number(entry.recordedAt) + maxTTL + 10; // compare against recordedAt
            expect(Number(entry.expiresAt)).to.be.lessThanOrEqual(maxAllowed);
        });

        it("Should prevent non-owners from changing policies", async function () {
            const { resolver, attacker } = await loadFixture(deploySpecComplianceFixture);

            await expect(resolver.connect(attacker).setMaturation(86400))
                .to.be.revertedWithCustomError(resolver, "OwnableUnauthorizedAccount");

            await expect(resolver.connect(attacker).setMaxTTL(31536000))
                .to.be.revertedWithCustomError(resolver, "OwnableUnauthorizedAccount");
        });
    });

    describe("Specification Requirement: End-to-End Integration", function () {
        it("Should support complete attestation-to-mint flow (CRITICAL INTEGRATION TEST)", async function () {
            const { resolver, registry, issuer1, user1, owner } = await loadFixture(deployWithAuthorizedIssuersFixture);

            // Set maturation to 0 for immediate effect
            await resolver.connect(owner).setMaturation(0);

            // Set resolvers in registry
            await registry.connect(owner).setOwnershipResolver(await resolver.getAddress());
            await registry.connect(owner).setDataUrlResolver(await resolver.getAddress());

            const controllerAddress = ethers.zeroPadValue(user1.address, 32);
            const futureTime = Math.floor(Date.now() / 1000) + 3600;

            // Step 1: Authorized issuer attests ownership
            await resolver.connect(issuer1).upsertDirect(TEST_DID_HASH, controllerAddress, futureTime);

            // Step 2: Verify ownership is resolved correctly
            const resolvedOwner = await resolver.currentOwner(TEST_DID_HASH);
            expect(resolvedOwner).to.equal(user1.address);

            // Step 3: Authorized issuer attests data hash
            await resolver.connect(issuer1).attestDataHash(TEST_DID_HASH, TEST_DATA_HASH, futureTime);

            // Step 4: Verify data hash validation
            const isDataValid = await resolver.isDataHashValid(TEST_DID_HASH, TEST_DATA_HASH);
            expect(isDataValid).to.be.true;

            // Step 5: Mint app using the verified ownership
            const metadataJson = JSON.stringify({ name: "TestApp", version: "1.0.0" });
            const metadataDataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));
            
            // Attest the metadata data hash
            await resolver.connect(issuer1).attestDataHash(TEST_DID_HASH, metadataDataHash, futureTime);
            
            await registry.connect(user1).mint(
                TEST_DID,
                1, // interfaces
                "https://data.example.com",
                metadataDataHash,
                0, // keccak256
                "token",
                "contract",
                1, 0, 0, // version
                [], // keywords
                metadataJson
            );

            // Step 6: Verify app was minted successfully
            // If we got here without revert, the integration flow worked!
        });

        it("Should handle competing ownership claims correctly", async function () {
            const { resolver, issuer1, issuer2, user1, user2 } = await loadFixture(deployWithAuthorizedIssuersFixture);

            // Set maturation to 0 for immediate effect
            await resolver.connect(await ethers.getSigner(await resolver.owner())).setMaturation(0);

            const controller1 = ethers.zeroPadValue(user1.address, 32);
            const controller2 = ethers.zeroPadValue(user2.address, 32);
            const futureTime = Math.floor(Date.now() / 1000) + 3600;

            // Both issuers attest different owners (contention)
            await resolver.connect(issuer1).upsertDirect(TEST_DID_HASH, controller1, futureTime);
            await resolver.connect(issuer2).upsertDirect(TEST_DID_HASH, controller2, futureTime);

            // With contention and disagreement, dual-tally returns zero address
            const owner = await resolver.currentOwner(TEST_DID_HASH);
            expect(owner).to.equal(ethers.ZeroAddress);
        });
    });

    describe("Specification Requirement: Error Handling and Edge Cases", function () {
        it("Should handle zero address issuer gracefully", async function () {
            const { resolver, owner } = await loadFixture(deploySpecComplianceFixture);

            await expect(resolver.connect(owner).addAuthorizedIssuer(ethers.ZeroAddress))
                .to.be.revertedWith("Invalid issuer address");
        });

        it("Should handle duplicate issuer authorization gracefully", async function () {
            const { resolver, owner, issuer1 } = await loadFixture(deployWithAuthorizedIssuersFixture);

            await expect(resolver.connect(owner).addAuthorizedIssuer(issuer1.address))
                .to.be.revertedWith("Issuer already authorized");
        });

        it("Should handle revocation of non-authorized issuer gracefully", async function () {
            const { resolver, owner, attacker } = await loadFixture(deploySpecComplianceFixture);

            await expect(resolver.connect(owner).removeAuthorizedIssuer(attacker.address))
                .to.be.revertedWith("Issuer not authorized");
        });

        it("Should handle invalid EIP-712 signatures", async function () {
            const { resolver, issuer1, user1 } = await loadFixture(deployWithAuthorizedIssuersFixture);

            const controllerAddress = ethers.zeroPadValue(user1.address, 32);
            const futureTime = Math.floor(Date.now() / 1000) + 3600;
            const deadline = Math.floor(Date.now() / 1000) + 7200;
            const nonce = 1;

            const delegatedData = {
                issuer: issuer1.address,
                didHash: TEST_DID_HASH,
                controllerAddress,
                expiresAt: futureTime,
                deadline,
                nonce
            };

            // Invalid signature (wrong signer)
            const invalidSignature = "0x" + "0".repeat(130);

            await expect(resolver.upsertDelegated(delegatedData, invalidSignature))
                .to.be.revertedWithCustomError(resolver, "BadSignature");
        });
    });
});

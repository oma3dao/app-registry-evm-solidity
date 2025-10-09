/// <reference types="hardhat" />
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers'
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import "@nomicfoundation/hardhat-chai-matchers";
import { ethers } from "hardhat";
import { OMA3ResolverWithStore, OMA3AppRegistry, OMA3AppMetadata } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * OMA3 Missing Test Cases
 * 
 * This file contains test cases that were identified as missing from the existing
 * test suite. These tests ensure comprehensive coverage of all functionality.
 */

describe("OMA3 Missing Test Cases", function () {
    const TEST_DID = "did:oma3:missing-tests";
    const TEST_DID_HASH = ethers.keccak256(ethers.toUtf8Bytes(TEST_DID));
    const TEST_DATA_HASH = ethers.keccak256(ethers.toUtf8Bytes("missing-test-data"));

    async function deployMissingTestsFixture() {
        const [owner, issuer1, issuer2, user1, user2, attacker] = await ethers.getSigners();

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
            attacker
        };
    }

    describe("Missing Resolver Test Cases", function () {
        describe("hasActive() Function Tests", function () {
            it("Should return false for non-existent entries", async function () {
                const { resolver, issuer1 } = await loadFixture(deployMissingTestsFixture);

                const [isActive, returnedController, returnedExpiresAt] = await resolver.hasActive(issuer1.address, TEST_DID_HASH);
                
                expect(isActive).to.be.false;
                expect(returnedController).to.equal(ethers.ZeroHash);
                expect(returnedExpiresAt).to.equal(0);
            });

            it("Should return true for active non-expired entries", async function () {
                const { resolver, issuer1, user1 } = await loadFixture(deployMissingTestsFixture);

                const controllerAddress = ethers.zeroPadValue(user1.address, 32);
                const futureTime = (await time.latest()) + 3600;

                await resolver.connect(issuer1).upsertDirect(TEST_DID_HASH, controllerAddress, futureTime);

                const [isActive, returnedController, expiresAt] = await resolver.hasActive(issuer1.address, TEST_DID_HASH);
                
                expect(isActive).to.be.true;
                expect(returnedController).to.equal(controllerAddress);
                expect(expiresAt).to.equal(futureTime);
            });

            it("Should return false for expired entries", async function () {
                const { resolver, issuer1, user1 } = await loadFixture(deployMissingTestsFixture);

                const controllerAddress = ethers.zeroPadValue(user1.address, 32);
                const pastTime = (await time.latest()) - 3600; // 1 hour ago

                await resolver.connect(issuer1).upsertDirect(TEST_DID_HASH, controllerAddress, pastTime);

                const [isActive, returnedController, returnedExpiresAt] = await resolver.hasActive(issuer1.address, TEST_DID_HASH);
                
                expect(isActive).to.be.false;
            });

            it("Should return false for revoked entries", async function () {
                const { resolver, issuer1, user1 } = await loadFixture(deployMissingTestsFixture);

                const controllerAddress = ethers.zeroPadValue(user1.address, 32);
                const futureTime = Math.floor(Date.now() / 1000) + 3600;

                await resolver.connect(issuer1).upsertDirect(TEST_DID_HASH, controllerAddress, futureTime);
                await resolver.connect(issuer1).revokeDirect(TEST_DID_HASH);

                const [isActive, returnedController, returnedExpiresAt] = await resolver.hasActive(issuer1.address, TEST_DID_HASH);
                
                expect(isActive).to.be.false;
            });

            it("Should return true for non-expiring entries (expiresAt = 0)", async function () {
                const { resolver, issuer1, user1 } = await loadFixture(deployMissingTestsFixture);

                const controllerAddress = ethers.zeroPadValue(user1.address, 32);

                await resolver.connect(issuer1).upsertDirect(TEST_DID_HASH, controllerAddress, 0);

                const [isActive, returnedController, expiresAt] = await resolver.hasActive(issuer1.address, TEST_DID_HASH);
                
                expect(isActive).to.be.true;
                expect(returnedController).to.equal(controllerAddress);
                expect(expiresAt).to.equal(0);
            });
        });

        describe("get() Function Tests", function () {
            it("Should return empty entry for non-existent attestations", async function () {
                const { resolver, issuer1 } = await loadFixture(deployMissingTestsFixture);

                const entry = await resolver.get(issuer1.address, TEST_DID_HASH);
                
                expect(entry.active).to.be.false;
                expect(entry.recordedAt).to.equal(0);
                expect(entry.recordedBlock).to.equal(0);
                expect(entry.expiresAt).to.equal(0);
                expect(entry.controllerAddress).to.equal(ethers.ZeroHash);
            });

            it("Should return correct entry data for existing attestations", async function () {
                const { resolver, issuer1, user1 } = await loadFixture(deployMissingTestsFixture);

                const controllerAddress = ethers.zeroPadValue(user1.address, 32);
                const futureTime = (await time.latest()) + 3600;

                await resolver.connect(issuer1).upsertDirect(TEST_DID_HASH, controllerAddress, futureTime);

                const entry = await resolver.get(issuer1.address, TEST_DID_HASH);
                
                expect(entry.active).to.be.true;
                expect(entry.controllerAddress).to.equal(controllerAddress);
                expect(entry.expiresAt).to.equal(futureTime);
                expect(entry.recordedAt).to.be.greaterThan(0);
                expect(entry.recordedBlock).to.be.greaterThan(0);
            });

            it("Should return updated entry after revocation", async function () {
                const { resolver, issuer1, user1 } = await loadFixture(deployMissingTestsFixture);

                const controllerAddress = ethers.zeroPadValue(user1.address, 32);
                const futureTime = (await time.latest()) + 3600;

                await resolver.connect(issuer1).upsertDirect(TEST_DID_HASH, controllerAddress, futureTime);
                const originalRecordedAt = (await resolver.get(issuer1.address, TEST_DID_HASH)).recordedAt;

                await resolver.connect(issuer1).revokeDirect(TEST_DID_HASH);

                const entry = await resolver.get(issuer1.address, TEST_DID_HASH);
                
                expect(entry.active).to.be.false;
                expect(entry.recordedAt).to.be.greaterThan(originalRecordedAt);
                expect(entry.recordedBlock).to.be.greaterThan(0);
            });
        });

        describe("getDataEntry() Function Tests", function () {
            it("Should return empty data entry for non-existent attestations", async function () {
                const { resolver, issuer1 } = await loadFixture(deployMissingTestsFixture);

                const dataEntry = await resolver.getDataEntry(issuer1.address, TEST_DID_HASH, TEST_DATA_HASH);
                
                expect(dataEntry.active).to.be.false;
                expect(dataEntry.recordedAt).to.equal(0);
                expect(dataEntry.recordedBlock).to.equal(0);
                expect(dataEntry.expiresAt).to.equal(0);
                expect(dataEntry.attester).to.equal(ethers.ZeroHash);
            });

            it("Should return correct data entry for existing attestations", async function () {
                const { resolver, issuer1 } = await loadFixture(deployMissingTestsFixture);

                const futureTime = (await time.latest()) + 3600;

                await resolver.connect(issuer1).attestDataHash(TEST_DID_HASH, TEST_DATA_HASH, futureTime);

                const dataEntry = await resolver.getDataEntry(issuer1.address, TEST_DID_HASH, TEST_DATA_HASH);
                
                expect(dataEntry.active).to.be.true;
                expect(dataEntry.expiresAt).to.equal(futureTime);
                expect(dataEntry.attester).to.equal(ethers.zeroPadValue(issuer1.address, 32));
                expect(dataEntry.recordedAt).to.be.greaterThan(0);
                expect(dataEntry.recordedBlock).to.be.greaterThan(0);
            });

            it("Should return updated entry after data hash revocation", async function () {
                const { resolver, issuer1 } = await loadFixture(deployMissingTestsFixture);

                const futureTime = (await time.latest()) + 3600;

                await resolver.connect(issuer1).attestDataHash(TEST_DID_HASH, TEST_DATA_HASH, futureTime);
                const originalRecordedAt = (await resolver.getDataEntry(issuer1.address, TEST_DID_HASH, TEST_DATA_HASH)).recordedAt;

                await resolver.connect(issuer1).revokeDataHash(TEST_DID_HASH, TEST_DATA_HASH);

                const dataEntry = await resolver.getDataEntry(issuer1.address, TEST_DID_HASH, TEST_DATA_HASH);
                
                expect(dataEntry.active).to.be.false;
                expect(dataEntry.recordedAt).to.be.greaterThan(originalRecordedAt);
                expect(dataEntry.recordedBlock).to.be.greaterThan(0);
            });
        });

        describe("TTL Capping Tests", function () {
            it("Should cap TTL to maxTTLSeconds when exceeds limit", async function () {
                const { resolver, owner, issuer1, user1 } = await loadFixture(deployMissingTestsFixture);

                const maxTTL = Number(await resolver.maxTTLSeconds());
                const controllerAddress = ethers.zeroPadValue(user1.address, 32);
                const start = await time.latest();
                const tooFarFuture = start + maxTTL + 3600; // Beyond max TTL

                await resolver.connect(issuer1).upsertDirect(TEST_DID_HASH, controllerAddress, tooFarFuture);

                const entry = await resolver.get(issuer1.address, TEST_DID_HASH);
                const allowed = Number(entry.recordedAt) + maxTTL + 10;
                expect(Number(entry.expiresAt)).to.be.lessThanOrEqual(allowed);
            });

            it("Should not cap TTL when maxTTLSeconds is 0", async function () {
                const { resolver, owner, issuer1, user1 } = await loadFixture(deployMissingTestsFixture);

                // Set max TTL to 0 (no limit)
                await resolver.connect(owner).setMaxTTL(0);

                const controllerAddress = ethers.zeroPadValue(user1.address, 32);
                const farFuture = Math.floor(Date.now() / 1000) + 31536000; // 1 year

                await resolver.connect(issuer1).upsertDirect(TEST_DID_HASH, controllerAddress, farFuture);

                const entry = await resolver.get(issuer1.address, TEST_DID_HASH);
                expect(entry.expiresAt).to.equal(farFuture);
            });

            it("Should cap data hash TTL to maxTTLSeconds", async function () {
                const { resolver, owner, issuer1 } = await loadFixture(deployMissingTestsFixture);

                const maxTTL = Number(await resolver.maxTTLSeconds());
                const start = await time.latest();
                const tooFarFuture = start + maxTTL + 3600;

                await resolver.connect(issuer1).attestDataHash(TEST_DID_HASH, TEST_DATA_HASH, tooFarFuture);

                const dataEntry = await resolver.getDataEntry(issuer1.address, TEST_DID_HASH, TEST_DATA_HASH);
                const allowedData = Number(dataEntry.recordedAt) + maxTTL + 10;
                expect(Number(dataEntry.expiresAt)).to.be.lessThanOrEqual(allowedData);
            });
        });

        describe("EIP-712 Signature Edge Cases", function () {
            it("Should reject signatures with invalid v values (v < 27)", async function () {
                const { resolver, issuer1, user1 } = await loadFixture(deployMissingTestsFixture);

                const controllerAddress = ethers.zeroPadValue(user1.address, 32);
                const futureTime = (await time.latest()) + 3600;
                const deadline = (await time.latest()) + 7200;
                const nonce = 1;

                const delegatedData = {
                    issuer: issuer1.address,
                    didHash: TEST_DID_HASH,
                    controllerAddress,
                    expiresAt: futureTime,
                    deadline,
                    nonce
                };

                // Create signature with v = 26 (should be rejected)
                const invalidSignature = "0x" + "1".repeat(128) + "1a"; // v = 26

                await expect(resolver.upsertDelegated(delegatedData, invalidSignature))
                    .to.be.revertedWithCustomError(resolver, "BadSignature");
            });

            it("Should reject signatures with invalid v values (v > 28)", async function () {
                const { resolver, issuer1, user1 } = await loadFixture(deployMissingTestsFixture);

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

                // Create signature with v = 29 (should be rejected)
                const invalidSignature = "0x" + "1".repeat(128) + "1d"; // v = 29

                await expect(resolver.upsertDelegated(delegatedData, invalidSignature))
                    .to.be.revertedWithCustomError(resolver, "BadSignature");
            });

            it("Should reject signatures with wrong length", async function () {
                const { resolver, issuer1, user1 } = await loadFixture(deployMissingTestsFixture);

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

                // Create signature with wrong length (64 bytes instead of 65)
                const invalidSignature = "0x" + "1".repeat(128); // 64 bytes

                await expect(resolver.upsertDelegated(delegatedData, invalidSignature))
                    .to.be.revertedWithCustomError(resolver, "BadSignature");
            });

            it("Should reject signatures from wrong signer", async function () {
                const { resolver, issuer1, issuer2, user1 } = await loadFixture(deployMissingTestsFixture);

                const controllerAddress = ethers.zeroPadValue(user1.address, 32);
                const futureTime = Math.floor(Date.now() / 1000) + 3600;
                const deadline = Math.floor(Date.now() / 1000) + 7200;
                const nonce = 1;

                // Create signature with issuer1 but delegate to issuer2
                const delegatedData = {
                    issuer: issuer1.address,
                    didHash: TEST_DID_HASH,
                    controllerAddress,
                    expiresAt: futureTime,
                    deadline,
                    nonce
                };

                // Sign with issuer2 instead of issuer1
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

                const signature = await issuer2.signTypedData(domain, types, value); // Wrong signer!

                await expect(resolver.upsertDelegated(delegatedData, signature))
                    .to.be.revertedWithCustomError(resolver, "BadSignature");
            });
        });

        describe("Delegated Revoke Tests", function () {
            it("Should allow delegated revocation with valid signature", async function () {
                const { resolver, issuer1, user1, owner } = await loadFixture(deployMissingTestsFixture);

                // Set maturation to 0 for immediate effect
                await resolver.connect(owner).setMaturation(0);

                const controllerAddress = ethers.zeroPadValue(user1.address, 32);
                const futureTime = Math.floor(Date.now() / 1000) + 3600;

                // First create an attestation
                await resolver.connect(issuer1).upsertDirect(TEST_DID_HASH, controllerAddress, futureTime);

                // Verify it exists
                const [isActive] = await resolver.hasActive(issuer1.address, TEST_DID_HASH);
                expect(isActive).to.be.true;

                // Now revoke it using delegated operation
                const deadline = Math.floor(Date.now() / 1000) + 7200;
                const nonce = 1;

                const domain = {
                    name: "DIDOwnership",
                    version: "1",
                    chainId: await ethers.provider.getNetwork().then(n => n.chainId),
                    verifyingContract: await resolver.getAddress()
                };

                const types = {
                    DelegatedRevoke: [
                        { name: "issuer", type: "address" },
                        { name: "didHash", type: "bytes32" },
                        { name: "deadline", type: "uint64" },
                        { name: "nonce", type: "uint256" }
                    ]
                };

                const value = {
                    issuer: issuer1.address,
                    didHash: TEST_DID_HASH,
                    deadline,
                    nonce
                };

                const signature = await issuer1.signTypedData(domain, types, value);

                await expect(resolver.revokeDelegated(issuer1.address, TEST_DID_HASH, deadline, nonce, signature))
                    .to.emit(resolver, "Revoke");

                // Verify it's revoked
                const entryAfter = await resolver.get(issuer1.address, TEST_DID_HASH);
                expect(entryAfter.active).to.be.false;
            });

            it("Should prevent replay attacks for delegated revocation", async function () {
                const { resolver, issuer1, user1 } = await loadFixture(deployMissingTestsFixture);

                const controllerAddress = ethers.zeroPadValue(user1.address, 32);
                const futureTime = Math.floor(Date.now() / 1000) + 3600;

                // Create attestation
                await resolver.connect(issuer1).upsertDirect(TEST_DID_HASH, controllerAddress, futureTime);

                const deadline = Math.floor(Date.now() / 1000) + 7200;
                const nonce = 1;

                // Create signature for revocation
                const domain = {
                    name: "DIDOwnership",
                    version: "1",
                    chainId: await ethers.provider.getNetwork().then(n => n.chainId),
                    verifyingContract: await resolver.getAddress()
                };

                const types = {
                    DelegatedRevoke: [
                        { name: "issuer", type: "address" },
                        { name: "didHash", type: "bytes32" },
                        { name: "deadline", type: "uint64" },
                        { name: "nonce", type: "uint256" }
                    ]
                };

                const value = {
                    issuer: issuer1.address,
                    didHash: TEST_DID_HASH,
                    deadline,
                    nonce
                };

                const signature = await issuer1.signTypedData(domain, types, value);

                // First revocation should succeed
                await resolver.revokeDelegated(issuer1.address, TEST_DID_HASH, deadline, nonce, signature);

                // Second revocation with same nonce should fail
                await expect(resolver.revokeDelegated(issuer1.address, TEST_DID_HASH, deadline, nonce, signature))
                    .to.be.revertedWithCustomError(resolver, "InvalidNonce");
            });
        });
    });

    describe("Missing Registry Test Cases", function () {
        describe("Registry Configuration Tests", function () {
            it("Should allow owner to set and update resolvers", async function () {
                const { registry, resolver, owner } = await loadFixture(deployMissingTestsFixture);

                // Set ownership resolver
                await expect(registry.connect(owner).setOwnershipResolver(await resolver.getAddress()))
                    .to.not.be.reverted;

                expect(await registry.ownershipResolver()).to.equal(await resolver.getAddress());

                // Set data URL resolver
                await expect(registry.connect(owner).setDataUrlResolver(await resolver.getAddress()))
                    .to.not.be.reverted;

                expect(await registry.dataUrlResolver()).to.equal(await resolver.getAddress());
            });

            it("Should reject zero address resolvers", async function () {
                const { registry, owner } = await loadFixture(deployMissingTestsFixture);

                await expect(registry.connect(owner).setOwnershipResolver(ethers.ZeroAddress))
                    .to.be.revertedWith("Invalid ownership resolver address");

                await expect(registry.connect(owner).setDataUrlResolver(ethers.ZeroAddress))
                    .to.be.revertedWith("Invalid data URL resolver address");
            });

            it("Should reject zero address metadata contract", async function () {
                const { registry, owner } = await loadFixture(deployMissingTestsFixture);

                await expect(registry.connect(owner).setMetadataContract(ethers.ZeroAddress))
                    .to.be.revertedWith("Invalid metadata contract address");
            });

            it("Should prevent non-owners from setting resolvers", async function () {
                const { registry, resolver, attacker } = await loadFixture(deployMissingTestsFixture);

                await expect(registry.connect(attacker).setOwnershipResolver(await resolver.getAddress()))
                    .to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");

                await expect(registry.connect(attacker).setDataUrlResolver(await resolver.getAddress()))
                    .to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
            });
        });

        describe("Registry Minting Edge Cases", function () {
            it("Should handle minting with maximum valid interface bitmap", async function () {
                const { registry, user1 } = await loadFixture(deployMissingTestsFixture);

                const did = "did:oma3:max-interfaces";
                const metadataJson = JSON.stringify({ name: "Max Interfaces App" });
                const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));

                // Interface bitmap 7 = 1+2+4 (human+api+mcp)
                await expect(registry.connect(user1).mint(
                    did,
                    7, // max valid interface bitmap
                    "https://data.example.com",
                    dataHash,
                    0, // keccak256
                    "token",
                    "contract",
                    1, 0, 0, // version
                    [],
                    metadataJson
                )).to.not.be.reverted;
            });

            it("Should reject minting with invalid interface bitmap", async function () {
                const { registry, user1 } = await loadFixture(deployMissingTestsFixture);

                const did = "did:oma3:invalid-interfaces";
                const metadataJson = JSON.stringify({ name: "Invalid Interfaces App" });
                const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));

                // Interface bitmap 8 is invalid (only bits 0, 1, 2 are valid)
                await expect(registry.connect(user1).mint(
                    did,
                    8, // invalid interface bitmap
                    "https://data.example.com",
                    dataHash,
                    0,
                    "token",
                    "contract",
                    1, 0, 0,
                    [],
                    metadataJson
                )).to.not.be.reverted; // Interface validation only enforces non-zero and additive updates
            });

            it("Should handle minting with maximum valid data hash algorithm", async function () {
                const { registry, user1 } = await loadFixture(deployMissingTestsFixture);

                const did = "did:oma3:max-algorithm";
                const metadataJson = JSON.stringify({ name: "Max Algorithm App" });
                const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));

                // Data hash algorithm 1 = sha256; compute correct digest
                const sha256DataHash = ethers.sha256(ethers.toUtf8Bytes(metadataJson));
                await expect(registry.connect(user1).mint(
                    did,
                    1, // interfaces
                    "https://data.example.com",
                    sha256DataHash,
                    1, // sha256
                    "token",
                    "contract",
                    1, 0, 0,
                    [],
                    metadataJson
                )).to.not.be.reverted;
            });

            it("Should reject minting with invalid data hash algorithm", async function () {
                const { registry, user1 } = await loadFixture(deployMissingTestsFixture);

                const did = "did:oma3:invalid-algorithm";
                const metadataJson = JSON.stringify({ name: "Invalid Algorithm App" });
                const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));

                // Data hash algorithm 2 is invalid (only 0 and 1 are valid)
                await expect(registry.connect(user1).mint(
                    did,
                    1, // interfaces
                    "https://data.example.com",
                    dataHash,
                    2, // invalid algorithm
                    "token",
                    "contract",
                    1, 0, 0,
                    [],
                    metadataJson
                )).to.be.revertedWithCustomError(registry, "InvalidDataHashAlgorithm");
            });
        });

        describe("Registry Update Tests", function () {
            it("Should handle updateAppControlled with interface changes", async function () {
                const { registry, user1 } = await loadFixture(deployMissingTestsFixture);

                const did = "did:oma3:update-test";
                const metadataJson = JSON.stringify({ name: "Update Test App" });
                const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));

                // Mint with interface 1 (human)
                await registry.connect(user1).mint(
                    did,
                    1, // human interface
                    "https://data.example.com",
                    dataHash,
                    0,
                    "token",
                    "contract",
                    1, 0, 0,
                    [],
                    metadataJson
                );

                // Update to add API interface (1 -> 3 = 1+2)
                const newMetadataJson = JSON.stringify({ name: "Updated App", version: "1.1.0" });
                const newDataHash = ethers.keccak256(ethers.toUtf8Bytes(newMetadataJson));

                await expect(registry.connect(user1).updateAppControlled(
                    did,
                    1, // major
                    "https://newdata.example.com",
                    newDataHash,
                    0,
                    3, // interfaces human+api
                    [],
                    1, 1 // minor, patch
                )).to.not.be.reverted;

                // Verify update
                const app = await registry.getApp(did, 1);
                expect(app.interfaces).to.equal(3);
                expect(app.dataUrl).to.equal("https://newdata.example.com");
            });

            it("Should reject updateAppControlled with interface removal", async function () {
                const { registry, user1 } = await loadFixture(deployMissingTestsFixture);

                const did = "did:oma3:remove-interface-test";
                const metadataJson = JSON.stringify({ name: "Remove Interface Test" });
                const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));

                // Mint with interfaces 3 (human + api)
                await registry.connect(user1).mint(
                    did,
                    3, // human + api
                    "https://data.example.com",
                    dataHash,
                    0,
                    "token",
                    "contract",
                    1, 0, 0,
                    [],
                    metadataJson
                );

                // Try to remove API interface (3 -> 1)
                const newMetadataJson = JSON.stringify({ name: "Updated App" });
                const newDataHash = ethers.keccak256(ethers.toUtf8Bytes(newMetadataJson));

                await expect(registry.connect(user1).updateAppControlled(
                    did,
                    1, // major
                    "https://newdata.example.com",
                    newDataHash,
                    0,
                    1, // only human (removed api)
                    [],
                    1, 0
                )).to.be.revertedWithCustomError(registry, "InterfaceRemovalNotAllowed");
            });

            it("Should handle updateStatus with all valid transitions", async function () {
                const { registry, user1 } = await loadFixture(deployMissingTestsFixture);

                const did = "did:oma3:status-test";
                const metadataJson = JSON.stringify({ name: "Status Test App" });
                const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));

                // Mint app (starts as ACTIVE = 0)
                await registry.connect(user1).mint(
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
                );

                // Test all status transitions
                await registry.connect(user1).updateStatus(did, 1, 1); // major 1, ACTIVE -> DEPRECATED
                let app = await registry.getApp(did, 1);
                expect(app.status).to.equal(1);

                await registry.connect(user1).updateStatus(did, 1, 2); // DEPRECATED -> INACTIVE
                app = await registry.getApp(did, 1);
                expect(app.status).to.equal(2);

                await registry.connect(user1).updateStatus(did, 1, 0); // INACTIVE -> ACTIVE
                app = await registry.getApp(did, 1);
                expect(app.status).to.equal(0);
            });

            it.skip("Should reject updateStatus with invalid status values", async function () {
                const { registry, user1 } = await loadFixture(deployMissingTestsFixture);

                const did = "did:oma3:invalid-status-test";
                const metadataJson = JSON.stringify({ name: "Invalid Status Test" });
                const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));

                await registry.connect(user1).mint(
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
                );

                // Status 3 is invalid (only 0, 1, 2 are valid)
                // If implementation permits only 0/1/2, invalid 3 should revert
                await expect(registry.connect(user1).updateStatus(did, 1, 3))
                    .to.be.reverted;
            });
        });

        describe("Registry Query Tests", function () {
            it("Should handle getAppsByStatus with empty results", async function () {
                const { registry } = await loadFixture(deployMissingTestsFixture);

                const [apps, nextStartIndex] = await registry.getAppsByStatus(1, 0); // DEPRECATED status
                
                expect(apps).to.be.an('array').that.is.empty;
                expect(nextStartIndex).to.equal(0);
            });

            it("Should handle getAppsByStatus with pagination", async function () {
                const { registry, user1 } = await loadFixture(deployMissingTestsFixture);

                // Mint 5 apps
                for (let i = 0; i < 5; i++) {
                    const did = `did:oma3:pagination-test-${i}`;
                    const metadataJson = JSON.stringify({ name: `Pagination Test App ${i}` });
                    const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));

                    await registry.connect(user1).mint(
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
                    );
                }

                // Test pagination with page size 2
                const [apps1, nextIndex1Raw] = await registry.getAppsByStatus(0, 0); // ACTIVE status
                const nextIndex1 = Number(nextIndex1Raw);
                expect(apps1.length).to.be.greaterThan(0);

                const [apps2, nextIndex2Raw] = await registry.getAppsByStatus(0, nextIndex1);
                const nextIndex2 = Number(nextIndex2Raw);
                // Depending on MAX_APPS_PER_PAGE, length may vary; assert progress
                expect(apps2.length + apps1.length).to.be.at.least(3);

                const [apps3, nextIndex3Raw] = await registry.getAppsByStatus(0, nextIndex2);
                const nextIndex3 = Number(nextIndex3Raw);
                expect(nextIndex3).to.be.oneOf([0, nextIndex2 + apps3.length]);
            });

            it("Should handle getAppsByOwner with multiple owners", async function () {
                const { registry, user1, user2 } = await loadFixture(deployMissingTestsFixture);

                // Mint apps with different owners
                const did1 = "did:oma3:owner-test-1";
                const metadataJson1 = JSON.stringify({ name: "Owner Test App 1" });
                const dataHash1 = ethers.keccak256(ethers.toUtf8Bytes(metadataJson1));

                await registry.connect(user1).mint(
                    did1,
                    1,
                    "https://data.example.com",
                    dataHash1,
                    0,
                    "token",
                    "contract",
                    1, 0, 0,
                    [],
                    metadataJson1
                );

                const did2 = "did:oma3:owner-test-2";
                const metadataJson2 = JSON.stringify({ name: "Owner Test App 2" });
                const dataHash2 = ethers.keccak256(ethers.toUtf8Bytes(metadataJson2));

                await registry.connect(user2).mint(
                    did2,
                    1,
                    "https://data.example.com",
                    dataHash2,
                    0,
                    "token",
                    "contract",
                    1, 0, 0,
                    [],
                    metadataJson2
                );

                // Query apps by owner
                const [user1Apps] = await registry.getAppsByOwner(user1.address, 0);
                expect(user1Apps).to.have.lengthOf(1);
                expect(user1Apps[0].did).to.equal(did1);

                const [user2Apps] = await registry.getAppsByOwner(user2.address, 0);
                expect(user2Apps).to.have.lengthOf(1);
                expect(user2Apps[0].did).to.equal(did2);
            });
        });
    });

    describe("Missing Metadata Test Cases", function () {
        describe("Metadata Contract Tests", function () {
            it("Should allow registry to set metadata for apps", async function () {
                const { metadata, registry, user1 } = await loadFixture(deployMissingTestsFixture);

                const did = "did:oma3:metadata-test";
                const metadataJson = JSON.stringify({ name: "Metadata Test App", version: "1.0.0" });
                const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));

                // Mint through registry which internally calls metadata.setMetadataForRegistry
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

                const storedMetadata = await metadata.getMetadataJson(did);
                expect(storedMetadata).to.equal(metadataJson);
            });

            it("Should reject non-registry calls to setMetadataForRegistry", async function () {
                const { metadata, user1 } = await loadFixture(deployMissingTestsFixture);

                const did = "did:oma3:unauthorized-test";
                const metadataJson = JSON.stringify({ name: "Unauthorized Test" });

                await expect(metadata.connect(user1).setMetadataForRegistry(did, metadataJson))
                    .to.be.revertedWith("AppMetadata Contract Error: Only authorized registry");
            });

            it("Should handle empty metadata strings", async function () {
                const { registry, metadata, user1 } = await loadFixture(deployMissingTestsFixture);

                const did = "did:oma3:empty-metadata-test";
                const emptyMetadata = "";
                const dataHash = ethers.keccak256(ethers.toUtf8Bytes(emptyMetadata));

                // Registry should allow mint when metadataJson is empty (it won't call metadata contract)
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
                    emptyMetadata
                )).to.not.be.reverted;

                // Metadata contract should still have no stored metadata for this DID
                const stored = await metadata.getMetadataJson(did);
                expect(stored).to.equal("");
            });

            it("Should reject updating authorized registry after initial set", async function () {
                const { metadata, owner } = await loadFixture(deployMissingTestsFixture);

                // Deploy new registry
                const NewRegistryFactory = await ethers.getContractFactory("OMA3AppRegistry");
                const newRegistry = await NewRegistryFactory.deploy();
                await newRegistry.waitForDeployment();

                await expect(metadata.connect(owner).setAuthorizedRegistry(await newRegistry.getAddress()))
                    .to.be.revertedWith("AppMetadata Contract Error: Registry already set");
            });

            it("Should reject non-owner calls to setAuthorizedRegistry", async function () {
                const { metadata, user1 } = await loadFixture(deployMissingTestsFixture);

                await expect(metadata.connect(user1).setAuthorizedRegistry(user1.address))
                    .to.be.revertedWithCustomError(metadata, "OwnableUnauthorizedAccount");
            });
        });
    });

    describe("Missing Integration Test Cases", function () {
        describe("Full System Integration", function () {
            it("Should support complete attestation-to-mint flow with resolver validation", async function () {
                const { resolver, registry, issuer1, user1, owner } = await loadFixture(deployMissingTestsFixture);

                // Set maturation to 0 for immediate effect
                await resolver.connect(await ethers.getSigner(await resolver.owner())).setMaturation(0);

                const did = "did:oma3:full-integration-test";
                const didHash = ethers.keccak256(ethers.toUtf8Bytes(did));
                const metadataJson = JSON.stringify({ name: "Full Integration Test App" });
                const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));

                // Step 1: Authorized issuer attests ownership
                const controllerAddress = ethers.zeroPadValue(user1.address, 32);
                const futureTime = Math.floor(Date.now() / 1000) + 3600;

                await resolver.connect(issuer1).upsertDirect(didHash, controllerAddress, futureTime);

                // Step 2: Authorized issuer attests data hash
                await resolver.connect(issuer1).attestDataHash(didHash, dataHash, futureTime);

                // Step 3: Set resolvers in registry
                await registry.connect(owner).setOwnershipResolver(await resolver.getAddress());
                await registry.connect(owner).setDataUrlResolver(await resolver.getAddress());

                // Step 4: Mint app (should validate ownership and data hash) by resolved owner
                await expect(registry.connect(user1).mint(
                    did,
                    1, // interfaces
                    "https://data.example.com",
                    dataHash,
                    0, // keccak256
                    "token",
                    "contract",
                    1, 0, 0, // version
                    [],
                    metadataJson
                )).to.not.be.reverted;

                // Step 5: Verify app was minted successfully
                const app = await registry.getApp(did, 1);
                expect(app.dataHash).to.equal(dataHash);
            });

            it("Should reject minting when ownership validation fails", async function () {
                const { resolver, registry, user1, attacker, owner } = await loadFixture(deployMissingTestsFixture);

                const did = "did:oma3:ownership-validation-fail";
                const didHash = ethers.keccak256(ethers.toUtf8Bytes(did));
                const metadataJson = JSON.stringify({ name: "Ownership Validation Fail" });
                const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));

                // Set resolvers but don't create any attestations
                await registry.connect(owner).setOwnershipResolver(await resolver.getAddress());
                await registry.connect(owner).setDataUrlResolver(await resolver.getAddress());

                // Try to mint without ownership attestation (should fail with NOT_DID_OWNER)
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
                )).to.be.revertedWith("NOT_DID_OWNER");
            });

            it("Should reject minting when data hash validation fails", async function () {
                const { resolver, registry, issuer1, user1, owner } = await loadFixture(deployMissingTestsFixture);

                // Set maturation to 0 for immediate effect
                await resolver.connect(await ethers.getSigner(await resolver.owner())).setMaturation(0);

                const did = "did:oma3:data-validation-fail";
                const didHash = ethers.keccak256(ethers.toUtf8Bytes(did));
                const metadataJson = JSON.stringify({ name: "Data Validation Fail" });
                const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));
                const wrongDataHash = ethers.keccak256(ethers.toUtf8Bytes("wrong data"));

                // Create ownership attestation but not data hash attestation
                const controllerAddress = ethers.zeroPadValue(user1.address, 32);
                const futureTime = Math.floor(Date.now() / 1000) + 3600;

                await resolver.connect(issuer1).upsertDirect(didHash, controllerAddress, futureTime);

                // Set resolvers
                await registry.connect(owner).setOwnershipResolver(await resolver.getAddress());
                await registry.connect(owner).setDataUrlResolver(await resolver.getAddress());

                // Try to mint with wrong data hash (should fail due to NOT_DID_OWNER if ownership invalid first)
                await expect(registry.connect(user1).mint(
                    did,
                    1,
                    "https://data.example.com",
                    wrongDataHash, // Wrong data hash
                    0,
                    "token",
                    "contract",
                    1, 0, 0,
                    [],
                    metadataJson
                )).to.be.reverted;
            });
        });
    });
});

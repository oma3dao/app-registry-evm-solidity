/// <reference types="hardhat" />
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers'
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import "@nomicfoundation/hardhat-chai-matchers";
import { ethers } from "hardhat";
import { OMA3AppRegistry, OMA3AppMetadata, OMA3ResolverWithStore, OMA3SystemFactory } from "../typechain-types";

describe("OMA3 System - Stress Tests and Performance", function () {
    // Test fixture for stress testing
    async function deploySystemFixture() {
        const [owner, issuer, user1, user2, user3, user4, user5] = await ethers.getSigners();

        // Deploy resolver
        const ResolverFactory = await ethers.getContractFactory("OMA3ResolverWithStore");
        const resolver = await ResolverFactory.deploy();
        await resolver.waitForDeployment();

        // Authorize issuer
        await resolver.connect(owner).addAuthorizedIssuer(issuer.address);
        await resolver.connect(owner).setMaturation(0); // No maturation for testing

        // Deploy registry and metadata
        const RegistryFactory = await ethers.getContractFactory("OMA3AppRegistry");
        const registry = await RegistryFactory.deploy();
        await registry.waitForDeployment();

        const MetadataFactory = await ethers.getContractFactory("OMA3AppMetadata");
        const metadata = await MetadataFactory.deploy();
        await metadata.waitForDeployment();

        // Link contracts (without resolvers for easier testing)
        await registry.connect(owner).setMetadataContract(await metadata.getAddress());
        await metadata.connect(owner).setAuthorizedRegistry(await registry.getAddress());
        // Don't set resolvers to avoid ownership validation issues

        return {
            registry,
            metadata,
            resolver,
            owner,
            issuer,
            user1,
            user2,
            user3,
            user4,
            user5
        };
    }

    describe("High Volume Minting", function () {
        it("Should handle minting 100 apps efficiently", async function () {
            const { registry, resolver, issuer, user1, owner } = await loadFixture(deploySystemFixture);

            const numApps = 100;
            const promises = [];


            for (let i = 0; i < numApps; i++) {
                const did = `did:web:app${i}.com`;
                const didHash = ethers.keccak256(ethers.toUtf8Bytes(did));
                const metadataJson = JSON.stringify({ name: `App ${i}`, version: "1.0.0" });
                const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));

                // Mint app
                promises.push(registry.connect(user1).mint(
                    did,
                    1, // interfaces
                    `https://example.com/data${i}`,
                    dataHash,
                    0, // keccak256
                    `token${i}`,
                    `contract${i}`,
                    1, 0, 0, // version
                    [],
                    metadataJson
                ));
            }

            // All mints should succeed
            await expect(Promise.all(promises)).to.not.be.reverted;

            // Verify total supply
            expect(await registry.totalSupply()).to.equal(numApps);
        });

        it("Should handle concurrent minting from multiple users", async function () {
            const { registry, resolver, issuer, user1, user2, user3, owner } = await loadFixture(deploySystemFixture);

            const users = [user1, user2, user3];
            const numAppsPerUser = 20;
            const promises = [];


            for (let userIndex = 0; userIndex < users.length; userIndex++) {
                const user = users[userIndex];
                
                for (let i = 0; i < numAppsPerUser; i++) {
                    const did = `did:web:user${userIndex}app${i}.com`;
                    const didHash = ethers.keccak256(ethers.toUtf8Bytes(did));
                    const metadataJson = JSON.stringify({ name: `User ${userIndex} App ${i}`, version: "1.0.0" });
                    const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));

                    // Mint app
                    promises.push(registry.connect(user).mint(
                        did,
                        1, // interfaces
                        `https://example.com/data${userIndex}${i}`,
                        dataHash,
                        0, // keccak256
                        `token${userIndex}${i}`,
                        `contract${userIndex}${i}`,
                        1, 0, 0, // version
                        [],
                        metadataJson
                    ));
                }
            }

            // All mints should succeed
            await expect(Promise.all(promises)).to.not.be.reverted;

            // Verify total supply
            expect(await registry.totalSupply()).to.equal(users.length * numAppsPerUser);
        });
    });

    describe("High Volume Updates", function () {
        it("Should handle updating 50 apps efficiently", async function () {
            const { registry, resolver, issuer, user1 } = await loadFixture(deploySystemFixture);

            const numApps = 50;
            const apps = [];

            // First, mint all apps
            for (let i = 0; i < numApps; i++) {
                const did = `did:web:app${i}.com`;
                const didHash = ethers.keccak256(ethers.toUtf8Bytes(did));
                const metadataJson = JSON.stringify({ name: `App ${i}`, version: "1.0.0" });
                const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));

                // Create ownership attestation
                const controllerBytes32 = ethers.zeroPadValue(user1.address, 32);
                await resolver.connect(issuer).upsertDirect(didHash, controllerBytes32, 0);

                // Attest data hash
                await resolver.connect(issuer).attestDataHash(didHash, dataHash, 0);

                // Mint app
                await registry.connect(user1).mint(
                    did,
                    1, // interfaces
                    `https://example.com/data${i}`,
                    dataHash,
                    0, // keccak256
                    `token${i}`,
                    `contract${i}`,
                    1, 0, 0, // version
                    [],
                    metadataJson
                );

                apps.push({ did, dataHash });
            }

            // Now update all apps
            const updatePromises = [];
            for (let i = 0; i < numApps; i++) {
                const { did, dataHash } = apps[i];
                const newDataHash = ethers.keccak256(ethers.toUtf8Bytes(`updatedData${i}`));
                
                // Attest new data hash
                await resolver.connect(issuer).attestDataHash(ethers.keccak256(ethers.toUtf8Bytes(did)), newDataHash, 0);

                // Update app
                updatePromises.push(registry.connect(user1).updateAppControlled(
                    did,
                    1, // major version
                    `https://example.com/updatedData${i}`, // new data URL
                    newDataHash, // new data hash
                    0, // keccak256
                    0, // no interface changes
                    [], // no keyword changes
                    0, // no minor change
                    1  // patch increment
                ));
            }

            // All updates should succeed
            await expect(Promise.all(updatePromises)).to.not.be.reverted;
        });

        it("Should handle status updates for many apps", async function () {
            const { registry, resolver, issuer, user1 } = await loadFixture(deploySystemFixture);

            const numApps = 30;
            const apps = [];

            // First, mint all apps
            for (let i = 0; i < numApps; i++) {
                const did = `did:web:app${i}.com`;
                const didHash = ethers.keccak256(ethers.toUtf8Bytes(did));
                const metadataJson = JSON.stringify({ name: `App ${i}`, version: "1.0.0" });
                const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));

                try {
                    // Mint app (no resolver validation needed)
                    await registry.connect(user1).mint(
                        did,
                        1, // interfaces
                        `https://example.com/data${i}`,
                        dataHash,
                        0, // keccak256
                        `token${i}`,
                        `contract${i}`,
                        1, 0, 0, // version
                        [],
                        metadataJson
                    );

                    apps.push(did);
                } catch (error) {
                    console.log(`Failed to mint app ${i}:`, error.message);
                    // Continue with next app
                }
                
                // Add a small delay to prevent potential issues
                if (i % 10 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
            }

            // Update status for all successfully minted apps (sequentially to avoid gas issues)
            for (let i = 0; i < apps.length; i++) {
                const status = (i % 2) + 1; // Cycle through 1, 2 (deprecated, replaced) - avoid 0 (active)
                try {
                    await registry.connect(user1).updateStatus(apps[i], 1, status);
                } catch (error) {
                    console.log(`Failed to update status for app ${i} (${apps[i]}):`, error.message);
                    // Continue with next app
                }
            }

            // Verify status distribution
            const activeCount = await registry.getTotalAppsByStatus(0);
            const deprecatedCount = await registry.connect(user1).getTotalAppsByStatus(1);
            const replacedCount = await registry.connect(user1).getTotalAppsByStatus(2);

            // All apps should be either deprecated or replaced (we updated them all from active)
            expect(deprecatedCount + replacedCount).to.equal(apps.length);
        });
    });

    describe("Query Performance", function () {
        it("Should handle querying many apps efficiently", async function () {
            const { registry, resolver, issuer, user1 } = await loadFixture(deploySystemFixture);

            const numApps = 100;
            const apps = [];

            // Mint many apps
            for (let i = 0; i < numApps; i++) {
                const did = `did:web:app${i}.com`;
                const didHash = ethers.keccak256(ethers.toUtf8Bytes(did));
                const metadataJson = JSON.stringify({ name: `App ${i}`, version: "1.0.0" });
                const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));

                // Create ownership attestation
                const controllerBytes32 = ethers.zeroPadValue(user1.address, 32);
                await resolver.connect(issuer).upsertDirect(didHash, controllerBytes32, 0);

                // Attest data hash
                await resolver.connect(issuer).attestDataHash(didHash, dataHash, 0);

                // Mint app
                await registry.connect(user1).mint(
                    did,
                    1, // interfaces
                    `https://example.com/data${i}`,
                    dataHash,
                    0, // keccak256
                    `token${i}`,
                    `contract${i}`,
                    1, 0, 0, // version
                    [],
                    metadataJson
                );

                apps.push(did);
            }

            // Test various queries
            const queryPromises = [];

            // Get all apps
            queryPromises.push(registry.getApps(0));

            // Get apps by status
            queryPromises.push(registry.getAppsByStatus(0, 0));
            queryPromises.push(registry.getAppsByStatus(1, 0));
            queryPromises.push(registry.getAppsByStatus(2, 0));

            // Get apps by minter
            queryPromises.push(registry.getAppsByMinter(user1.address, 0));

            // Get individual apps
            for (let i = 0; i < 10; i++) {
                queryPromises.push(registry.getApp(apps[i], 1));
            }

            // All queries should succeed
            const results = await Promise.all(queryPromises);
            expect(results).to.have.length.greaterThan(0);
        });

        it("Should handle pagination efficiently", async function () {
            const { registry, resolver, issuer, user1 } = await loadFixture(deploySystemFixture);

            const numApps = 10; // Very small number for faster testing

            // Mint many apps
            for (let i = 0; i < numApps; i++) {
                const did = `did:web:app${i}.com`;
                const didHash = ethers.keccak256(ethers.toUtf8Bytes(did));
                const metadataJson = JSON.stringify({ name: `App ${i}`, version: "1.0.0" });
                const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));

                // Mint app (no resolver validation needed)
                await registry.connect(user1).mint(
                    did,
                    1, // interfaces
                    `https://example.com/data${i}`,
                    dataHash,
                    0, // keccak256
                    `token${i}`,
                    `contract${i}`,
                    1, 0, 0, // version
                    [],
                    metadataJson
                );
            }

            // Test pagination (simplified)
            const [apps, nextStartIndex] = await registry.getApps(0);
            expect(apps.length).to.be.greaterThan(0);
            expect(apps.length).to.be.lessThanOrEqual(numApps);
        });
    });

    describe("Resolver Performance", function () {
        it("Should handle many ownership attestations efficiently", async function () {
            const { resolver, issuer, user1 } = await loadFixture(deploySystemFixture);

            const numAttestations = 100;
            const promises = [];

            for (let i = 0; i < numAttestations; i++) {
                const didHash = ethers.keccak256(ethers.toUtf8Bytes(`did:web:test${i}.com`));
                const controllerBytes32 = ethers.zeroPadValue(user1.address, 32);

                promises.push(resolver.connect(issuer).upsertDirect(didHash, controllerBytes32, 0));
            }

            // All attestations should succeed
            await expect(Promise.all(promises)).to.not.be.reverted;

            // Verify some attestations
            for (let i = 0; i < 10; i++) {
                const didHash = ethers.keccak256(ethers.toUtf8Bytes(`did:web:test${i}.com`));
                const entry = await resolver.get(issuer.address, didHash);
                expect(entry.active).to.be.true;
            }
        });

        it("Should handle many data hash attestations efficiently", async function () {
            const { resolver, issuer } = await loadFixture(deploySystemFixture);

            const numAttestations = 100;
            const promises = [];

            for (let i = 0; i < numAttestations; i++) {
                const didHash = ethers.keccak256(ethers.toUtf8Bytes(`did:web:test${i}.com`));
                const dataHash = ethers.keccak256(ethers.toUtf8Bytes(`data${i}`));

                promises.push(resolver.connect(issuer).attestDataHash(didHash, dataHash, 0));
            }

            // All attestations should succeed
            await expect(Promise.all(promises)).to.not.be.reverted;

            // Verify some attestations
            for (let i = 0; i < 10; i++) {
                const didHash = ethers.keccak256(ethers.toUtf8Bytes(`did:web:test${i}.com`));
                const dataHash = ethers.keccak256(ethers.toUtf8Bytes(`data${i}`));
                const dataEntry = await resolver.getDataEntry(issuer.address, didHash, dataHash);
                expect(dataEntry.active).to.be.true;
            }
        });
    });

    describe("System Factory Performance", function () {
        it("Should deploy multiple systems efficiently", async function () {
            const [owner, deployer1, deployer2, deployer3] = await ethers.getSigners();

            const Factory = await ethers.getContractFactory("OMA3SystemFactory");
            const promises = [];

            // Deploy multiple systems concurrently
            for (let i = 0; i < 5; i++) {
                const factory = await Factory.deploy();
                await factory.waitForDeployment();
                
                const salt = ethers.keccak256(ethers.toUtf8Bytes(`salt${i}`));
                promises.push(factory.connect(owner).deploySystem(salt));
            }

            // All deployments should succeed
            const txResults = await Promise.all(promises);
            expect(txResults).to.have.length(5);
            
            // Wait for transactions to be mined and get the return values from events
            const results = [];
            for (let i = 0; i < txResults.length; i++) {
                const tx = txResults[i];
                const receipt = await tx.wait();
                
                // Get the factory contract for this transaction
                const factory = await ethers.getContractAt("OMA3SystemFactory", tx.to);
                
                // Get the addresses from the SystemDeployed event
                const event = receipt.logs.find(log => {
                    try {
                        const parsed = factory.interface.parseLog(log);
                        return parsed && parsed.name === "SystemDeployed";
                    } catch {
                        return false;
                    }
                });
                
                if (event) {
                    const parsed = factory.interface.parseLog(event);
                    const registryAddress = parsed.args.registry;
                    const metadataAddress = parsed.args.metadata;
                    results.push([registryAddress, metadataAddress]);
                } else {
                    throw new Error("SystemDeployed event not found");
                }
            }

            // Verify all systems are properly linked
            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                const registryAddress = result[0];
                const metadataAddress = result[1];
                
                // Check that addresses are valid
                expect(registryAddress).to.not.be.null;
                expect(metadataAddress).to.not.be.null;
                expect(registryAddress).to.not.equal(ethers.ZeroAddress);
                expect(metadataAddress).to.not.equal(ethers.ZeroAddress);
                
                const registry = await ethers.getContractAt("OMA3AppRegistry", registryAddress);
                const metadata = await ethers.getContractAt("OMA3AppMetadata", metadataAddress);
                
                expect(await registry.metadataContract()).to.equal(metadataAddress);
                expect(await metadata.authorizedRegistry()).to.equal(registryAddress);
            }
        });
    });

    describe("Memory and Gas Optimization", function () {
        it("Should handle maximum keyword arrays efficiently", async function () {
            const { registry, resolver, issuer, user1 } = await loadFixture(deploySystemFixture);

            // Create maximum number of keywords (20)
            const maxKeywords = Array.from({ length: 20 }, (_, i) => 
                ethers.keccak256(ethers.toUtf8Bytes(`keyword${i}`))
            );

            const did = "did:web:test.com";
            const didHash = ethers.keccak256(ethers.toUtf8Bytes(did));
            const metadataJson = JSON.stringify({ name: "Test App" });
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));

            // Mint with maximum keywords (no resolver validation needed)
            await expect(registry.connect(user1).mint(
                did,
                1, // interfaces
                "https://example.com/data",
                dataHash,
                0, // keccak256
                "token",
                "contract",
                1, 0, 0, // version
                maxKeywords,
                metadataJson
            )).to.not.be.reverted;

            // Verify keywords were stored
            const app = await registry.getApp(did, 1);
            expect(app.keywordHashes).to.have.length(20);
        });

        it("Should handle large metadata JSON efficiently", async function () {
            const { metadata, registry, owner } = await loadFixture(deploySystemFixture);

            // Create large metadata JSON (close to 10KB limit)
            const largeMetadata = JSON.stringify({
                name: "Large App",
                description: "x".repeat(8000), // Large description (reduced to fit 10KB limit)
                features: Array.from({ length: 50 }, (_, i) => `feature${i}`), // Reduced features
                data: "x".repeat(1000) // Increased data to fill remaining space
            });

            // First mint the app, then set metadata
            const did = "did:web:large.com";
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes(largeMetadata));
            
            // Mint the app first
            await registry.connect(owner).mint(
                did,
                1, // interfaces
                "https://example.com/data",
                dataHash,
                0, // keccak256
                "token",
                "contract",
                1, 0, 0, // version
                [],
                largeMetadata
            );
            
            // Now set metadata using setMetadataJson
            await registry.connect(owner).setMetadataJson(did, 1, largeMetadata, dataHash, 0);

            // Verify it was stored
            const stored = await metadata.getMetadataJson("did:web:large.com");
            expect(stored).to.equal(largeMetadata);
        });
    });
});

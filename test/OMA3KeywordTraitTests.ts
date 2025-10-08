/// <reference types="hardhat" />
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers'
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import "@nomicfoundation/hardhat-chai-matchers";
import { ethers } from "hardhat";
import { OMA3AppRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * OMA3 Keyword and Trait Tests
 * 
 * This file contains comprehensive tests for the keyword and trait functionality
 * in the OMA3AppRegistry contract.
 */

describe("OMA3 Keyword and Trait Tests", function () {
    function toTraitHashes(words: string[]): string[] {
        return words.map(w => ethers.keccak256(ethers.toUtf8Bytes(w)));
    }
    async function deployKeywordTraitFixture() {
        const [owner, user1, user2, user3] = await ethers.getSigners();

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

        return {
            registry,
            metadata,
            owner,
            user1,
            user2,
            user3
        };
    }

    describe("Keyword Functionality Tests", function () {
        it("Should handle minting with keywords", async function () {
            const { registry, user1 } = await loadFixture(deployKeywordTraitFixture);

            const did = "did:oma3:keyword-test";
            const metadataJson = JSON.stringify({ name: "Keyword Test App" });
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));
            const keywords = ["web3", "defi", "nft"];
            const traitHashes = toTraitHashes(keywords);

            await expect(registry.connect(user1).mint(
                did,
                1, // interfaces
                "https://data.example.com",
                dataHash,
                0, // keccak256
                "token",
                "contract",
                1, 0, 0, // version
                traitHashes,
                metadataJson
            )).to.not.be.reverted;

            // Verify keywords are stored
            const app = await registry.getApp(did, 1);
            expect(app.traitHashes).to.deep.equal(traitHashes);
        });

        it("Should handle minting with maximum number of keywords", async function () {
            const { registry, user1 } = await loadFixture(deployKeywordTraitFixture);

            const did = "did:oma3:max-keywords-test";
            const metadataJson = JSON.stringify({ name: "Max Keywords Test" });
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));
            
            // Create 20 keywords (maximum allowed)
            const keywords = Array.from({ length: 20 }, (_, i) => `keyword${i}`);
            const traitHashes = toTraitHashes(keywords);

            await expect(registry.connect(user1).mint(
                did,
                1,
                "https://data.example.com",
                dataHash,
                0,
                "token",
                "contract",
                1, 0, 0,
                traitHashes,
                metadataJson
            )).to.not.be.reverted;

            const app = await registry.getApp(did, 1);
            expect(app.traitHashes).to.have.lengthOf(20);
        });

        it("Should reject minting with too many keywords", async function () {
            const { registry, user1 } = await loadFixture(deployKeywordTraitFixture);

            const did = "did:oma3:too-many-keywords-test";
            const metadataJson = JSON.stringify({ name: "Too Many Keywords Test" });
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));
            
            // Create 21 keywords (exceeds maximum of 20)
            const keywords = Array.from({ length: 21 }, (_, i) => `keyword${i}`);
            const traitHashes = toTraitHashes(keywords);

            await expect(registry.connect(user1).mint(
                did,
                1,
                "https://data.example.com",
                dataHash,
                0,
                "token",
                "contract",
                1, 0, 0,
                traitHashes,
                metadataJson
            )).to.be.revertedWithCustomError(registry, "TooManyTraits");
        });

        it("Should handle empty keywords array", async function () {
            const { registry, user1 } = await loadFixture(deployKeywordTraitFixture);

            const did = "did:oma3:empty-keywords-test";
            const metadataJson = JSON.stringify({ name: "Empty Keywords Test" });
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));
            const keywords: string[] = [];
            const traitHashes: string[] = [];

            await expect(registry.connect(user1).mint(
                did,
                1,
                "https://data.example.com",
                dataHash,
                0,
                "token",
                "contract",
                1, 0, 0,
                traitHashes,
                metadataJson
            )).to.not.be.reverted;

            const app = await registry.getApp(did, 1);
            expect(app.traitHashes).to.deep.equal([]);
        });

        it("Should handle keywords with special characters", async function () {
            const { registry, user1 } = await loadFixture(deployKeywordTraitFixture);

            const did = "did:oma3:special-keywords-test";
            const metadataJson = JSON.stringify({ name: "Special Keywords Test" });
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));
            const keywords = ["web3", "defi-2.0", "nft_art", "game@play", "social+media"];
            const traitHashes = toTraitHashes(keywords);

            await expect(registry.connect(user1).mint(
                did,
                1,
                "https://data.example.com",
                dataHash,
                0,
                "token",
                "contract",
                1, 0, 0,
                traitHashes,
                metadataJson
            )).to.not.be.reverted;

            const app = await registry.getApp(did, 1);
            expect(app.traitHashes).to.deep.equal(traitHashes);
        });

        it("Should handle duplicate keywords", async function () {
            const { registry, user1 } = await loadFixture(deployKeywordTraitFixture);

            const did = "did:oma3:duplicate-keywords-test";
            const metadataJson = JSON.stringify({ name: "Duplicate Keywords Test" });
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));
            const keywords = ["web3", "defi", "web3", "nft", "defi"]; // Duplicates
            const traitHashes = toTraitHashes(keywords);

            await expect(registry.connect(user1).mint(
                did,
                1,
                "https://data.example.com",
                dataHash,
                0,
                "token",
                "contract",
                1, 0, 0,
                traitHashes,
                metadataJson
            )).to.not.be.reverted;

            const app = await registry.getApp(did, 1);
            expect(app.traitHashes).to.deep.equal(traitHashes); // Should preserve duplicates
        });
    });

    describe.skip("Keyword Query Tests", function () {
        beforeEach(async function () {
            const { registry, user1 } = await loadFixture(deployKeywordTraitFixture);

            // Mint apps with different keyword combinations
            const apps = [
                {
                    did: "did:oma3:web3-app",
                    keywords: ["web3", "defi", "blockchain"],
                    metadataJson: JSON.stringify({ name: "Web3 App" })
                },
                {
                    did: "did:oma3:defi-app",
                    keywords: ["defi", "yield", "farming"],
                    metadataJson: JSON.stringify({ name: "DeFi App" })
                },
                {
                    did: "did:oma3:nft-app",
                    keywords: ["nft", "art", "collectibles"],
                    metadataJson: JSON.stringify({ name: "NFT App" })
                },
                {
                    did: "did:oma3:game-app",
                    keywords: ["gaming", "play-to-earn", "web3"],
                    metadataJson: JSON.stringify({ name: "Game App" })
                },
                {
                    did: "did:oma3:social-app",
                    keywords: ["social", "community", "web3"],
                    metadataJson: JSON.stringify({ name: "Social App" })
                }
            ];

            for (const app of apps) {
                const dataHash = ethers.keccak256(ethers.toUtf8Bytes(app.metadataJson));
                await registry.connect(user1).mint(
                    app.did,
                    1,
                    "https://data.example.com",
                    dataHash,
                    0,
                    "token",
                    "contract",
                    1, 0, 0,
                    app.keywords,
                    app.metadataJson
                );
            }

            this.registry = registry;
        });

        it("Should find apps with specific keywords using hasKeywords", async function () {
            const { registry } = this;

            // Test hasKeywords function
            const web3Apps = await registry.hasKeywords(["web3"], 0, 10);
            expect(web3Apps).to.have.lengthOf(3); // web3-app, game-app, social-app

            const defiApps = await registry.hasKeywords(["defi"], 0, 10);
            expect(defiApps).to.have.lengthOf(2); // web3-app, defi-app

            const nftApps = await registry.hasKeywords(["nft"], 0, 10);
            expect(nftApps).to.have.lengthOf(1); // nft-app

            const nonExistentApps = await registry.hasKeywords(["nonexistent"], 0, 10);
            expect(nonExistentApps).to.have.lengthOf(0);
        });

        it("Should handle multiple keywords in hasKeywords", async function () {
            const { registry } = this;

            // Apps with both "web3" and "defi"
            const web3DefiApps = await registry.hasKeywords(["web3", "defi"], 0, 10);
            expect(web3DefiApps).to.have.lengthOf(1); // web3-app

            // Apps with both "web3" and "gaming"
            const web3GamingApps = await registry.hasKeywords(["web3", "gaming"], 0, 10);
            expect(web3GamingApps).to.have.lengthOf(1); // game-app
        });

        it("Should handle keyword pagination", async function () {
            const { registry } = this;

            // Test pagination with page size 2
            const [web3Apps1, nextIndex1] = await registry.hasKeywords(["web3"], 0, 2);
            expect(web3Apps1).to.have.lengthOf(2);
            expect(nextIndex1).to.equal(2);

            const [web3Apps2, nextIndex2] = await registry.hasKeywords(["web3"], nextIndex1, 2);
            expect(web3Apps2).to.have.lengthOf(1);
            expect(nextIndex2).to.equal(0); // No more apps
        });

        it("Should handle case-sensitive keyword matching", async function () {
            const { registry } = this;

            // Keywords are case-sensitive
            const web3Apps = await registry.hasKeywords(["web3"], 0, 10);
            expect(web3Apps).to.have.lengthOf(3);

            const Web3Apps = await registry.hasKeywords(["Web3"], 0, 10);
            expect(Web3Apps).to.have.lengthOf(0); // Case doesn't match
        });
    });

    describe("Trait Functionality Tests", function () {
        it("Should handle minting with traits", async function () {
            const { registry, metadata, user1 } = await loadFixture(deployKeywordTraitFixture);

            const did = "did:oma3:trait-test";
            const metadataJson = JSON.stringify({ 
                name: "Trait Test App",
                traits: {
                    category: "defi",
                    risk_level: "medium",
                    chain: "ethereum"
                }
            });
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

            // Verify metadata stored in metadata contract per spec
            const stored = await metadata.getMetadataJson(did);
            expect(stored).to.equal(metadataJson);
        });

        it("Should handle complex trait structures", async function () {
            const { registry, metadata, user1 } = await loadFixture(deployKeywordTraitFixture);

            const did = "did:oma3:complex-traits-test";
            const metadataJson = JSON.stringify({
                name: "Complex Traits Test",
                version: "1.0.0",
                traits: {
                    category: "gaming",
                    subcategory: "play-to-earn",
                    features: ["nft", "defi", "social"],
                    metadata: {
                        difficulty: "medium",
                        estimated_time: "30 minutes",
                        supported_chains: ["ethereum", "polygon"],
                        ratings: {
                            gameplay: 4.5,
                            graphics: 4.0,
                            community: 4.8
                        }
                    }
                }
            });
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

            const stored = await metadata.getMetadataJson(did);
            const parsedMetadata = JSON.parse(stored);
            expect(parsedMetadata.traits.category).to.equal("gaming");
            expect(parsedMetadata.traits.features).to.deep.equal(["nft", "defi", "social"]);
        });

        it("Should handle apps without traits", async function () {
            const { registry, metadata, user1 } = await loadFixture(deployKeywordTraitFixture);

            const did = "did:oma3:no-traits-test";
            const metadataJson = JSON.stringify({ 
                name: "No Traits Test",
                description: "An app without traits"
            });
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

            const stored = await metadata.getMetadataJson(did);
            expect(stored).to.equal(metadataJson);
        });

        it("Should handle large trait data", async function () {
            const { registry, metadata, user1 } = await loadFixture(deployKeywordTraitFixture);

            const did = "did:oma3:large-traits-test";
            
            // Create large trait data
            const largeTraitData = {
                name: "Large Traits Test",
                traits: {
                    description: "x".repeat(1000), // Large description
                    features: Array.from({ length: 100 }, (_, i) => `feature${i}`),
                    metadata: {
                        data: "y".repeat(2000) // Large metadata
                    }
                }
            };
            const metadataJson = JSON.stringify(largeTraitData);
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

            const stored = await metadata.getMetadataJson(did);
            const parsedMetadata = JSON.parse(stored);
            expect(parsedMetadata.traits.features).to.have.lengthOf(100);
        });
    });

    describe("Keyword and Trait Integration Tests", function () {
        it("Should handle apps with both keywords and traits", async function () {
            const { registry, metadata, user1 } = await loadFixture(deployKeywordTraitFixture);

            const did = "did:oma3:keywords-and-traits-test";
            const metadataJson = JSON.stringify({
                name: "Keywords and Traits Test",
                traits: {
                    category: "defi",
                    risk_level: "high",
                    apy: "15.5%"
                }
            });
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));
            const keywords = ["defi", "yield", "high-apy", "ethereum"];
            const traitHashes = toTraitHashes(keywords);

            await expect(registry.connect(user1).mint(
                did,
                1,
                "https://data.example.com",
                dataHash,
                0,
                "token",
                "contract",
                1, 0, 0,
                traitHashes,
                metadataJson
            )).to.not.be.reverted;

            const app = await registry.getApp(did, 1);
            expect(app.traitHashes).to.deep.equal(traitHashes);
            
            const stored = await metadata.getMetadataJson(did);
            const parsedMetadata = JSON.parse(stored);
            expect(parsedMetadata.traits.category).to.equal("defi");
            expect(parsedMetadata.traits.apy).to.equal("15.5%");
        });

        it("Should support querying by both keywords and traits", async function () {
            const { registry, user1 } = await loadFixture(deployKeywordTraitFixture);

            // Mint multiple apps with different combinations
            const apps = [
                {
                    did: "did:oma3:defi-yield-app",
                    keywords: ["defi", "yield"],
                    traits: { category: "defi", apy: "10%" },
                    metadataJson: JSON.stringify({ name: "DeFi Yield App", traits: { category: "defi", apy: "10%" } })
                },
                {
                    did: "did:oma3:defi-lending-app",
                    keywords: ["defi", "lending"],
                    traits: { category: "defi", type: "lending" },
                    metadataJson: JSON.stringify({ name: "DeFi Lending App", traits: { category: "defi", type: "lending" } })
                },
                {
                    did: "did:oma3:nft-marketplace",
                    keywords: ["nft", "marketplace"],
                    traits: { category: "nft", type: "marketplace" },
                    metadataJson: JSON.stringify({ name: "NFT Marketplace", traits: { category: "nft", type: "marketplace" } })
                }
            ];

            for (const app of apps) {
                const dataHash = ethers.keccak256(ethers.toUtf8Bytes(app.metadataJson));
                const traitHashes = toTraitHashes(app.keywords);
                await registry.connect(user1).mint(
                    app.did,
                    1,
                    "https://data.example.com",
                    dataHash,
                    0,
                    "token",
                    "contract",
                    1, 0, 0,
                    traitHashes,
                    app.metadataJson
                );
            }

            // Validate by trait presence
            const hasDefi1 = await registry.hasAnyTraits("did:oma3:defi-yield-app", 1, toTraitHashes(["defi"]));
            const hasDefi2 = await registry.hasAnyTraits("did:oma3:defi-lending-app", 1, toTraitHashes(["defi"]));
            const hasNft = await registry.hasAnyTraits("did:oma3:nft-marketplace", 1, toTraitHashes(["nft"]));
            expect(hasDefi1 && hasDefi2 && hasNft).to.equal(true);

            // Traits are stored in metadata JSON, so they would need to be parsed client-side
            // This demonstrates the integration between keywords and traits
        });
    });

    describe("Keyword Performance Tests", function () {
        it("Should handle keyword queries efficiently with many apps", async function () {
            const { registry, user1 } = await loadFixture(deployKeywordTraitFixture);

            // Mint 50 apps with various traits (hashed keywords)
            const keywords = ["web3", "defi", "nft", "gaming", "social", "dao", "yield", "staking"];
            
            for (let i = 0; i < 50; i++) {
                const did = `did:oma3:perf-test-${i}`;
                const metadataJson = JSON.stringify({ name: `Performance Test App ${i}` });
                const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));
                
                // Randomly select 2-4 keywords for each app
                const appKeywords = keywords.slice(0, Math.floor(Math.random() * 3) + 2);
                const traitHashes = toTraitHashes(appKeywords);

                await registry.connect(user1).mint(
                    did,
                    1,
                    "https://data.example.com",
                    dataHash,
                    0,
                    "token",
                    "contract",
                    1, 0, 0,
                    traitHashes,
                    metadataJson
                );
            }

            // Test trait presence checks across dataset
            const startTime = Date.now();
            let count = 0;
            for (let i = 0; i < 50; i++) {
                const did = `did:oma3:perf-test-${i}`;
                const has = await registry.hasAnyTraits(did, 1, toTraitHashes(["web3"]));
                if (has) count++;
            }
            const endTime = Date.now();

            expect(count).to.be.greaterThan(0);
            expect(endTime - startTime).to.be.lessThan(5000);
        });

        it("Should handle empty keyword queries gracefully", async function () {
            const { registry, user1 } = await loadFixture(deployKeywordTraitFixture);
            // Mint a known app
            const did = "did:oma3:empty-query";
            const metadataJson = JSON.stringify({ name: "Empty Query" });
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
            const has = await registry.hasAnyTraits(did, 1, []);
            expect(has).to.equal(false);
        });
    });
});

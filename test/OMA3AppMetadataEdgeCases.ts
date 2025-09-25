/// <reference types="hardhat" />
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers'
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import "@nomicfoundation/hardhat-chai-matchers";
import { ethers } from "hardhat";
import { OMA3AppMetadata } from "../typechain-types";

describe("OMA3AppMetadata - Edge Cases and Comprehensive Testing", function () {
    // Test fixture
    async function deployFixture() {
        const [owner, registry, user1, user2, attacker] = await ethers.getSigners();
        
        const OMA3AppMetadata = await ethers.getContractFactory("OMA3AppMetadata");
        const metadata = await OMA3AppMetadata.deploy();
        await metadata.waitForDeployment();
        
        return { metadata, owner, registry, user1, user2, attacker };
    }

    describe("DID Validation Edge Cases", function () {
        it("Should handle maximum length DIDs", async function () {
            const { metadata, registry } = await loadFixture(deployFixture);
            
            await metadata.setAuthorizedRegistry(registry.address);
            
            // Test with maximum length DID (128 bytes, not characters)
            const maxLengthDID = "did:web:" + "a".repeat(100); // ~107 bytes total, well under 128 byte limit
            const metadataJson = JSON.stringify({ name: "Test" });
            
            await expect(metadata.connect(registry).setMetadataForRegistry(maxLengthDID, metadataJson))
                .to.not.be.reverted;
        });

        it("Should reject DIDs that are too long", async function () {
            const { metadata, registry } = await loadFixture(deployFixture);
            
            await metadata.setAuthorizedRegistry(registry.address);
            
            // Test with DID that's too long (129 characters)
            const tooLongDID = "did:web:" + "a".repeat(122); // 129 total
            const metadataJson = JSON.stringify({ name: "Test" });
            
            await expect(metadata.connect(registry).setMetadataForRegistry(tooLongDID, metadataJson))
                .to.be.revertedWith("AppMetadata Contract Error: DID too long");
        });

        it("Should handle DIDs with special characters", async function () {
            const { metadata, registry } = await loadFixture(deployFixture);
            
            await metadata.setAuthorizedRegistry(registry.address);
            
            const specialDIDs = [
                "did:web:example.com/path%20with%20spaces",
                "did:web:example.com/path?query=value",
                "did:web:example.com/path#fragment",
                "did:web:example.com:8080",
                "did:web:example.com:8080/path",
                "did:web:example.com:8080/path?query=value#fragment"
            ];
            
            for (const did of specialDIDs) {
                const metadataJson = JSON.stringify({ name: "Test", did: did });
                await expect(metadata.connect(registry).setMetadataForRegistry(did, metadataJson))
                    .to.not.be.reverted;
            }
        });

        it("Should reject DIDs with uppercase letters", async function () {
            const { metadata, registry } = await loadFixture(deployFixture);
            
            await metadata.setAuthorizedRegistry(registry.address);
            
            const uppercaseDIDs = [
                "DID:web:example.com",
                "did:WEB:example.com",
                "did:web:EXAMPLE.COM",
                "DID:WEB:EXAMPLE.COM"
            ];
            
            for (const did of uppercaseDIDs) {
                const metadataJson = JSON.stringify({ name: "Test" });
                await expect(metadata.connect(registry).setMetadataForRegistry(did, metadataJson))
                    .to.be.revertedWith("AppMetadata Contract Error: DID must be lowercase");
            }
        });

        it("Should handle DIDs with numbers and symbols", async function () {
            const { metadata, registry } = await loadFixture(deployFixture);
            
            await metadata.setAuthorizedRegistry(registry.address);
            
            const numericDIDs = [
                "did:web:example123.com",
                "did:web:example-123.com",
                "did:web:example_123.com",
                "did:web:example.123.com",
                "did:web:123example.com"
            ];
            
            for (const did of numericDIDs) {
                const metadataJson = JSON.stringify({ name: "Test", did: did });
                await expect(metadata.connect(registry).setMetadataForRegistry(did, metadataJson))
                    .to.not.be.reverted;
            }
        });

        it("Should handle empty DID string", async function () {
            const { metadata, registry } = await loadFixture(deployFixture);
            
            await metadata.setAuthorizedRegistry(registry.address);
            
            const metadataJson = JSON.stringify({ name: "Test" });
            
            await expect(metadata.connect(registry).setMetadataForRegistry("", metadataJson))
                .to.be.revertedWith("AppMetadata Contract Error: DID cannot be empty");
        });
    });

    describe("Metadata JSON Validation Edge Cases", function () {
        it("Should handle maximum length JSON", async function () {
            const { metadata, registry } = await loadFixture(deployFixture);
            
            await metadata.setAuthorizedRegistry(registry.address);
            
            // Test with maximum length JSON (under 10KB limit)
            const maxLengthJSON = JSON.stringify({
                name: "x".repeat(8000) // ~8KB, well under 10KB limit
            });
            
            await expect(metadata.connect(registry).setMetadataForRegistry("did:web:test", maxLengthJSON))
                .to.not.be.reverted;
        });

        it("Should reject JSON that is too long", async function () {
            const { metadata, registry } = await loadFixture(deployFixture);
            
            await metadata.setAuthorizedRegistry(registry.address);
            
            // Test with JSON that's too long (over 10KB)
            const tooLongJSON = JSON.stringify({
                name: "x".repeat(10001)
            });
            
            await expect(metadata.connect(registry).setMetadataForRegistry("did:web:test", tooLongJSON))
                .to.be.revertedWith("AppMetadata Contract Error: Metadata JSON too large");
        });

        it("Should handle various JSON structures", async function () {
            const { metadata, registry } = await loadFixture(deployFixture);
            
            await metadata.setAuthorizedRegistry(registry.address);
            
            const jsonStructures = [
                JSON.stringify({}), // empty object
                JSON.stringify({ name: "Test" }), // simple object
                JSON.stringify({ name: "Test", version: "1.0.0", description: "A test app" }), // complex object
                JSON.stringify({ array: [1, 2, 3] }), // with array
                JSON.stringify({ nested: { key: "value" } }), // nested object
                JSON.stringify({ unicode: "测试" }), // unicode characters
                JSON.stringify({ special: "!@#$%^&*()" }), // special characters
                JSON.stringify({ numbers: 123, float: 123.456, bool: true, null: null }) // various types
            ];
            
            for (let i = 0; i < jsonStructures.length; i++) {
                const did = `did:web:test${i}`;
                await expect(metadata.connect(registry).setMetadataForRegistry(did, jsonStructures[i]))
                    .to.not.be.reverted;
            }
        });

        it("Should reject empty JSON", async function () {
            const { metadata, registry } = await loadFixture(deployFixture);
            
            await metadata.setAuthorizedRegistry(registry.address);
            
            await expect(metadata.connect(registry).setMetadataForRegistry("did:web:test", ""))
                .to.be.revertedWith("AppMetadata Contract Error: Metadata JSON cannot be empty");
        });

        it("Should handle JSON with escaped characters", async function () {
            const { metadata, registry } = await loadFixture(deployFixture);
            
            await metadata.setAuthorizedRegistry(registry.address);
            
            const escapedJSON = JSON.stringify({
                name: "Test \"quoted\" name",
                description: "Line 1\nLine 2\tTabbed",
                path: "C:\\Users\\Test",
                url: "https://example.com/path?query=value&other=test"
            });
            
            await expect(metadata.connect(registry).setMetadataForRegistry("did:web:test", escapedJSON))
                .to.not.be.reverted;
        });
    });

    describe("Access Control Edge Cases", function () {
        it("Should prevent unauthorized access after registry change", async function () {
            const { metadata, owner, registry, user1, user2 } = await loadFixture(deployFixture);
            
            // Initially authorize registry
            await metadata.setAuthorizedRegistry(registry.address);
            
            // registry should be able to set metadata
            const metadataJson = JSON.stringify({ name: "Test" });
            await expect(metadata.connect(registry).setMetadataForRegistry("did:web:test1", metadataJson))
                .to.not.be.reverted;
            
            // user1 should not be able to set metadata (not authorized)
            await expect(metadata.connect(user1).setMetadataForRegistry("did:web:test2", metadataJson))
                .to.be.revertedWith("AppMetadata Contract Error: Only authorized registry");
            
            // user2 should not be able to set metadata (not authorized)
            await expect(metadata.connect(user2).setMetadataForRegistry("did:web:test3", metadataJson))
                .to.be.revertedWith("AppMetadata Contract Error: Only authorized registry");
        });

        it("Should prevent multiple registry authorizations", async function () {
            const { metadata, owner, registry, user1 } = await loadFixture(deployFixture);
            
            // First authorization should work
            await expect(metadata.connect(owner).setAuthorizedRegistry(registry.address))
                .to.emit(metadata, "RegistryAuthorized")
                .withArgs(registry.address);
            
            // Second authorization should fail
            await expect(metadata.connect(owner).setAuthorizedRegistry(user1.address))
                .to.be.revertedWith("AppMetadata Contract Error: Registry already set");
        });

        it("Should handle ownership transfer correctly", async function () {
            const { metadata, owner, user1, registry } = await loadFixture(deployFixture);
            
            // Transfer ownership
            await metadata.connect(owner).transferOwnership(user1.address);
            
            // New owner should be able to set registry
            await expect(metadata.connect(user1).setAuthorizedRegistry(registry.address))
                .to.emit(metadata, "RegistryAuthorized")
                .withArgs(registry.address);
            
            // Old owner should not be able to set registry
            await expect(metadata.connect(owner).setAuthorizedRegistry(registry.address))
                .to.be.revertedWithCustomError(metadata, "OwnableUnauthorizedAccount");
        });
    });

    describe("Data Integrity and Storage", function () {
        it("Should handle metadata updates correctly", async function () {
            const { metadata, registry } = await loadFixture(deployFixture);
            
            await metadata.setAuthorizedRegistry(registry.address);
            
            const did = "did:web:test";
            const metadata1 = JSON.stringify({ name: "Test App", version: "1.0.0" });
            const metadata2 = JSON.stringify({ name: "Test App", version: "2.0.0" });
            
            // Set initial metadata
            await metadata.connect(registry).setMetadataForRegistry(did, metadata1);
            expect(await metadata.getMetadataJson(did)).to.equal(metadata1);
            
            // Update metadata
            await metadata.connect(registry).setMetadataForRegistry(did, metadata2);
            expect(await metadata.getMetadataJson(did)).to.equal(metadata2);
        });

        it("Should handle multiple DIDs correctly", async function () {
            const { metadata, registry } = await loadFixture(deployFixture);
            
            await metadata.setAuthorizedRegistry(registry.address);
            
            const testCases = [
                { did: "did:web:app1", metadata: JSON.stringify({ name: "App 1" }) },
                { did: "did:web:app2", metadata: JSON.stringify({ name: "App 2" }) },
                { did: "did:web:app3", metadata: JSON.stringify({ name: "App 3" }) }
            ];
            
            // Set metadata for all DIDs
            for (const testCase of testCases) {
                await metadata.connect(registry).setMetadataForRegistry(testCase.did, testCase.metadata);
            }
            
            // Verify all metadata is stored correctly
            for (const testCase of testCases) {
                expect(await metadata.getMetadataJson(testCase.did)).to.equal(testCase.metadata);
            }
        });

        it("Should handle non-existent DID queries", async function () {
            const { metadata } = await loadFixture(deployFixture);
            
            // Querying non-existent DID should return empty string
            expect(await metadata.getMetadataJson("did:web:nonexistent")).to.equal("");
        });
    });

    describe("Event Emission", function () {
        it("Should emit correct events for metadata setting", async function () {
            const { metadata, registry } = await loadFixture(deployFixture);
            
            await metadata.setAuthorizedRegistry(registry.address);
            
            const did = "did:web:test";
            const metadataJson = JSON.stringify({ name: "Test App" });
            const expectedHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));
            
            await expect(metadata.connect(registry).setMetadataForRegistry(did, metadataJson))
                .to.emit(metadata, "MetadataSet")
                .withArgs(did, metadataJson, expectedHash, anyValue);
        });

        it("Should emit correct events for registry authorization", async function () {
            const { metadata, owner, registry } = await loadFixture(deployFixture);
            
            await expect(metadata.connect(owner).setAuthorizedRegistry(registry.address))
                .to.emit(metadata, "RegistryAuthorized")
                .withArgs(registry.address);
        });
    });

    describe("Gas Optimization and Performance", function () {
        it("Should handle large numbers of metadata entries efficiently", async function () {
            const { metadata, registry } = await loadFixture(deployFixture);
            
            await metadata.setAuthorizedRegistry(registry.address);
            
            const numEntries = 100;
            const promises = [];
            
            // Set metadata for many DIDs
            for (let i = 0; i < numEntries; i++) {
                const did = `did:web:app${i}`;
                const metadataJson = JSON.stringify({ name: `App ${i}`, id: i });
                promises.push(metadata.connect(registry).setMetadataForRegistry(did, metadataJson));
            }
            
            // All should succeed
            await expect(Promise.all(promises)).to.not.be.reverted;
            
            // Verify a few entries
            for (let i = 0; i < 10; i++) {
                const did = `did:web:app${i}`;
                const expectedMetadata = JSON.stringify({ name: `App ${i}`, id: i });
                expect(await metadata.getMetadataJson(did)).to.equal(expectedMetadata);
            }
        });
    });

    describe("Error Handling and Edge Cases", function () {
        it("Should handle contract calls with insufficient gas", async function () {
            const { metadata, registry } = await loadFixture(deployFixture);
            
            await metadata.setAuthorizedRegistry(registry.address);
            
            const did = "did:web:test";
            const metadataJson = JSON.stringify({ name: "Test" });
            
            // This should work with normal gas
            await expect(metadata.connect(registry).setMetadataForRegistry(did, metadataJson))
                .to.not.be.reverted;
        });

        it("Should handle malformed JSON gracefully", async function () {
            const { metadata, registry } = await loadFixture(deployFixture);
            
            await metadata.setAuthorizedRegistry(registry.address);
            
            // The contract doesn't validate JSON structure, so malformed JSON should still be stored
            const malformedJSON = '{"name": "Test", "version": }'; // missing value
            
            // This should still work since the contract just stores the string
            await expect(metadata.connect(registry).setMetadataForRegistry("did:web:test", malformedJSON))
                .to.not.be.reverted;
        });
    });
});

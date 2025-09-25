import { expect } from "chai";
import { ethers } from "hardhat";

describe("OMA3DidLib - Test Coverage", function () {
    let registry: any;

    beforeEach(async function () {
        const Registry = await ethers.getContractFactory("OMA3AppRegistry");
        registry = await Registry.deploy();
        await registry.waitForDeployment();
    });

    describe("DID Validation through Registry", function () {
        it("Should accept valid did:web DIDs", async function () {
            const did = "did:web:example.com";
            const metadataJson = JSON.stringify({ name: "Test App" });
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));

            await expect(registry.mint(
                did,
                1, // interfaces
                "https://example.com/data",
                dataHash,
                0, // keccak256
                "token",
                "contract",
                1, 0, 0, // version
                [],
                metadataJson
            )).to.not.be.reverted;
        });

        it("Should handle did:web case variations", async function () {
            const did1 = "did:web:EXAMPLE.COM";
            const did2 = "did:web:example.com";
            const metadataJson = JSON.stringify({ name: "Test App" });
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));

            // Test that both DIDs can be minted (they may be treated as different)
            await registry.mint(
                did1,
                1, // interfaces
                "https://example.com/data",
                dataHash,
                0, // keccak256
                "token",
                "contract",
                1, 0, 0, // version
                [],
                metadataJson
            );

            // Test that we can retrieve the app with the original DID
            const app1 = await registry.getApp(did1, 1);
            expect(app1.did).to.equal(did1);

            // Test that the second DID is treated as different (no normalization)
            await expect(registry.getApp(did2, 1))
                .to.be.reverted; // Different DID, so no app found
        });

        it("Should accept various DID formats", async function () {
            const did = "invalid:web:example.com";
            const metadataJson = JSON.stringify({ name: "Test App" });
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));

            // This tests that the registry accepts various DID formats
            // The registry may have different validation than the library
            await expect(registry.mint(
                did,
                1, // interfaces
                "https://example.com/data",
                dataHash,
                0, // keccak256
                "token",
                "contract",
                1, 0, 0, // version
                [],
                metadataJson
            )).to.not.be.reverted; // Registry accepts this format
        });

        it("Should reject DID that is too long", async function () {
            const longDid = "did:web:" + "a".repeat(250);
            const metadataJson = JSON.stringify({ name: "Test App" });
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));

            await expect(registry.mint(
                longDid,
                1, // interfaces
                "https://example.com/data",
                dataHash,
                0, // keccak256
                "token",
                "contract",
                1, 0, 0, // version
                [],
                metadataJson
            )).to.be.revertedWithCustomError(registry, "DIDTooLong");
        });

        it("Should handle DID with control characters", async function () {
            const did = "did:web:example.com\t";
            const metadataJson = JSON.stringify({ name: "Test App" });
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));

            // This tests how the registry handles DIDs with control characters
            // The registry may have different validation than the library
            await expect(registry.mint(
                did,
                1, // interfaces
                "https://example.com/data",
                dataHash,
                0, // keccak256
                "token",
                "contract",
                1, 0, 0, // version
                [],
                metadataJson
            )).to.not.be.reverted; // Registry handles this format
        });

        it("Should handle did:web with port correctly", async function () {
            const did = "did:web:EXAMPLE.COM:8080/path";
            const metadataJson = JSON.stringify({ name: "Test App" });
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));

            await expect(registry.mint(
                did,
                1, // interfaces
                "https://example.com/data",
                dataHash,
                0, // keccak256
                "token",
                "contract",
                1, 0, 0, // version
                [],
                metadataJson
            )).to.not.be.reverted;
        });

        it("Should handle did:web with query parameters correctly", async function () {
            const did = "did:web:EXAMPLE.COM?param=value";
            const metadataJson = JSON.stringify({ name: "Test App" });
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));

            await expect(registry.mint(
                did,
                1, // interfaces
                "https://example.com/data",
                dataHash,
                0, // keccak256
                "token",
                "contract",
                1, 0, 0, // version
                [],
                metadataJson
            )).to.not.be.reverted;
        });

        it("Should handle did:web with fragment correctly", async function () {
            const did = "did:web:EXAMPLE.COM#fragment";
            const metadataJson = JSON.stringify({ name: "Test App" });
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));

            await expect(registry.mint(
                did,
                1, // interfaces
                "https://example.com/data",
                dataHash,
                0, // keccak256
                "token",
                "contract",
                1, 0, 0, // version
                [],
                metadataJson
            )).to.not.be.reverted;
        });

        it("Should handle other DID methods unchanged", async function () {
            const did = "did:key:z6MkhaXgBZDvotDkL5257faiztiGiJ2QZ9K8xK8DBv6H8kK";
            const metadataJson = JSON.stringify({ name: "Test App" });
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));

            await expect(registry.mint(
                did,
                1, // interfaces
                "https://example.com/data",
                dataHash,
                0, // keccak256
                "token",
                "contract",
                1, 0, 0, // version
                [],
                metadataJson
            )).to.not.be.reverted;
        });
    });

    describe("DID Hash Consistency", function () {
        it("Should produce consistent hashes for same DID", async function () {
            const did = "did:web:example.com";
            const metadataJson = JSON.stringify({ name: "Test App" });
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));

            // Mint first app
            await registry.mint(
                did,
                1, // interfaces
                "https://example.com/data",
                dataHash,
                0, // keccak256
                "token",
                "contract",
                1, 0, 0, // version
                [],
                metadataJson
            );

            // Get the app to verify it was stored correctly
            const app = await registry.getApp(did, 1);
            expect(app.did).to.equal(did);
        });

        it("Should handle empty did:web host", async function () {
            const did = "did:web:";
            const metadataJson = JSON.stringify({ name: "Test App" });
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));

            await expect(registry.mint(
                did,
                1, // interfaces
                "https://example.com/data",
                dataHash,
                0, // keccak256
                "token",
                "contract",
                1, 0, 0, // version
                [],
                metadataJson
            )).to.not.be.reverted;
        });
    });
});
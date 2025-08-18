import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from "chai";
import hre from "hardhat";

describe("Registry-Metadata Integration", function () {
  // Fixture to deploy both contracts and link them
  async function deploySystemFixture() {
    const [owner, user1, user2] = await hre.ethers.getSigners();
    
    // Deploy registry contract
    const OMA3AppRegistry = await hre.ethers.getContractFactory("OMA3AppRegistry");
    const registry = await OMA3AppRegistry.deploy();
    
    // Deploy metadata contract
    const OMA3AppMetadata = await hre.ethers.getContractFactory("OMA3AppMetadata");
    const metadata = await OMA3AppMetadata.deploy();
    
    // Link contracts
    await metadata.setAuthorizedRegistry(await registry.getAddress());
    await registry.setMetadataContract(await metadata.getAddress());
    
    return { registry, metadata, owner, user1, user2 };
  }

  const sampleAppData = {
    did: "did:oma3:integration-test",
    interfaces: [1], // Example interface
    dataUrl: "https://example.com/app-data.json",
    dataHash: "0x" + "a".repeat(64), // 32-byte hash
    dataHashAlgorithm: 1,
    name: "Integration Test App",
    description: "An app for integration testing",
    majorVersion: 1,
    minorVersion: 0,
    patchVersion: 0,
    keywordHashes: [],
    metadataJson: JSON.stringify({
      name: "Integration Test App",
      description: "An app for integration testing",
      iconUrl: "https://example.com/icon.png",
      category: "utility"
    })
  };

  describe("System Integration", function () {
    it("Should deploy and link contracts correctly", async function () {
      const { registry, metadata } = await loadFixture(deploySystemFixture);
      
      // Verify links
      expect(await registry.metadataContract()).to.equal(await metadata.getAddress());
      expect(await metadata.authorizedRegistry()).to.equal(await registry.getAddress());
    });

    it("Should store metadata when minting app through registry", async function () {
      const { registry, metadata, user1 } = await loadFixture(deploySystemFixture);
      
      // Mint app with metadata through registry
      await expect(registry.connect(user1).mint(
        sampleAppData.did,
        sampleAppData.interfaces,
        sampleAppData.dataUrl,
        sampleAppData.dataHash,
        sampleAppData.dataHashAlgorithm,
        sampleAppData.name,
        sampleAppData.description,
        sampleAppData.majorVersion,
        sampleAppData.minorVersion,
        sampleAppData.patchVersion,
        sampleAppData.keywordHashes,
        sampleAppData.metadataJson
      )).to.emit(metadata, "MetadataSet");
      
      // Verify metadata was stored
      const storedMetadata = await metadata.getMetadataJson(sampleAppData.did);
      expect(storedMetadata).to.equal(sampleAppData.metadataJson);
      
      // Verify app was registered
      const app = await registry.getApp(sampleAppData.did, sampleAppData.majorVersion);
      expect(app.did).to.equal(sampleAppData.did);
      expect(app.name).to.equal(sampleAppData.name);
    });

    it("Should work when metadata contract is not set (optional)", async function () {
      const { registry, user1 } = await loadFixture(deploySystemFixture);
      
      // Deploy a separate registry without metadata
      const OMA3AppRegistry = await hre.ethers.getContractFactory("OMA3AppRegistry");
      const registryNoMetadata = await OMA3AppRegistry.deploy();
      
      // Should still work to mint without metadata contract
      await expect(registryNoMetadata.connect(user1).mint(
        sampleAppData.did,
        sampleAppData.interfaces,
        sampleAppData.dataUrl,
        sampleAppData.dataHash,
        sampleAppData.dataHashAlgorithm,
        sampleAppData.name,
        sampleAppData.description,
        sampleAppData.majorVersion,
        sampleAppData.minorVersion,
        sampleAppData.patchVersion,
        sampleAppData.keywordHashes,
        sampleAppData.metadataJson
      )).to.not.be.reverted;
      
      // Verify app was still registered
      const app = await registryNoMetadata.getApp(sampleAppData.did, sampleAppData.majorVersion);
      expect(app.did).to.equal(sampleAppData.did);
    });
  });

  describe("Error Handling", function () {
    it("Should handle metadata contract errors gracefully", async function () {
      const { registry, metadata, user1 } = await loadFixture(deploySystemFixture);
      
      // Try to mint with invalid metadata (too long)
      const longMetadata = "x".repeat(10001);
      
      await expect(registry.connect(user1).mint(
        sampleAppData.did,
        sampleAppData.interfaces,
        sampleAppData.dataUrl,
        sampleAppData.dataHash,
        sampleAppData.dataHashAlgorithm,
        sampleAppData.name,
        sampleAppData.description,
        sampleAppData.majorVersion,
        sampleAppData.minorVersion,
        sampleAppData.patchVersion,
        sampleAppData.keywordHashes,
        longMetadata
      )).to.be.revertedWith("Metadata JSON too long");
    });
  });
});

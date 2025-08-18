import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from "chai";
import hre from "hardhat";

describe("OMA3AppMetadata", function () {
  // Fixture to deploy contracts for testing
  async function deployFixture() {
    const [owner, registry, user1, user2] = await hre.ethers.getSigners();
    
    // Deploy metadata contract
    const OMA3AppMetadata = await hre.ethers.getContractFactory("OMA3AppMetadata");
    const metadata = await OMA3AppMetadata.deploy();
    
    return { metadata, owner, registry, user1, user2 };
  }

  const sampleData = {
    did: "did:oma3:test-app",
    metadataJson: JSON.stringify({
      name: "Test App",
      description: "A test application",
      iconUrl: "https://example.com/icon.png"
    })
  };

  describe("Deployment", function () {
    it("Should deploy with correct owner", async function () {
      const { metadata, owner } = await loadFixture(deployFixture);
      
      expect(await metadata.owner()).to.equal(owner.address);
      expect(await metadata.authorizedRegistry()).to.equal("0x0000000000000000000000000000000000000000");
    });
  });

  describe("Registry Authorization", function () {
    it("Should allow owner to set authorized registry", async function () {
      const { metadata, owner, registry } = await loadFixture(deployFixture);
      
      await expect(metadata.setAuthorizedRegistry(registry.address))
        .to.emit(metadata, "RegistryAuthorized")
        .withArgs(registry.address);
      
      expect(await metadata.authorizedRegistry()).to.equal(registry.address);
    });

    it("Should reject zero address as registry", async function () {
      const { metadata } = await loadFixture(deployFixture);
      
      await expect(metadata.setAuthorizedRegistry("0x0000000000000000000000000000000000000000"))
        .to.be.revertedWith("Registry address cannot be zero");
    });

    it("Should reject non-owner setting registry", async function () {
      const { metadata, registry, user1 } = await loadFixture(deployFixture);
      
      await expect(metadata.connect(user1).setAuthorizedRegistry(registry.address))
        .to.be.revertedWithCustomError(metadata, "OwnableUnauthorizedAccount");
    });
  });

  describe("Metadata Operations", function () {
    it("Should allow authorized registry to set metadata", async function () {
      const { metadata, registry } = await loadFixture(deployFixture);
      
      // Authorize registry
      await metadata.setAuthorizedRegistry(registry.address);
      
      // Set metadata from registry
      await expect(metadata.connect(registry).setMetadataForRegistry(sampleData.did, sampleData.metadataJson))
        .to.emit(metadata, "MetadataSet")
        .withArgs(
          sampleData.did,
          sampleData.metadataJson,
          hre.ethers.keccak256(hre.ethers.toUtf8Bytes(sampleData.metadataJson)),
          await hre.ethers.provider.getBlockNumber() + 1
        );
      
      // Verify metadata was stored
      expect(await metadata.getMetadataJson(sampleData.did)).to.equal(sampleData.metadataJson);
    });

    it("Should reject unauthorized calls to set metadata", async function () {
      const { metadata, user1 } = await loadFixture(deployFixture);
      
      await expect(metadata.connect(user1).setMetadataForRegistry(sampleData.did, sampleData.metadataJson))
        .to.be.revertedWith("Only authorized registry can call this function");
    });

    it("Should validate DID format", async function () {
      const { metadata, registry } = await loadFixture(deployFixture);
      
      await metadata.setAuthorizedRegistry(registry.address);
      
      // Test invalid DIDs
      await expect(metadata.connect(registry).setMetadataForRegistry("", sampleData.metadataJson))
        .to.be.revertedWith("DID cannot be empty");
      
      await expect(metadata.connect(registry).setMetadataForRegistry("UPPERCASE", sampleData.metadataJson))
        .to.be.revertedWith("DID must be lowercase");
    });

    it("Should validate metadata JSON", async function () {
      const { metadata, registry } = await loadFixture(deployFixture);
      
      await metadata.setAuthorizedRegistry(registry.address);
      
      // Test empty JSON
      await expect(metadata.connect(registry).setMetadataForRegistry(sampleData.did, ""))
        .to.be.revertedWith("Metadata JSON cannot be empty");
      
      // Test JSON too long (over 10KB)
      const longJson = "x".repeat(10001);
      await expect(metadata.connect(registry).setMetadataForRegistry(sampleData.did, longJson))
        .to.be.revertedWith("Metadata JSON too long");
    });
  });

  describe("Metadata Retrieval", function () {
    it("Should return empty string for non-existent DID", async function () {
      const { metadata } = await loadFixture(deployFixture);
      
      expect(await metadata.getMetadataJson("did:oma3:nonexistent")).to.equal("");
    });

    it("Should return stored metadata for existing DID", async function () {
      const { metadata, registry } = await loadFixture(deployFixture);
      
      await metadata.setAuthorizedRegistry(registry.address);
      await metadata.connect(registry).setMetadataForRegistry(sampleData.did, sampleData.metadataJson);
      
      expect(await metadata.getMetadataJson(sampleData.did)).to.equal(sampleData.metadataJson);
    });
  });
});

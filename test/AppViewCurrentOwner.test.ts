/// <reference types="hardhat" />
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from "chai";
import "@nomicfoundation/hardhat-chai-matchers";
const hre = require("hardhat");

/**
 * AppView currentOwner Integration Test
 * 
 * Purpose: Verify that the currentOwner field in AppView correctly reflects
 * the current NFT holder, especially after transfers.
 * 
 * This test validates the fix for the "Owner mismatch" issue where:
 * - nft.owner (from metadata JSON) should match app.currentOwner (from contract)
 * - app.minter remains unchanged (original creator)
 * - app.currentOwner updates after transfers
 */
describe("AppView currentOwner Integration", function () {
  async function deployFixture() {
    const [owner, minter, buyer] = await hre.ethers.getSigners();
    
    const OMA3AppRegistry = await hre.ethers.getContractFactory("OMA3AppRegistry");
    const registry = await OMA3AppRegistry.deploy();
    await registry.waitForDeployment();
    
    return { registry, owner, minter, buyer };
  }

  describe("getApp() returns currentOwner", function () {
    it("should return minter as currentOwner immediately after mint", async function () {
      const { registry, minter } = await loadFixture(deployFixture);
      
      const did = "did:oma3:test-owner";
      const dataUrl = "https://example.com/app.json";
      const dataHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test data"));
      
      await registry.connect(minter).mint(
        did,
        1, // interfaces
        dataUrl,
        dataHash,
        0, // keccak256
        "", // fungibleTokenId
        "", // contractId
        1, 0, 0, // version
        [], // traitHashes
        "" // metadataJson
      );
      
      const app = await registry.getApp(did, 1);
      
      expect(app.minter).to.equal(minter.address);
      expect(app.currentOwner).to.equal(minter.address);
      expect(app.minter).to.equal(app.currentOwner, "Initially, minter and currentOwner should match");
    });

    it("should update currentOwner after transfer but keep minter unchanged", async function () {
      const { registry, minter, buyer } = await loadFixture(deployFixture);
      
      const did = "did:oma3:test-transfer";
      const dataUrl = "https://example.com/app.json";
      const dataHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test data"));
      
      // Mint
      await registry.connect(minter).mint(
        did,
        1,
        dataUrl,
        dataHash,
        0,
        "",
        "",
        1, 0, 0,
        [],
        ""
      );
      
      // Get token ID (first minted token is ID 1)
      const tokenId = 1;
      
      // Transfer to buyer
      await registry.connect(minter).transferFrom(minter.address, buyer.address, tokenId);
      
      // Check app data
      const app = await registry.getApp(did, 1);
      
      expect(app.minter).to.equal(minter.address, "Minter should remain unchanged");
      expect(app.currentOwner).to.equal(buyer.address, "currentOwner should be updated to buyer");
      expect(app.minter).to.not.equal(app.currentOwner, "After transfer, minter and currentOwner should differ");
    });

    it("should reflect multiple transfers in currentOwner", async function () {
      const { registry, minter, buyer, owner } = await loadFixture(deployFixture);
      
      const did = "did:oma3:test-multi-transfer";
      const dataUrl = "https://example.com/app.json";
      const dataHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test data"));
      
      // Mint
      await registry.connect(minter).mint(
        did,
        1,
        dataUrl,
        dataHash,
        0,
        "",
        "",
        1, 0, 0,
        [],
        ""
      );
      
      const tokenId = 1;
      
      // Transfer chain: minter → buyer → owner
      await registry.connect(minter).transferFrom(minter.address, buyer.address, tokenId);
      await registry.connect(buyer).transferFrom(buyer.address, owner.address, tokenId);
      
      const app = await registry.getApp(did, 1);
      
      expect(app.minter).to.equal(minter.address, "Minter should always be original creator");
      expect(app.currentOwner).to.equal(owner.address, "currentOwner should be final recipient");
    });
  });

  describe("getAppsByOwner() returns currentOwner", function () {
    it("should return apps with correct currentOwner for each owner", async function () {
      const { registry, minter, buyer } = await loadFixture(deployFixture);
      
      // Mint two apps
      const did1 = "did:oma3:owner-test-1";
      const did2 = "did:oma3:owner-test-2";
      const dataUrl = "https://example.com/app.json";
      const dataHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test data"));
      
      await registry.connect(minter).mint(did1, 1, dataUrl, dataHash, 0, "", "", 1, 0, 0, [], "");
      await registry.connect(minter).mint(did2, 1, dataUrl, dataHash, 0, "", "", 1, 0, 0, [], "");
      
      // Transfer one app to buyer (first minted token is ID 1)
      const tokenId1 = 1;
      await registry.connect(minter).transferFrom(minter.address, buyer.address, tokenId1);
      
      // Check minter's apps
      const [minterApps] = await registry.getAppsByOwner(minter.address, 0);
      expect(minterApps.length).to.equal(1);
      expect(minterApps[0].did).to.equal(did2);
      expect(minterApps[0].currentOwner).to.equal(minter.address);
      expect(minterApps[0].minter).to.equal(minter.address);
      
      // Check buyer's apps
      const [buyerApps] = await registry.getAppsByOwner(buyer.address, 0);
      expect(buyerApps.length).to.equal(1);
      expect(buyerApps[0].did).to.equal(did1);
      expect(buyerApps[0].currentOwner).to.equal(buyer.address);
      expect(buyerApps[0].minter).to.equal(minter.address, "Minter should still be original creator");
    });
  });

  describe("getAppsByStatus() returns currentOwner", function () {
    it("should return apps with correct currentOwner in status queries", async function () {
      const { registry, minter, buyer } = await loadFixture(deployFixture);
      
      const did = "did:oma3:status-owner-test";
      const dataUrl = "https://example.com/app.json";
      const dataHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test data"));
      
      await registry.connect(minter).mint(did, 1, dataUrl, dataHash, 0, "", "", 1, 0, 0, [], "");
      
      // Transfer to buyer
      const tokenId = 1;
      await registry.connect(minter).transferFrom(minter.address, buyer.address, tokenId);
      
      // Query active apps
      const [apps] = await registry.getAppsByStatus(0, 0); // status 0 = active
      
      const app = apps.find((a: any) => a.did === did);
      expect(app).to.not.be.undefined;
      expect(app.currentOwner).to.equal(buyer.address);
      expect(app.minter).to.equal(minter.address);
    });
  });

  describe("getApps() and getAppsByInterface() return currentOwner", function () {
    it("should return currentOwner in getApps()", async function () {
      const { registry, minter, buyer } = await loadFixture(deployFixture);
      
      const did = "did:oma3:getapps-owner-test";
      const dataUrl = "https://example.com/app.json";
      const dataHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test data"));
      
      await registry.connect(minter).mint(did, 1, dataUrl, dataHash, 0, "", "", 1, 0, 0, [], "");
      
      const tokenId = 1;
      await registry.connect(minter).transferFrom(minter.address, buyer.address, tokenId);
      
      const [apps] = await registry.getApps(0);
      const app = apps.find((a: any) => a.did === did);
      
      expect(app.currentOwner).to.equal(buyer.address);
      expect(app.minter).to.equal(minter.address);
    });

    it("should return currentOwner in getAppsByInterface()", async function () {
      const { registry, minter, buyer } = await loadFixture(deployFixture);
      
      const did = "did:oma3:interface-owner-test";
      const dataUrl = "https://example.com/app.json";
      const dataHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test data"));
      
      await registry.connect(minter).mint(did, 1, dataUrl, dataHash, 0, "", "", 1, 0, 0, [], "");
      
      const tokenId = 1;
      await registry.connect(minter).transferFrom(minter.address, buyer.address, tokenId);
      
      const [apps] = await registry.getAppsByInterface(1, 0); // interface 1 = human
      const app = apps.find((a: any) => a.did === did);
      
      expect(app.currentOwner).to.equal(buyer.address);
      expect(app.minter).to.equal(minter.address);
    });
  });

  describe("Real-world scenario: Owner mismatch fix", function () {
    it("should resolve owner mismatch between metadata JSON and contract", async function () {
      const { registry, minter, buyer } = await loadFixture(deployFixture);
      
      const did = "did:oma3:real-world-test";
      const dataUrl = "https://example.com/app.json";
      const dataHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test data"));
      
      // Mint app
      await registry.connect(minter).mint(did, 1, dataUrl, dataHash, 0, "", "", 1, 0, 0, [], "");
      
      // Transfer to buyer (simulating secondary market purchase)
      const tokenId = 1;
      await registry.connect(minter).transferFrom(minter.address, buyer.address, tokenId);
      
      // Frontend fetches app data
      const app = await registry.getApp(did, 1);
      
      // Simulate metadata JSON owner (would be constructed as eip155:chainId:address)
      const metadataOwner = buyer.address; // In real scenario: parsed from "eip155:66238:0x..."
      
      // Verify: metadata owner matches contract currentOwner
      expect(app.currentOwner.toLowerCase()).to.equal(metadataOwner.toLowerCase());
      
      // Verify: minter is different (original creator)
      expect(app.minter).to.not.equal(app.currentOwner);
      
      // This resolves the "Owner mismatch" issue!
      console.log("✅ Owner mismatch resolved:");
      console.log(`   Metadata owner: ${metadataOwner}`);
      console.log(`   Contract currentOwner: ${app.currentOwner}`);
      console.log(`   Contract minter: ${app.minter}`);
    });
  });
});

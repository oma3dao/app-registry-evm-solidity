/// <reference types="hardhat" />
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import "@nomicfoundation/hardhat-chai-matchers";
const hre = require("hardhat");

/**
 * AppView tokenId Integration Test (#43)
 *
 * Verifies that all AppView query paths return the ERC-721 tokenId required
 * for ERC-8004 Security Extension registrations.agentId.
 */
describe("AppView tokenId Integration (#43)", function () {
  const dataUrl = "https://example.com/app.json";
  const dataHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test data"));

  async function deployFixture() {
    const [owner, minter, buyer] = await hre.ethers.getSigners();
    const OMA3AppRegistry = await hre.ethers.getContractFactory("OMA3AppRegistry");
    const registry = await OMA3AppRegistry.deploy();
    await registry.waitForDeployment();
    return { registry, owner, minter, buyer };
  }

  async function mintApp(
    registry: any,
    minter: any,
    did: string,
    interfaces = 1
  ) {
    await registry.connect(minter).mint(
      did,
      interfaces,
      dataUrl,
      dataHash,
      0,
      "",
      "",
      1,
      0,
      0,
      [],
      ""
    );
  }

  describe("getApp()", function () {
    it("should return the resolved ERC-721 tokenId", async function () {
      const { registry, minter } = await loadFixture(deployFixture);

      await mintApp(registry, minter, "did:oma3:tokenid-getapp-1");
      await mintApp(registry, minter, "did:oma3:tokenid-getapp-2");

      const app1 = await registry.getApp("did:oma3:tokenid-getapp-1", 1);
      const app2 = await registry.getApp("did:oma3:tokenid-getapp-2", 1);

      expect(app1.tokenId).to.equal(1n);
      expect(app2.tokenId).to.equal(2n);
    });

    it("should keep tokenId stable after transfer while currentOwner changes", async function () {
      const { registry, minter, buyer } = await loadFixture(deployFixture);
      const did = "did:oma3:tokenid-transfer-stable";

      await mintApp(registry, minter, did);
      await registry.connect(minter).transferFrom(minter.address, buyer.address, 1);

      const app = await registry.getApp(did, 1);

      expect(app.tokenId).to.equal(1n);
      expect(app.currentOwner).to.equal(buyer.address);
      expect(app.minter).to.equal(minter.address);
    });
  });

  describe("getAppsByOwner()", function () {
    it("should return correct tokenId for each owned app", async function () {
      const { registry, minter, buyer } = await loadFixture(deployFixture);

      await mintApp(registry, minter, "did:oma3:tokenid-owner-1");
      await mintApp(registry, minter, "did:oma3:tokenid-owner-2");
      await registry.connect(minter).transferFrom(minter.address, buyer.address, 1);

      const [minterApps] = await registry.getAppsByOwner(minter.address, 0);
      const [buyerApps] = await registry.getAppsByOwner(buyer.address, 0);

      expect(minterApps).to.have.length(1);
      expect(minterApps[0].tokenId).to.equal(2n);
      expect(minterApps[0].did).to.equal("did:oma3:tokenid-owner-2");

      expect(buyerApps).to.have.length(1);
      expect(buyerApps[0].tokenId).to.equal(1n);
      expect(buyerApps[0].did).to.equal("did:oma3:tokenid-owner-1");
    });
  });

  describe("getAppsByStatus()", function () {
    it("should return correct tokenId for active apps", async function () {
      const { registry, minter } = await loadFixture(deployFixture);

      await mintApp(registry, minter, "did:oma3:tokenid-status-1");
      await mintApp(registry, minter, "did:oma3:tokenid-status-2");

      const [apps] = await registry.getAppsByStatus(0, 0);

      const byDid = Object.fromEntries(apps.map((a: any) => [a.did, a.tokenId]));
      expect(byDid["did:oma3:tokenid-status-1"]).to.equal(1n);
      expect(byDid["did:oma3:tokenid-status-2"]).to.equal(2n);
    });
  });

  describe("getApps()", function () {
    it("should return correct tokenId for paginated active apps", async function () {
      const { registry, minter } = await loadFixture(deployFixture);

      await mintApp(registry, minter, "did:oma3:tokenid-getapps-1");
      await mintApp(registry, minter, "did:oma3:tokenid-getapps-2");

      const [apps] = await registry.getApps(0);

      const byDid = Object.fromEntries(apps.map((a: any) => [a.did, a.tokenId]));
      expect(byDid["did:oma3:tokenid-getapps-1"]).to.equal(1n);
      expect(byDid["did:oma3:tokenid-getapps-2"]).to.equal(2n);
    });
  });

  describe("getAppsByInterface()", function () {
    it("should return correct tokenId for interface-filtered apps", async function () {
      const { registry, minter } = await loadFixture(deployFixture);

      await mintApp(registry, minter, "did:oma3:tokenid-interface-human", 1);
      await mintApp(registry, minter, "did:oma3:tokenid-interface-api", 2);

      const [humanApps] = await registry.getAppsByInterface(1, 0);
      const [apiApps] = await registry.getAppsByInterface(2, 0);

      expect(humanApps).to.have.length(1);
      expect(humanApps[0].tokenId).to.equal(1n);

      expect(apiApps).to.have.length(1);
      expect(apiApps[0].tokenId).to.equal(2n);
    });
  });
});

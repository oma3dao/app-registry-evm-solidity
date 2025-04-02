import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers'
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import hre from "hardhat";

// Keep these in sync with the constants in the contract
const ERROR_PREFIX = "AppRegistry Contract Error: ";

// Common error messages
const ERRORS = {
  APP_NOT_FOUND: "Application does not exist",
  NOT_MINTER: "Not the minter",
  CANNOT_REACTIVATE: "Cannot reactivate replaced application",
  SOULBOUND: "Apps are soulbound and cannot be transferred or burned"
};

describe("OMA3AppRegistry", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployFixture() {
    // Contracts are deployed using the first signer/account by default
    const [deployer, minter1, minter2] = await hre.ethers.getSigners();

    const OMA3AppRegistry = await hre.ethers.getContractFactory("OMA3AppRegistry");
    const registry = await OMA3AppRegistry.deploy();

    return { registry, deployer, minter1, minter2 };
  }

  async function deployFixtureOneApp() {
    return deployFixtureXApps(1);
  }

  async function deployFixtureXApps(numApps: number) {
    const { registry, deployer, minter1, minter2 } = await deployFixture();

    // Mint X apps using minter1
    const apps = [];
    for (let i = 1; i <= numApps; i++) {
      const did = `did:oma3:test${i}`;
      const name = hre.ethers.encodeBytes32String(`Test App ${i}`);
      const dataUrl = `https://data.example.com/app${i}`;
      const iwpsPortalUri = `https://portal.example.com/app${i}`;
      const agentApiUri = `https://api.example.com/app${i}`;
      const contractAddress = ""; // No contract address

      await registry.connect(minter1).mint(
        did,
        name,
        hre.ethers.encodeBytes32String("1.0.0"), // version as bytes32
        dataUrl,
        iwpsPortalUri,
        agentApiUri,
        contractAddress
      );

      apps.push({ did, name });
    }

    return { registry, deployer, minter1, minter2, apps };
  }

  async function deployFixture4Apps() {
    return deployFixtureXApps(4);
  }

  async function deployFixture9Apps() {
    return deployFixtureXApps(9);
  }

  describe("Deployment", function () {
    it("getTotalApps should have no registered apps", async function () {
      const config = await loadFixture(deployFixture);

      expect(await config.registry.getTotalApps()).to.equal(0);
    });

    it("getApps should return empty array when getting apps with no apps registered", async function () {
      const config = await loadFixture(deployFixture);

      const [apps, nextTokenId] = await config.registry.getApps(1);
      expect(apps).to.be.an('array').that.is.empty;
      expect(nextTokenId).to.equal(0);
    });

    it("getApps should return empty array when getting apps with invalid start token ID", async function () {
      const config = await loadFixture(deployFixture);

      const [apps1, nextTokenId1] = await config.registry.getApps(0);
      expect(apps1).to.be.an('array').that.is.empty;
      expect(nextTokenId1).to.equal(0);
      
      const [apps2, nextTokenId2] = await config.registry.getApps(2);
      expect(apps2).to.be.an('array').that.is.empty;
      expect(nextTokenId2).to.equal(0);
    });

    it("getAppsByStatus should return empty array when getting apps by status with no apps registered", async function () {
      const config = await loadFixture(deployFixture);

      const [apps, nextTokenId] = await config.registry.getAppsByStatus(1, 0);
      expect(apps).to.be.an('array').that.is.empty;
      expect(nextTokenId).to.equal(0);
    });

    it("getAppsByMinter should return empty array when getting apps by minter with no apps registered", async function () {
      const config = await loadFixture(deployFixture);

      const apps = await config.registry.getAppsByMinter(config.minter1.address);
      expect(apps).to.be.an('array').that.is.empty;
    });

    it("getApp should revert when getting non-existent app", async function () {
      const config = await loadFixture(deployFixture);

      await expect(config.registry.getApp("non-existent-did"))
        .to.be.revertedWith(ERROR_PREFIX + ERRORS.APP_NOT_FOUND);
    });

    it("getDIDDocument should revert when getting DID document with non-existent app", async function () {
      const config = await loadFixture(deployFixture);

      await expect(config.registry.getDIDDocument("non-existent-did"))
        .to.be.revertedWith(ERROR_PREFIX + ERRORS.APP_NOT_FOUND);
    });
  });

  describe("With One App", function () {
    it("getTotalApps should have one registered app", async function () {
      const config = await loadFixture(deployFixtureOneApp);

      expect(await config.registry.getTotalApps()).to.equal(1);
    });

    it("getApps should return the app when getting apps", async function () {
      const config = await loadFixture(deployFixtureOneApp);

      const [apps, nextTokenId] = await config.registry.getApps(1);
      expect(apps.length).to.equal(1);
      expect(apps[0].did).to.equal(config.apps[0].did);
      expect(nextTokenId).to.equal(0);
    });

    it("getApps should return empty array when getting apps after deprecating", async function () {
      const config = await loadFixture(deployFixtureOneApp);

      // Deprecate the app
      await config.registry.connect(config.minter1).updateStatus(config.apps[0].did, 1); // DEPRECATED

      const [apps, nextTokenId] = await config.registry.getApps(1);
      expect(apps).to.be.an('array').that.is.empty;
      expect(nextTokenId).to.equal(0);
    });

    it("getAppsByStatus should return the app when getting apps by status", async function () {
      const config = await loadFixture(deployFixtureOneApp);

      const [apps, nextTokenId] = await config.registry.getAppsByStatus(1, 0); // 0 is ACTIVE status
      expect(apps.length).to.equal(1);
      expect(apps[0].did).to.equal(config.apps[0].did);
      expect(nextTokenId).to.equal(0);
    });

    it("getAppsByStatus should return empty array when getting apps with non-matching status filter", async function () {
      const config = await loadFixture(deployFixtureOneApp);

      const [apps, nextTokenId] = await config.registry.getAppsByStatus(1, 1); // 1 is DEPRECATED status
      expect(apps).to.be.an('array').that.is.empty;
      expect(nextTokenId).to.equal(0);
    });

    it("getAppsByStatus should return deprecated app when getting apps by status", async function () {
      const config = await loadFixture(deployFixtureOneApp);

      // Deprecate the app
      await config.registry.connect(config.minter1).updateStatus(config.apps[0].did, 1); // DEPRECATED

      const [apps, nextTokenId] = await config.registry.getAppsByStatus(1, 1); // 1 is DEPRECATED status
      expect(apps.length).to.equal(1);
      expect(apps[0].did).to.equal(config.apps[0].did);
      expect(nextTokenId).to.equal(0);
    });

    it("getAppsByMinter should return the app when getting apps by minter", async function () {
      const config = await loadFixture(deployFixtureOneApp);

      const apps = await config.registry.getAppsByMinter(config.minter1.address);
      expect(apps.length).to.equal(1);
      expect(apps[0].did).to.equal(config.apps[0].did);
    });

    it("getAppsByMinter should return empty array when getting apps by non-minting address", async function () {
      const config = await loadFixture(deployFixtureOneApp);

      const apps = await config.registry.getAppsByMinter(config.minter2.address);
      expect(apps).to.be.an('array').that.is.empty;
    });

    it("getApp should return the app when getting app by DID", async function () {
      const config = await loadFixture(deployFixtureOneApp);

      const app = await config.registry.getApp(config.apps[0].did);
      expect(app.did).to.equal(config.apps[0].did);
    });

    it("getDIDDocument should include name, version, status and minter in the DID document", async function () {
      const config = await loadFixture(deployFixtureOneApp);

      const didDoc = await config.registry.getDIDDocument(config.apps[0].did);
      expect(didDoc).to.be.a('string');
      
      // Parse the DID document
      const parsedDoc = JSON.parse(didDoc);
      
      // Check that the document includes the required fields
      expect(parsedDoc).to.have.property('id').that.equals(config.apps[0].did);
      expect(parsedDoc).to.have.property('name').that.is.a('string');
      expect(parsedDoc).to.have.property('version').that.equals('1.0.0');
      expect(parsedDoc).to.have.property('status').that.equals(0); // ACTIVE = 0
      expect(parsedDoc).to.have.property('minter').that.equals(config.minter1.address.toLowerCase());
      expect(parsedDoc).to.have.property('service').that.is.an('array');
      expect(parsedDoc.service).to.have.lengthOf(3); // data, iwpsPortal, agentApi
    });

    it("updateStatus should allow minter to update app status", async function () {
      const config = await loadFixture(deployFixtureOneApp);

      await config.registry.connect(config.minter1).updateStatus(config.apps[0].did, 1); // 1 is DEPRECATED
      const app = await config.registry.getApp(config.apps[0].did);
      expect(app.status).to.equal(1);
    });

    it("updateStatus should not allow non-minter to update app status", async function () {
      const config = await loadFixture(deployFixtureOneApp);

      await expect(config.registry.connect(config.minter2).updateStatus(config.apps[0].did, 1))
        .to.be.revertedWith(ERROR_PREFIX + ERRORS.NOT_MINTER);
    });

    it("updateStatus should not allow reactivating replaced app", async function () {
      const config = await loadFixture(deployFixtureOneApp);

      // First deprecate the app
      await config.registry.connect(config.minter1).updateStatus(config.apps[0].did, 1); // DEPRECATED
      // Then replace it
      await config.registry.connect(config.minter1).updateStatus(config.apps[0].did, 2); // REPLACED
      // Try to reactivate it
      await expect(config.registry.connect(config.minter1).updateStatus(config.apps[0].did, 0))
        .to.be.revertedWith(ERROR_PREFIX + ERRORS.CANNOT_REACTIVATE);
    });

    it("getAppsByStatus should return array with correct size when getting apps by status", async function () {
      const config = await loadFixture(deployFixtureOneApp);

      // Get active apps
      const [activeApps, nextTokenId] = await config.registry.getAppsByStatus(1, 0); // ACTIVE
      expect(activeApps.length).to.equal(1);
      expect(nextTokenId).to.equal(0);

      // Deprecate the app
      await config.registry.connect(config.minter1).updateStatus(config.apps[0].did, 1); // DEPRECATED

      // Get deprecated apps
      const [deprecatedApps, nextTokenId2] = await config.registry.getAppsByStatus(1, 1); // DEPRECATED
      expect(deprecatedApps.length).to.equal(1);
      expect(nextTokenId2).to.equal(0);

      // Get active apps (should be empty)
      const [emptyApps, nextTokenId3] = await config.registry.getApps(1);
      expect(emptyApps.length).to.equal(0);
      expect(nextTokenId3).to.equal(0);
    });

    it("getAppDIDs and getAppDIDsByStatus should return array with correct size when getting DIDs by status", async function () {
      const config = await loadFixture(deployFixtureOneApp);

      // Get all DIDs
      const [allDids, nextTokenId] = await config.registry.getAppDIDs(1);
      expect(allDids.length).to.equal(1);
      expect(nextTokenId).to.equal(0);

      // Get active DIDs
      const [activeDids, nextTokenId2] = await config.registry.getAppDIDsByStatus(1, 0); // ACTIVE
      expect(activeDids.length).to.equal(1);
      expect(nextTokenId2).to.equal(0);

      // Deprecate the app
      await config.registry.connect(config.minter1).updateStatus(config.apps[0].did, 1); // DEPRECATED

      // Get deprecated DIDs
      const [deprecatedDids, nextTokenId3] = await config.registry.getAppDIDsByStatus(1, 1); // DEPRECATED
      expect(deprecatedDids.length).to.equal(1);
      expect(nextTokenId3).to.equal(0);

      // Get active DIDs (should be empty)
      const [emptyDids, nextTokenId4] = await config.registry.getAppDIDsByStatus(1, 0); // ACTIVE
      expect(emptyDids.length).to.equal(0);
      expect(nextTokenId4).to.equal(0);
    });
  });

  describe("With Four Apps", function () {
    it("getTotalApps should have four registered apps", async function () {
      const config = await loadFixture(deployFixture4Apps);
      expect(await config.registry.getTotalApps()).to.equal(4);
    });

    it("getApps should return correct apps when getting apps with pagination", async function () {
      const config = await loadFixture(deployFixture4Apps);

      // First page (2 apps)
      const [apps1, nextTokenId1] = await config.registry.getApps(1);
      expect(apps1.length).to.equal(2);
      expect(apps1[0].did).to.equal(config.apps[0].did);
      expect(apps1[1].did).to.equal(config.apps[1].did);
      expect(nextTokenId1).to.equal(3); // This is correct because we need to start from token 3 for the next page

      // Second page (2 apps)
      const [apps2, nextTokenId2] = await config.registry.getApps(3);
      expect(apps2.length).to.equal(2);
      expect(apps2[0].did).to.equal(config.apps[2].did);
      expect(apps2[1].did).to.equal(config.apps[3].did);
      expect(nextTokenId2).to.equal(0);
    });

    it("getAppsByStatus should return correct apps when getting apps by status with pagination", async function () {
      const config = await loadFixture(deployFixture4Apps);

      // Deprecate two apps
      await config.registry.connect(config.minter1).updateStatus(config.apps[1].did, 1); // DEPRECATED

      // First page (2 active apps)
      const [activeApps1, nextTokenId1] = await config.registry.getAppsByStatus(1, 0); // ACTIVE
      expect(activeApps1.length).to.equal(2);
      expect(activeApps1[0].did).to.equal(config.apps[0].did);
      expect(activeApps1[1].did).to.equal(config.apps[2].did);
      expect(nextTokenId1).to.equal(4);

      // Second page (1 active app)
      const [activeApps2, nextTokenId2] = await config.registry.getAppsByStatus(4, 0); // ACTIVE
      expect(activeApps2.length).to.equal(1);
      expect(activeApps2[0].did).to.equal(config.apps[3].did);
      expect(nextTokenId2).to.equal(0);

      // First page (1 deprecated app)
      const [deprecatedApps1, nextTokenId3] = await config.registry.getAppsByStatus(1, 1); // DEPRECATED
      expect(deprecatedApps1.length).to.equal(1);
      expect(deprecatedApps1[0].did).to.equal(config.apps[1].did);
      expect(nextTokenId3).to.equal(0);
    });

    it("getAppDIDs should return all DIDs in one page", async function () {
      const config = await loadFixture(deployFixture4Apps);

      // Get all DIDs (should get all 4 in one page since MAX_DIDS_PER_PAGE is 5)
      const [dids, nextTokenId] = await config.registry.getAppDIDs(1);
      expect(dids.length).to.equal(4);
      expect(dids[0]).to.equal(config.apps[0].did);
      expect(dids[1]).to.equal(config.apps[1].did);
      expect(dids[2]).to.equal(config.apps[2].did);
      expect(dids[3]).to.equal(config.apps[3].did);
      expect(nextTokenId).to.equal(0);
    });

    it("getAppDIDsByStatus should return correct DIDs when getting DIDs by status", async function () {
      const config = await loadFixture(deployFixture4Apps);

      // Deprecate two apps
      await config.registry.connect(config.minter1).updateStatus(config.apps[1].did, 1); // DEPRECATED
      await config.registry.connect(config.minter1).updateStatus(config.apps[3].did, 1); // DEPRECATED

      // Get active DIDs (should get all 2 in one page)
      const [activeDids, nextTokenId1] = await config.registry.getAppDIDsByStatus(1, 0); // ACTIVE
      expect(activeDids.length).to.equal(2);
      expect(activeDids[0]).to.equal(config.apps[0].did);
      expect(activeDids[1]).to.equal(config.apps[2].did);
      expect(nextTokenId1).to.equal(0);

      // Get deprecated DIDs (should get all 2 in one page)
      const [deprecatedDids, nextTokenId2] = await config.registry.getAppDIDsByStatus(1, 1); // DEPRECATED
      expect(deprecatedDids.length).to.equal(2);
      expect(deprecatedDids[0]).to.equal(config.apps[1].did);
      expect(deprecatedDids[1]).to.equal(config.apps[3].did);
      expect(nextTokenId2).to.equal(0);
    });

    it("getAppsByMinter should return correct apps when getting apps by minter", async function () {
      const config = await loadFixture(deployFixture4Apps);

      // Get all apps by minter1 (should get all 4)
      const apps = await config.registry.getAppsByMinter(config.minter1.address);
      expect(apps.length).to.equal(4);
      expect(apps[0].did).to.equal(config.apps[0].did);
      expect(apps[1].did).to.equal(config.apps[1].did);
      expect(apps[2].did).to.equal(config.apps[2].did);
      expect(apps[3].did).to.equal(config.apps[3].did);

      // Get apps by minter2 (should be empty)
      const emptyApps = await config.registry.getAppsByMinter(config.minter2.address);
      expect(emptyApps).to.be.an('array').that.is.empty;
    });
  });

  describe("With Nine Apps", function () {
    it("getTotalApps should have nine registered apps", async function () {
      const config = await loadFixture(deployFixture9Apps);
      expect(await config.registry.getTotalApps()).to.equal(9);
    });

    it("getApps should return correct apps when getting apps with pagination", async function () {
      const config = await loadFixture(deployFixture9Apps);

      // First page (2 apps)
      const [apps1, nextTokenId1] = await config.registry.getApps(1);
      expect(apps1.length).to.equal(2);
      expect(apps1[0].did).to.equal(config.apps[0].did);
      expect(apps1[1].did).to.equal(config.apps[1].did);
      expect(nextTokenId1).to.equal(3); // This is correct because we need to start from token 4 for the next page

      // Second page (2 apps)
      const [apps2, nextTokenId2] = await config.registry.getApps(3);
      expect(apps2.length).to.equal(2);
      expect(apps2[0].did).to.equal(config.apps[2].did);
      expect(apps2[1].did).to.equal(config.apps[3].did);
      expect(nextTokenId2).to.equal(5);

      // Third page (2 apps)
      const [apps3, nextTokenId3] = await config.registry.getApps(5);
      expect(apps3.length).to.equal(2);
      expect(apps3[0].did).to.equal(config.apps[4].did);
      expect(apps3[1].did).to.equal(config.apps[5].did);
      expect(nextTokenId3).to.equal(7);

      // Fourth page (2 apps)
      const [apps4, nextTokenId4] = await config.registry.getApps(7);
      expect(apps4.length).to.equal(2);
      expect(apps4[0].did).to.equal(config.apps[6].did);
      expect(apps4[1].did).to.equal(config.apps[7].did);
      expect(nextTokenId4).to.equal(9);
    
      // Fifth page (1 apps)
      const [apps5, nextTokenId5] = await config.registry.getApps(9);
      expect(apps5.length).to.equal(1);
      expect(apps5[0].did).to.equal(config.apps[8].did);
      expect(nextTokenId5).to.equal(0);
});

    it("getAppsByStatus should return correct apps when getting apps by status with pagination", async function () {
      const config = await loadFixture(deployFixture9Apps);

      // Deprecate three apps
      await config.registry.connect(config.minter1).updateStatus(config.apps[1].did, 1); // DEPRECATED
      await config.registry.connect(config.minter1).updateStatus(config.apps[3].did, 1); // DEPRECATED
      await config.registry.connect(config.minter1).updateStatus(config.apps[5].did, 1); // DEPRECATED

      // First page (2 active apps)
      const [activeApps1, nextTokenId1] = await config.registry.getAppsByStatus(1, 0); // ACTIVE
      expect(activeApps1.length).to.equal(2);
      expect(activeApps1[0].did).to.equal(config.apps[0].did);
      expect(activeApps1[1].did).to.equal(config.apps[2].did);
      expect(nextTokenId1).to.equal(4);

      // Second page (2 active apps)
      const [activeApps2, nextTokenId2] = await config.registry.getAppsByStatus(4, 0); // ACTIVE
      expect(activeApps2.length).to.equal(2);
      expect(activeApps2[0].did).to.equal(config.apps[4].did);
      expect(activeApps2[1].did).to.equal(config.apps[6].did);
      expect(nextTokenId2).to.equal(8);

      // Third page (2 active apps)
      const [activeApps3, nextTokenId3] = await config.registry.getAppsByStatus(8, 0); // ACTIVE
      expect(activeApps3.length).to.equal(2);
      expect(activeApps3[0].did).to.equal(config.apps[7].did);
      expect(activeApps3[1].did).to.equal(config.apps[8].did);
      expect(nextTokenId3).to.equal(0);

      // First page (2 deprecated apps)
      const [deprecatedApps1, nextTokenId4] = await config.registry.getAppsByStatus(1, 1); // DEPRECATED
      expect(deprecatedApps1.length).to.equal(2);
      expect(deprecatedApps1[0].did).to.equal(config.apps[1].did);
      expect(deprecatedApps1[1].did).to.equal(config.apps[3].did);
      expect(nextTokenId4).to.equal(5);

      // Second page (1 deprecated app)
      const [deprecatedApps2, nextTokenId5] = await config.registry.getAppsByStatus(5, 1); // DEPRECATED
      expect(deprecatedApps2.length).to.equal(1);
      expect(deprecatedApps2[0].did).to.equal(config.apps[5].did);
      expect(nextTokenId5).to.equal(0);
    });

    it("getAppDIDs should return all DIDs in one page", async function () {
      const config = await loadFixture(deployFixture9Apps);

      // First page (5 DIDs)
      const [dids, nextTokenId] = await config.registry.getAppDIDs(1);
      expect(dids.length).to.equal(5);
      expect(dids[0]).to.equal(config.apps[0].did);
      expect(dids[1]).to.equal(config.apps[1].did);
      expect(dids[2]).to.equal(config.apps[2].did);
      expect(dids[3]).to.equal(config.apps[3].did);
      expect(dids[4]).to.equal(config.apps[4].did);
      expect(nextTokenId).to.equal(6);

      // Second page (4 DIDs)
      const [dids2, nextTokenId2] = await config.registry.getAppDIDs(6);
      expect(dids2.length).to.equal(4);
      expect(dids2[0]).to.equal(config.apps[5].did);
      expect(dids2[1]).to.equal(config.apps[6].did);
      expect(dids2[2]).to.equal(config.apps[7].did);
      expect(dids2[3]).to.equal(config.apps[8].did);
      expect(nextTokenId2).to.equal(0);
    });

    it("getAppDIDsByStatus should return correct DIDs when getting DIDs by status", async function () {
      const config = await loadFixture(deployFixture9Apps);

      // Deprecate three apps
      await config.registry.connect(config.minter1).updateStatus(config.apps[1].did, 1); // DEPRECATED
      await config.registry.connect(config.minter1).updateStatus(config.apps[3].did, 1); // DEPRECATED
      await config.registry.connect(config.minter1).updateStatus(config.apps[5].did, 1); // DEPRECATED

      // Get active DIDs (should get 5)
      const [activeDids, nextTokenId1] = await config.registry.getAppDIDsByStatus(1, 0); // ACTIVE
      expect(activeDids.length).to.equal(5);
      expect(activeDids[0]).to.equal(config.apps[0].did);
      expect(activeDids[1]).to.equal(config.apps[2].did);
      expect(activeDids[2]).to.equal(config.apps[4].did);
      expect(activeDids[3]).to.equal(config.apps[6].did);
      expect(activeDids[4]).to.equal(config.apps[7].did);
      expect(nextTokenId1).to.equal(9);

      // Get active DIDs (should get 1)
      const [activeDids2, nextTokenId2] = await config.registry.getAppDIDsByStatus(9, 0); // ACTIVE
      expect(activeDids2.length).to.equal(1);
      expect(activeDids2[0]).to.equal(config.apps[8].did);
      expect(nextTokenId2).to.equal(0);

      // Get deprecated DIDs (should get all 3 in one page)
      const [deprecatedDids, nextTokenId3] = await config.registry.getAppDIDsByStatus(1, 1); // DEPRECATED
      expect(deprecatedDids.length).to.equal(3);
      expect(deprecatedDids[0]).to.equal(config.apps[1].did);
      expect(deprecatedDids[1]).to.equal(config.apps[3].did);
      expect(deprecatedDids[2]).to.equal(config.apps[5].did);
      expect(nextTokenId3).to.equal(0);
    });

    it("getAppsByMinter should return correct apps when getting apps by minter", async function () {
      const config = await loadFixture(deployFixture9Apps);

      // Get all apps by minter1 (should get all 9)
      const apps = await config.registry.getAppsByMinter(config.minter1.address);
      expect(apps.length).to.equal(9);
      expect(apps[0].did).to.equal(config.apps[0].did);
      expect(apps[1].did).to.equal(config.apps[1].did);
      expect(apps[2].did).to.equal(config.apps[2].did);
      expect(apps[3].did).to.equal(config.apps[3].did);
      expect(apps[4].did).to.equal(config.apps[4].did);
      expect(apps[5].did).to.equal(config.apps[5].did);
      expect(apps[6].did).to.equal(config.apps[6].did);
      expect(apps[7].did).to.equal(config.apps[7].did);
      expect(apps[8].did).to.equal(config.apps[8].did);

      // Get apps by minter2 (should be empty)
      const emptyApps = await config.registry.getAppsByMinter(config.minter2.address);
      expect(emptyApps).to.be.an('array').that.is.empty;
    });
  });
});

import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("OMA3AppRegistry - Interface Query Tests", function () {
  async function deployFixture() {
    const [owner, minter1, minter2, user1] = await hre.ethers.getSigners();

    const Registry = await hre.ethers.getContractFactory("OMA3AppRegistry");
    const registry = await Registry.deploy();

    return { registry, owner, minter1, minter2, user1 };
  }

  describe("getAppsByInterface", function () {
    it("should return empty array when no apps exist", async function () {
      const { registry } = await loadFixture(deployFixture);

      const [apps, nextIndex] = await registry.getAppsByInterface(1, 0);
      expect(apps.length).to.equal(0);
      expect(nextIndex).to.equal(0);
    });

    it("should filter apps by Human interface (bit 0)", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);

      // Mint app with Human interface (0x0001)
      await registry.connect(minter1).mint(
        "did:oma3:human-app",
        1, // Human interface
        "https://example.com/human",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test")),
        0,
        "",
        "",
        1,
        0,
        0,
        [],
        ""
      );

      // Mint app with API interface (0x0002)
      await registry.connect(minter1).mint(
        "did:oma3:api-app",
        2, // API interface
        "https://example.com/api",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test2")),
        0,
        "",
        "",
        1,
        0,
        0,
        [],
        ""
      );

      const [apps, nextIndex] = await registry.getAppsByInterface(1, 0); // Query Human interface
      expect(apps.length).to.equal(1);
      expect(apps[0].did).to.equal("did:oma3:human-app");
      expect(apps[0].interfaces).to.equal(1);
      expect(nextIndex).to.equal(0); // No more pages
    });

    it("should filter apps by API interface (bit 1)", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);

      await registry.connect(minter1).mint(
        "did:oma3:human-app",
        1,
        "https://example.com/human",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test")),
        0,
        "",
        "",
        1,
        0,
        0,
        [],
        ""
      );

      await registry.connect(minter1).mint(
        "did:oma3:api-app",
        2, // API interface
        "https://example.com/api",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test2")),
        0,
        "",
        "",
        1,
        0,
        0,
        [],
        ""
      );

      const [apps, nextIndex] = await registry.getAppsByInterface(2, 0); // Query API interface
      expect(apps.length).to.equal(1);
      expect(apps[0].did).to.equal("did:oma3:api-app");
      expect(apps[0].interfaces).to.equal(2);
      expect(nextIndex).to.equal(0);
    });

    it("should filter apps by Smart Contract interface (bit 2)", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);

      await registry.connect(minter1).mint(
        "did:oma3:contract-app",
        4, // Smart Contract interface
        "https://example.com/contract",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test")),
        0,
        "",
        "",
        1,
        0,
        0,
        [],
        ""
      );

      await registry.connect(minter1).mint(
        "did:oma3:api-app",
        2,
        "https://example.com/api",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test2")),
        0,
        "",
        "",
        1,
        0,
        0,
        [],
        ""
      );

      const [apps, nextIndex] = await registry.getAppsByInterface(4, 0); // Query Smart Contract interface
      expect(apps.length).to.equal(1);
      expect(apps[0].did).to.equal("did:oma3:contract-app");
      expect(apps[0].interfaces).to.equal(4);
      expect(nextIndex).to.equal(0);
    });

    it("should support OR logic - return apps with any of the specified interfaces", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);

      // Human interface (1)
      await registry.connect(minter1).mint(
        "did:oma3:human-app",
        1,
        "https://example.com/human",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test1")),
        0,
        "",
        "",
        1,
        0,
        0,
        [],
        ""
      );

      // API interface (2)
      await registry.connect(minter1).mint(
        "did:oma3:api-app",
        2,
        "https://example.com/api",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test2")),
        0,
        "",
        "",
        1,
        0,
        0,
        [],
        ""
      );

      // Smart Contract interface (4)
      await registry.connect(minter1).mint(
        "did:oma3:contract-app",
        4,
        "https://example.com/contract",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test3")),
        0,
        "",
        "",
        1,
        0,
        0,
        [],
        ""
      );

      // Query for Human OR API (1 | 2 = 3)
      const [apps, nextIndex] = await registry.getAppsByInterface(3, 0);
      expect(apps.length).to.equal(2);
      const dids = apps.map(app => app.did);
      expect(dids).to.include("did:oma3:human-app");
      expect(dids).to.include("did:oma3:api-app");
      expect(dids).to.not.include("did:oma3:contract-app");
      expect(nextIndex).to.equal(0);
    });

    it("should return apps with combined interfaces", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);

      // App with Human + API interfaces (1 | 2 = 3)
      await registry.connect(minter1).mint(
        "did:oma3:multi-interface-app",
        3, // Human + API
        "https://example.com/multi",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test")),
        0,
        "",
        "",
        1,
        0,
        0,
        [],
        ""
      );

      // App with only Human interface
      await registry.connect(minter1).mint(
        "did:oma3:human-only",
        1,
        "https://example.com/human",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test2")),
        0,
        "",
        "",
        1,
        0,
        0,
        [],
        ""
      );

      // Query for Human interface (should match both)
      const [apps, nextIndex] = await registry.getAppsByInterface(1, 0);
      expect(apps.length).to.equal(2);

      // Query for API interface (should match only multi-interface app)
      const [apps2, nextIndex2] = await registry.getAppsByInterface(2, 0);
      expect(apps2.length).to.equal(1);
      expect(apps2[0].did).to.equal("did:oma3:multi-interface-app");
    });

    it("should handle pagination correctly", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);

      // Mint more than 100 apps (MAX_APPS_PER_PAGE)
      for (let i = 0; i < 150; i++) {
        await registry.connect(minter1).mint(
          `did:oma3:app-${i}`,
          1, // All with Human interface
          `https://example.com/app-${i}`,
          hre.ethers.keccak256(hre.ethers.toUtf8Bytes(`test${i}`)),
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

      // First page should return 100 apps
      const [page1, nextIndex1] = await registry.getAppsByInterface(1, 0);
      expect(page1.length).to.equal(100);
      expect(nextIndex1).to.equal(100); // Next page starts at index 100

      // Second page should return remaining 50 apps
      const [page2, nextIndex2] = await registry.getAppsByInterface(1, nextIndex1);
      expect(page2.length).to.equal(50);
      expect(nextIndex2).to.equal(0); // No more pages

      // Third page query should return empty
      const [page3, nextIndex3] = await registry.getAppsByInterface(1, 150);
      expect(page3.length).to.equal(0);
      expect(nextIndex3).to.equal(0);
    });

    it("should only return active apps (status = 0)", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);

      await registry.connect(minter1).mint(
        "did:oma3:active-app",
        1,
        "https://example.com/active",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test1")),
        0,
        "",
        "",
        1,
        0,
        0,
        [],
        ""
      );

      await registry.connect(minter1).mint(
        "did:oma3:deprecated-app",
        1,
        "https://example.com/deprecated",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test2")),
        0,
        "",
        "",
        1,
        0,
        0,
        [],
        ""
      );

      // Deprecate the second app
      await registry.connect(minter1).updateStatus("did:oma3:deprecated-app", 1, 1);

      // Query should only return active app
      const [apps, nextIndex] = await registry.getAppsByInterface(1, 0);
      expect(apps.length).to.equal(1);
      expect(apps[0].did).to.equal("did:oma3:active-app");
      expect(nextIndex).to.equal(0);
    });

    it("should handle mixed interfaces with pagination", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);

      // Create 60 apps: 20 Human, 20 API, 20 Smart Contract
      for (let i = 0; i < 60; i++) {
        const interfaceType = (i % 3) + 1; // Cycles through 1, 2, 3 (3 has bit 0 and 1 set)
        await registry.connect(minter1).mint(
          `did:oma3:app-${i}`,
          interfaceType === 3 ? 3 : (1 << (interfaceType - 1)), // 1, 2, or 3
          `https://example.com/app-${i}`,
          hre.ethers.keccak256(hre.ethers.toUtf8Bytes(`test${i}`)),
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

      // Query for Human interface (should match apps with interface 1 and 3)
      const [apps, nextIndex] = await registry.getAppsByInterface(1, 0);
      expect(apps.length).to.be.greaterThan(0);
      
      // Verify all returned apps have the Human interface bit set
      for (const app of apps) {
        expect(Number(app.interfaces) & 1).to.not.equal(0);
      }
    });

    it("should return correct nextStartIndex for partial page", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);

      // Create 150 apps, but only 75 with Human interface
      for (let i = 0; i < 150; i++) {
        const interfaceType = i < 75 ? 1 : 2; // First 75 are Human, rest are API
        await registry.connect(minter1).mint(
          `did:oma3:app-${i}`,
          interfaceType,
          `https://example.com/app-${i}`,
          hre.ethers.keccak256(hre.ethers.toUtf8Bytes(`test${i}`)),
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

      // First page of Human interface apps
      const [page1, nextIndex1] = await registry.getAppsByInterface(1, 0);
      expect(page1.length).to.be.lessThanOrEqual(100);
      
      if (nextIndex1 > 0) {
        // Second page
        const [page2, nextIndex2] = await registry.getAppsByInterface(1, nextIndex1);
        expect(nextIndex2).to.equal(0); // Should be last page since we have 75 Human apps
      }
    });

    it("should query all interfaces with mask 7 (0x0111)", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);

      await registry.connect(minter1).mint(
        "did:oma3:human-app",
        1,
        "https://example.com/human",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test1")),
        0,
        "",
        "",
        1,
        0,
        0,
        [],
        ""
      );

      await registry.connect(minter1).mint(
        "did:oma3:api-app",
        2,
        "https://example.com/api",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test2")),
        0,
        "",
        "",
        1,
        0,
        0,
        [],
        ""
      );

      await registry.connect(minter1).mint(
        "did:oma3:contract-app",
        4,
        "https://example.com/contract",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test3")),
        0,
        "",
        "",
        1,
        0,
        0,
        [],
        ""
      );

      // Query for all interfaces (1 | 2 | 4 = 7)
      const [apps, nextIndex] = await registry.getAppsByInterface(7, 0);
      expect(apps.length).to.equal(3);
      expect(nextIndex).to.equal(0);
    });

    it("should handle startIndex beyond total active apps", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);

      await registry.connect(minter1).mint(
        "did:oma3:app",
        1,
        "https://example.com/app",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test")),
        0,
        "",
        "",
        1,
        0,
        0,
        [],
        ""
      );

      // Query with startIndex beyond total apps
      const [apps, nextIndex] = await registry.getAppsByInterface(1, 100);
      expect(apps.length).to.equal(0);
      expect(nextIndex).to.equal(0);
    });

    it("should work correctly after interface updates", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);

      // Mint app with Human interface
      await registry.connect(minter1).mint(
        "did:oma3:evolving-app",
        1,
        "https://example.com/v1",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test1")),
        0,
        "",
        "",
        1,
        0,
        0,
        [],
        ""
      );

      // Verify only shows in Human query
      const [beforeUpdate, _] = await registry.getAppsByInterface(1, 0);
      expect(beforeUpdate.length).to.equal(1);

      const [beforeUpdate2, _2] = await registry.getAppsByInterface(2, 0);
      expect(beforeUpdate2.length).to.equal(0);

      // Update to add API interface (1 | 2 = 3)
      await registry.connect(minter1).updateAppControlled(
        "did:oma3:evolving-app",
        1,
        "https://example.com/v2",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test2")),
        0,
        3, // Human + API
        [],
        1, // Minor increment required for interface change
        0
      );

      // Now should show in both Human and API queries
      const [afterUpdateHuman, _3] = await registry.getAppsByInterface(1, 0);
      expect(afterUpdateHuman.length).to.equal(1);

      const [afterUpdateApi, _4] = await registry.getAppsByInterface(2, 0);
      expect(afterUpdateApi.length).to.equal(1);
    });

    it("should handle empty results in middle of pagination", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);

      // Create pattern: 10 Human, 150 API, 10 Human
      for (let i = 0; i < 10; i++) {
        await registry.connect(minter1).mint(
          `did:oma3:human-start-${i}`,
          1,
          `https://example.com/human-start-${i}`,
          hre.ethers.keccak256(hre.ethers.toUtf8Bytes(`test${i}`)),
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

      for (let i = 0; i < 150; i++) {
        await registry.connect(minter1).mint(
          `did:oma3:api-${i}`,
          2,
          `https://example.com/api-${i}`,
          hre.ethers.keccak256(hre.ethers.toUtf8Bytes(`test-api-${i}`)),
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

      for (let i = 0; i < 10; i++) {
        await registry.connect(minter1).mint(
          `did:oma3:human-end-${i}`,
          1,
          `https://example.com/human-end-${i}`,
          hre.ethers.keccak256(hre.ethers.toUtf8Bytes(`test-end-${i}`)),
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

      // Query for Human apps - should find all 20 eventually
      let totalHumanApps = 0;
      let currentStartIndex = 0;

      do {
        const [apps, nextIndex] = await registry.getAppsByInterface(1, currentStartIndex);
        totalHumanApps += apps.length;
        currentStartIndex = nextIndex;
      } while (currentStartIndex > 0);

      expect(totalHumanApps).to.equal(20);
    });
  });
});


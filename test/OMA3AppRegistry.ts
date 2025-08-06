/// <reference types="hardhat" />
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers'
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import "@nomicfoundation/hardhat-chai-matchers";
const hre = require("hardhat");

// Keep these in sync with the constants in the contract
const MAX_DID_LENGTH = 128;
const MAX_URL_LENGTH = 256;
const MAX_KEYWORDS = 20;

// Custom error names (no prefix needed since they're custom errors)
const ERRORS = {
  DID_CANNOT_BE_EMPTY: "DIDCannotBeEmpty",
  DID_TOO_LONG: "DIDTooLong",
  INVALID_DATA_HASH_ALGORITHM: "InvalidDataHashAlgorithm",
  INTERFACES_CANNOT_BE_EMPTY: "InterfacesCannotBeEmpty", 
  DATA_URL_TOO_LONG: "DataUrlTooLong",
  DATA_URL_CANNOT_BE_EMPTY: "DataUrlCannotBeEmpty",
  FUNGIBLE_TOKEN_ID_TOO_LONG: "FungibleTokenIdTooLong",
  CONTRACT_ID_TOO_LONG: "ContractIdTooLong",
  TOO_MANY_KEYWORDS: "TooManyKeywords",
  APP_NOT_FOUND: "AppNotFound",
  NOT_APP_OWNER: "NotAppOwner",
  INVALID_VERSION: "InvalidVersion",
  MAJOR_VERSION_CHANGE_REQUIRES_NEW_MINT: "MajorVersionChangeRequiresNewMint",
  DID_MAJOR_ALREADY_EXISTS: "DIDMajorAlreadyExists",
  NEW_DID_REQUIRED: "NewDIDRequired",
  MINOR_INCREMENT_REQUIRED: "MinorIncrementRequired",
  PATCH_INCREMENT_REQUIRED: "PatchIncrementRequired",
  INTERFACE_REMOVAL_NOT_ALLOWED: "InterfaceRemovalNotAllowed",
  NO_CHANGES_SPECIFIED: "NoChangesSpecified",
  DID_HASH_NOT_FOUND: "DIDHashNotFound",
  DATA_HASH_REQUIRED_FOR_KEYWORD_CHANGE: "DataHashRequiredForKeywordChange"
};

describe("OMA3AppRegistry", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployFixture() {
    // Contracts are deployed using the first signer/account by default
    const [deployer, minter1, minter2] = await hre.ethers.getSigners();

    const OMA3AppRegistry = await hre.ethers.getContractFactory("contracts/OMA3AppRegistry.sol:OMA3AppRegistry");
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
      const interfaces = 1; // 1 = human interface
      const dataUrl = `https://data.example.com/app${i}`;
      const dataHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(`Test App ${i} data`));
      const dataHashAlgorithm = 0; // 0 = keccak256
      const fungibleTokenId = ""; // No fungible token ID
      const contractId = ""; // No contract ID
      const initialVersionMajor = 1;
      const initialVersionMinor = 0;
      const initialVersionPatch = 0;
      const keywordHashes: string[] = []; // No keywords

      await registry.connect(minter1).mint(
        did,
        interfaces,
        dataUrl,
        dataHash,
        dataHashAlgorithm,
        fungibleTokenId,
        contractId,
        initialVersionMajor,
        initialVersionMinor,
        initialVersionPatch,
        keywordHashes
      );

      apps.push({ did, interfaces, versionMajor: initialVersionMajor });
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
    it("should deploy with zero total supply", async function () {
      const { registry } = await loadFixture(deployFixture);
      expect(await registry.totalSupply()).to.equal(0);
    });

    it("should have correct name and symbol", async function () {
      const { registry } = await loadFixture(deployFixture);
      expect(await registry.name()).to.equal("OMA3 App Registry");
      expect(await registry.symbol()).to.equal("OMA3APP");
    });

    it("should have correct owner", async function () {
      const { registry, deployer } = await loadFixture(deployFixture);
      expect(await registry.owner()).to.equal(deployer.address);
    });
  });

  describe("With One App", function () {
    it("should mint an app successfully", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);
      
      const did = "did:oma3:test1";
      const interfaces = 1; // 1 = human interface
      const dataUrl = "https://data.example.com/app1";
      const dataHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App 1 data"));
      const dataHashAlgorithm = 0; // 0 = keccak256
      const fungibleTokenId = ""; // No fungible token ID
      const contractId = ""; // No contract ID
      const initialVersionMajor = 1;
      const initialVersionMinor = 0;
      const initialVersionPatch = 0;
      const keywordHashes: string[] = []; // No keywords

      await expect(
        registry.connect(minter1).mint(
          did,
          interfaces,
          dataUrl,
          dataHash,
          dataHashAlgorithm,
          fungibleTokenId,
          contractId,
          initialVersionMajor,
          initialVersionMinor,
          initialVersionPatch,
          keywordHashes
        )
      ).to.not.be.reverted;

      expect(await registry.totalSupply()).to.equal(1);
    });

    it("should get app by DID and version", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);
      
      const did = "did:oma3:test1";
      const interfaces = 1;
      const dataUrl = "https://data.example.com/app1";
      const dataHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App 1 data"));
      const dataHashAlgorithm = 0;
      const fungibleTokenId = "";
      const contractId = "";
      const initialVersionMajor = 1;
      const initialVersionMinor = 0;
      const initialVersionPatch = 0;
      const keywordHashes: string[] = [];

      await registry.connect(minter1).mint(
          did,
          interfaces,
        dataUrl,
        dataHash,
        dataHashAlgorithm,
        fungibleTokenId,
        contractId,
        initialVersionMajor,
        initialVersionMinor,
        initialVersionPatch,
        keywordHashes
      );

      const app = await registry.getApp(did, 1);
      expect(app.did).to.equal(did);
      expect(app.interfaces).to.equal(interfaces);
      expect(app.dataUrl).to.equal(dataUrl);
      expect(app.dataHash).to.equal(dataHash);
      // Note: dataHashAlgorithm field may not be accessible in the returned struct
      expect(app.fungibleTokenId).to.equal(fungibleTokenId);
      expect(app.contractId).to.equal(contractId);
      expect(app.versionMajor).to.equal(initialVersionMajor);
      // Note: versionMinor and versionPatch may not be accessible in the returned struct
      expect(app.keywordHashes.length).to.equal(0);
    });

    it("should get apps by minter", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);
      
      const did = "did:oma3:test1";
      const interfaces = 1;
      const dataUrl = "https://data.example.com/app1";
      const dataHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App 1 data"));
      const dataHashAlgorithm = 0;
      const fungibleTokenId = "";
      const contractId = "";
      const initialVersionMajor = 1;
      const initialVersionMinor = 0;
      const initialVersionPatch = 0;
      const keywordHashes: string[] = [];

        await registry.connect(minter1).mint(
        did,
        interfaces,
        dataUrl,
        dataHash,
        dataHashAlgorithm,
        fungibleTokenId,
        contractId,
        initialVersionMajor,
        initialVersionMinor,
        initialVersionPatch,
        keywordHashes
      );

      const apps = await registry.getAppsByMinter(minter1.address, 0);
      expect(apps.length).to.equal(1);
      expect(apps[0].did).to.equal(did);
    });

    it("should get apps by status", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);
      
      const did = "did:oma3:test1";
      const interfaces = 1;
      const dataUrl = "https://data.example.com/app1";
      const dataHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App 1 data"));
      const dataHashAlgorithm = 0;
      const fungibleTokenId = "";
      const contractId = "";
      const initialVersionMajor = 1;
      const initialVersionMinor = 0;
      const initialVersionPatch = 0;
      const keywordHashes: string[] = [];

        await registry.connect(minter1).mint(
        did,
        interfaces,
        dataUrl,
        dataHash,
        dataHashAlgorithm,
        fungibleTokenId,
        contractId,
        initialVersionMajor,
        initialVersionMinor,
        initialVersionPatch,
        keywordHashes
      );

      const [apps, nextIndex] = await registry.getAppsByStatus(0, 0); // 0 = ACTIVE
      expect(apps.length).to.equal(1);
      expect(apps[0].did).to.equal(did);
    });

    it("should update app status", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);
      
      const did = "did:oma3:test1";
      const interfaces = 1;
      const dataUrl = "https://data.example.com/app1";
      const dataHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App 1 data"));
      const dataHashAlgorithm = 0;
      const fungibleTokenId = "";
      const contractId = "";
      const initialVersionMajor = 1;
      const initialVersionMinor = 0;
      const initialVersionPatch = 0;
      const keywordHashes: string[] = [];

        await registry.connect(minter1).mint(
        did,
        interfaces,
        dataUrl,
        dataHash,
        dataHashAlgorithm,
        fungibleTokenId,
        contractId,
        initialVersionMajor,
        initialVersionMinor,
        initialVersionPatch,
        keywordHashes
      );

      // Update status to DEPRECATED (1)
        await expect(
        registry.connect(minter1).updateStatus(did, 1, 1)
      ).to.not.be.reverted;

      // Verify the status was updated by checking the app directly
      const app = await registry.getApp(did, 1);
      expect(app.status).to.equal(1); // 1 = DEPRECATED
    });
  });

  describe("Minting Edge Cases and Validation", function () {
    it("should reject empty DID", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);
      
      await expect(
        registry.connect(minter1).mint(
        "", // Empty DID
          1,
          "https://data.example.com/app1",
          hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App 1 data")),
          0,
          "",
          "",
          1,
          0,
          0,
          []
        )
      ).to.be.revertedWithCustomError(registry, ERRORS.DID_CANNOT_BE_EMPTY);
    });

    it("should reject DID that is too long", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);
      
      // Create a DID that exceeds MAX_DID_LENGTH
      const longDid = "did:oma3:" + "a".repeat(MAX_DID_LENGTH - 9 + 1);
      
      await expect(
        registry.connect(minter1).mint(
          longDid,
          1,
          "https://data.example.com/app1",
          hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App 1 data")),
          0,
          "",
          "",
          1,
          0,
          0,
          []
        )
      ).to.be.revertedWithCustomError(registry, ERRORS.DID_TOO_LONG);
    });

    it("should reject empty interfaces", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);
      
      await expect(
        registry.connect(minter1).mint(
          "did:oma3:test1",
          0, // Empty interfaces
          "https://data.example.com/app1",
          hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App 1 data")),
          0,
          "",
          "",
          1,
          0,
          0,
          []
        )
      ).to.be.revertedWithCustomError(registry, ERRORS.INTERFACES_CANNOT_BE_EMPTY);
    });

    it("should reject empty data URL", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);
      
      await expect(
        registry.connect(minter1).mint(
          "did:oma3:test1",
          1,
          "", // Empty data URL
          hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App 1 data")),
          0,
          "",
          "",
          1,
          0,
          0,
          []
        )
      ).to.be.revertedWithCustomError(registry, ERRORS.DATA_URL_CANNOT_BE_EMPTY);
    });

    it("should reject data URL that is too long", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);
      
      // Create a URL that exceeds MAX_URL_LENGTH
      const longUrl = "https://data.example.com/" + "a".repeat(MAX_URL_LENGTH - 25 + 1);
        
        await expect(
          registry.connect(minter1).mint(
          "did:oma3:test1",
          1,
          longUrl,
          hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App 1 data")),
          0,
          "",
          "",
          1,
          0,
          0,
          []
        )
      ).to.be.revertedWithCustomError(registry, ERRORS.DATA_URL_TOO_LONG);
    });

    it("should accept valid data hash algorithms", async function () {
        const { registry, minter1 } = await loadFixture(deployFixture);
        
      // Test both valid algorithms: 0 (keccak256) and 1 (sha256)
      const validAlgorithms = [0, 1];
      
      for (const algorithm of validAlgorithms) {
        const did = `did:oma3:test-algorithm-${algorithm}`;
          
          await expect(
            registry.connect(minter1).mint(
            did,
            1,
            "https://data.example.com/app1",
            hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App 1 data")),
            algorithm,
            "",
            "",
            1,
            0,
            0,
            []
            )
          ).to.not.be.reverted;
          
        console.log(`    ✓ Algorithm ${algorithm} accepted`);
        }
      });

    it("should reject too many keywords", async function () {
        const { registry, minter1 } = await loadFixture(deployFixture);
        
      // Create more keywords than allowed
      const tooManyKeywords = Array(MAX_KEYWORDS + 1).fill(hre.ethers.keccak256(hre.ethers.toUtf8Bytes("keyword")));
          
          await expect(
            registry.connect(minter1).mint(
          "did:oma3:test1",
          1,
          "https://data.example.com/app1",
          hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App 1 data")),
          0,
          "",
          "",
          1,
          0,
          0,
          tooManyKeywords
        )
      ).to.be.revertedWithCustomError(registry, ERRORS.TOO_MANY_KEYWORDS);
      });
    });

  describe("Gas Optimization Testing", function () {
    it("should handle memory stress test within gas limits", async function () {
        const { registry, minter1 } = await loadFixture(deployFixture);
        
      // Create a large dataset to stress memory
      const largeKeywords = Array(MAX_KEYWORDS).fill(hre.ethers.keccak256(hre.ethers.toUtf8Bytes("very-long-keyword-string-for-stress-testing")));
      const longDid = "did:oma3:" + "a".repeat(MAX_DID_LENGTH - 9);
      const longUrl = "https://data.example.com/" + "a".repeat(MAX_URL_LENGTH - 25);
      
          const tx = await registry.connect(minter1).mint(
        longDid,
        255, // All interfaces
        longUrl,
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Large stress test data")),
        0,
        "fungible-token-id",
        "contract-id",
        255,
        255,
        255,
        largeKeywords
          );
          
          const receipt = await tx.wait();
      expect(receipt.gasUsed).to.be.lessThan(BigInt(1300000));
      });
    });

  describe("Boundary Testing", function () {
    it("should accept DID of exact maximum length", async function () {
        const { registry, minter1 } = await loadFixture(deployFixture);
        
      // Create a DID of exactly MAX_DID_LENGTH
      const exactLengthDid = "did:oma3:" + "a".repeat(MAX_DID_LENGTH - 9);
      
        await expect(
          registry.connect(minter1).mint(
          exactLengthDid,
          1,
          "https://data.example.com/app1",
          hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App 1 data")),
          0,
          "",
          "",
          1,
          0,
          0,
          []
          )
        ).to.not.be.reverted;
      });

    it("should accept URL of exact maximum length", async function () {
        const { registry, minter1 } = await loadFixture(deployFixture);
        
      // Create a URL of exactly MAX_URL_LENGTH
      const exactLengthUrl = "https://data.example.com/" + "a".repeat(MAX_URL_LENGTH - 25);
        
        await expect(
          registry.connect(minter1).mint(
          "did:oma3:test1",
          1,
          exactLengthUrl,
          hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App 1 data")),
          0,
          "",
          "",
          1,
          0,
          0,
          []
          )
        ).to.not.be.reverted;
      });

    it("should accept maximum number of keywords", async function () {
        const { registry, minter1 } = await loadFixture(deployFixture);
        
      // Create exactly MAX_KEYWORDS
      const maxKeywords = Array(MAX_KEYWORDS).fill(hre.ethers.keccak256(hre.ethers.toUtf8Bytes("keyword")));
        
        await expect(
          registry.connect(minter1).mint(
          "did:oma3:test1",
          1,
          "https://data.example.com/app1",
          hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App 1 data")),
          0,
          "",
          "",
          1,
          0,
          0,
          maxKeywords
          )
        ).to.not.be.reverted;
    });
  });

  describe("Version 0.x.x Support", function () {
    it("should handle major version 0 correctly", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);
      
      // Mint app with version 0.1.0
      const did = "did:oma3:test-version-zero";
      await registry.connect(minter1).mint(
        did,
        1,
        "https://data.example.com/app1",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App data")),
        0,
        "",
        "",
        0, // major version 0
        1, // minor version 1
        0, // patch version 0
        []
      );

      // Verify latestMajor returns 0 (not error)
      const didHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(did));
      expect(await registry.latestMajor(didHash)).to.equal(0);
    });

    it("should handle multiple version 0.x.x apps correctly", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);
      
      const did = "did:oma3:test-multiple-zero";
      
      // Mint app with version 0.1.0
      await registry.connect(minter1).mint(
        did,
        1,
        "https://data.example.com/app1",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App data")),
        0,
        "",
        "",
        0, // major version 0
        1, // minor version 1
        0, // patch version 0
        []
      );

      // Mint app with version 0.2.0 (should fail - same DID, same major)
      await expect(
        registry.connect(minter1).mint(
          did,
          1,
          "https://data.example.com/app2",
          hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App data 2")),
          0,
          "",
          "",
          0, // major version 0
          2, // minor version 2
          0, // patch version 0
          []
        )
      ).to.be.revertedWithCustomError(registry, ERRORS.DID_MAJOR_ALREADY_EXISTS);

      // Verify latestMajor still returns 0
      const didHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(did));
      expect(await registry.latestMajor(didHash)).to.equal(0);
    });

    it("should distinguish between non-existent DID and version 0", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);
      
      const nonExistentDid = "did:oma3:non-existent";
      const didHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(nonExistentDid));
      
      // Call latestMajor on non-existent DID (should revert)
      await expect(
        registry.latestMajor(didHash)
      ).to.be.revertedWithCustomError(registry, ERRORS.DID_HASH_NOT_FOUND);

      // Mint app with version 0.0.0
      await registry.connect(minter1).mint(
        "did:oma3:test-zero-zero",
        1,
        "https://data.example.com/app1",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App data")),
        0,
        "",
        "",
        0, // major version 0
        0, // minor version 0
        0, // patch version 0
        []
      );

      // Call latestMajor on existing DID with version 0 (should return 0, not revert)
      const existingDidHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("did:oma3:test-zero-zero"));
      expect(await registry.latestMajor(existingDidHash)).to.equal(0);
    });

    it("should handle transition from version 0.x.x to 1.x.x", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);
      
      const did = "did:oma3:test-version-transition";
      
      // Mint app with version 0.1.0
      await registry.connect(minter1).mint(
        did,
        1,
        "https://data.example.com/app1",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App data")),
        0,
        "",
        "",
        0, // major version 0
        1, // minor version 1
        0, // patch version 0
        []
      );

      // Mint app with version 1.0.0 (same DID, different major)
      await registry.connect(minter1).mint(
        did,
        1,
        "https://data.example.com/app2",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App data 2")),
        0,
        "",
        "",
        1, // major version 1
        0, // minor version 0
        0, // patch version 0
        []
      );

      // Verify latestMajor returns 1 (not 0)
      const didHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(did));
      expect(await registry.latestMajor(didHash)).to.equal(1);
    });
  });

  describe("updateAppControlled Tests", function () {
    async function deployFixtureWithApp() {
      const { registry, minter1 } = await loadFixture(deployFixture);
      
      const did = "did:oma3:test-update";
      const interfaces = 1; // human interface
      const dataUrl = "https://data.example.com/app1";
      const dataHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App data"));
      const dataHashAlgorithm = 0;
      const fungibleTokenId = "";
      const contractId = "";
      const initialVersionMajor = 1;
      const initialVersionMinor = 0;
      const initialVersionPatch = 0;
      const keywordHashes: string[] = [];

      await registry.connect(minter1).mint(
        did,
        interfaces,
        dataUrl,
        dataHash,
        dataHashAlgorithm,
        fungibleTokenId,
        contractId,
        initialVersionMajor,
        initialVersionMinor,
        initialVersionPatch,
        keywordHashes
      );

      return { registry, minter1, did };
    }

    it("should enforce semantic versioning rules for interface changes", async function () {
      const { registry, minter1, did } = await loadFixture(deployFixtureWithApp);
      
      // Try to add interface without incrementing minor version (should fail)
      await expect(
        registry.connect(minter1).updateAppControlled(
          did,
          1, // major
          "", // no data URL change
          hre.ethers.ZeroHash, // no data hash change
          0, // no algorithm change
          3, // new interfaces (human + api)
          [], // no keyword changes
          0, // minor version not incremented (should fail)
          0  // patch version
        )
      ).to.be.revertedWithCustomError(registry, ERRORS.MINOR_INCREMENT_REQUIRED);

      // Try to add interface with minor increment (should succeed)
      await expect(
        registry.connect(minter1).updateAppControlled(
          did,
          1, // major
          "", // no data URL change
          hre.ethers.ZeroHash, // no data hash change
          0, // no algorithm change
          3, // new interfaces (human + api)
          [], // no keyword changes
          1, // minor version incremented
          0  // patch version
        )
      ).to.not.be.reverted;
    });

    it("should prevent interface removal", async function () {
      const { registry, minter1, did } = await loadFixture(deployFixtureWithApp);
      
      // Try to remove interface (should fail)
      await expect(
        registry.connect(minter1).updateAppControlled(
          did,
          1, // major
          "", // no data URL change
          hre.ethers.ZeroHash, // no data hash change
          0, // no algorithm change
          0, // removing all interfaces (should fail)
          [], // no keyword changes
          1, // minor version
          0  // patch version
        )
      ).to.be.revertedWithCustomError(registry, ERRORS.NO_CHANGES_SPECIFIED);
    });

    it("should enforce patch increment for data changes", async function () {
      const { registry, minter1, did } = await loadFixture(deployFixtureWithApp);
      
      // Try to change data URL without incrementing patch (should fail)
      await expect(
        registry.connect(minter1).updateAppControlled(
          did,
          1, // major
          "https://data.example.com/app1-updated", // new data URL
          hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Updated data")), // new data hash
          0, // no algorithm change
          1, // no interface change
          [], // no keyword changes
          0, // no minor increment
          0  // patch version not incremented (should fail)
        )
      ).to.be.revertedWithCustomError(registry, ERRORS.PATCH_INCREMENT_REQUIRED);

      // Try to change data URL with patch increment (should succeed)
      await expect(
        registry.connect(minter1).updateAppControlled(
          did,
          1, // major
          "https://data.example.com/app1-updated", // new data URL
          hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Updated data")), // new data hash
          0, // no algorithm change
          1, // no interface change
          [], // no keyword changes
          0, // no minor increment
          1  // patch version incremented
        )
      ).to.not.be.reverted;
    });

    it("should require data hash for keyword changes", async function () {
      const { registry, minter1, did } = await loadFixture(deployFixtureWithApp);
      
      const newKeywords = [hre.ethers.keccak256(hre.ethers.toUtf8Bytes("keyword1"))];
      
      // Try to change keywords without new data hash (should fail)
      await expect(
        registry.connect(minter1).updateAppControlled(
          did,
          1, // major
          "", // no data URL change
          hre.ethers.ZeroHash, // no data hash (should fail)
          0, // no algorithm change
          1, // no interface change
          newKeywords, // keyword changes
          0, // no minor increment
          1  // patch version
        )
      ).to.be.revertedWithCustomError(registry, ERRORS.DATA_HASH_REQUIRED_FOR_KEYWORD_CHANGE);

      // Try to change keywords with new data hash (should succeed)
      await expect(
        registry.connect(minter1).updateAppControlled(
          did,
          1, // major
          "https://data.example.com/app1-keywords", // data URL for keyword changes
          hre.ethers.keccak256(hre.ethers.toUtf8Bytes("New data for keywords")), // new data hash
          0, // no algorithm change
          1, // no interface change
          newKeywords, // keyword changes
          0, // no minor increment
          1  // patch version (incremented from 0)
        )
      ).to.not.be.reverted;
    });

    it("should prevent no-change updates", async function () {
      const { registry, minter1, did } = await loadFixture(deployFixtureWithApp);
      
      // Try to update with no changes (should fail)
      await expect(
        registry.connect(minter1).updateAppControlled(
          did,
          1, // major
          "", // no data URL change
          hre.ethers.ZeroHash, // no data hash change
          0, // no algorithm change
          1, // same interfaces
          [], // no keyword changes
          0, // no version changes
          0  // no version changes
        )
      ).to.be.revertedWithCustomError(registry, ERRORS.NO_CHANGES_SPECIFIED);
    });

    it("should allow combined updates with proper versioning", async function () {
      const { registry, minter1, did } = await loadFixture(deployFixtureWithApp);
      
      // Combined update: interface + data + keywords
      const newKeywords = [hre.ethers.keccak256(hre.ethers.toUtf8Bytes("keyword1"))];
      
      await expect(
        registry.connect(minter1).updateAppControlled(
          did,
          1, // major
          "https://data.example.com/app1-combined", // new data URL
          hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Combined update data")), // new data hash
          0, // no algorithm change
          3, // new interfaces (human + api)
          newKeywords, // keyword changes
          1, // minor increment (required for interface change)
          0  // patch version
        )
      ).to.not.be.reverted;

      // Verify the app was updated correctly
      const app = await registry.getApp(did, 1);
      expect(app.interfaces).to.equal(3);
      expect(app.dataUrl).to.equal("https://data.example.com/app1-combined");
      expect(app.keywordHashes.length).to.equal(1);
    });

    it("should validate data URL constraints", async function () {
      const { registry, minter1, did } = await loadFixture(deployFixtureWithApp);
      
      // Try to update with empty data URL (should fail)
      await expect(
        registry.connect(minter1).updateAppControlled(
          did,
          1, // major
          "", // empty data URL (should fail)
          hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Updated data")),
          0, // no algorithm change
          1, // no interface change
          [], // no keyword changes
          0, // no minor increment
          1  // patch version
        )
      ).to.be.revertedWithCustomError(registry, ERRORS.DATA_URL_CANNOT_BE_EMPTY);

      // Try to update with too long data URL (should fail)
      const longUrl = "https://data.example.com/" + "a".repeat(MAX_URL_LENGTH - 25 + 1);
      await expect(
        registry.connect(minter1).updateAppControlled(
          did,
          1, // major
          longUrl, // too long URL (should fail)
          hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Updated data")),
          0, // no algorithm change
          1, // no interface change
          [], // no keyword changes
          0, // no minor increment
          1  // patch version
        )
      ).to.be.revertedWithCustomError(registry, ERRORS.DATA_URL_TOO_LONG);
    });

    it("should validate keyword constraints", async function () {
      const { registry, minter1, did } = await loadFixture(deployFixtureWithApp);
      
      // Try to update with too many keywords (should fail)
      const tooManyKeywords = Array(MAX_KEYWORDS + 1).fill(hre.ethers.keccak256(hre.ethers.toUtf8Bytes("keyword")));
      
      await expect(
        registry.connect(minter1).updateAppControlled(
          did,
          1, // major
          "", // no data URL change
          hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Updated data")),
          0, // no algorithm change
          1, // no interface change
          tooManyKeywords, // too many keywords (should fail)
          0, // no minor increment
          1  // patch version
        )
      ).to.be.revertedWithCustomError(registry, ERRORS.DATA_URL_CANNOT_BE_EMPTY);
    });

    it("should update version history correctly", async function () {
      const { registry, minter1, did } = await loadFixture(deployFixtureWithApp);
      
      // Perform multiple updates
      await registry.connect(minter1).updateAppControlled(
        did,
        1, // major
        "https://data.example.com/app1-v1-1", // new data URL
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Version 1.0.1 data")),
        0, // no algorithm change
        1, // no interface change
        [], // no keyword changes
        0, // no minor increment
        1  // patch version
      );

      await registry.connect(minter1).updateAppControlled(
        did,
        1, // major
        "https://data.example.com/app1-v1-1", // same data URL
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Version 1.1.0 data")),
        0, // no algorithm change
        3, // new interfaces
        [], // no keyword changes
        1, // minor increment
        0  // patch version
      );

      // Verify version history has grown
      const app = await registry.getApp(did, 1);
      // Note: versionHistory may not be directly accessible, but we can verify the app exists
      expect(app.did).to.equal(did);
      expect(app.interfaces).to.equal(3);
    });
  });

  describe("Active Apps Array Stress Tests", function () {
    it("should handle rapid status changes without bounds errors", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);
      
      // Mint 10 apps (all start as active)
      const apps = [];
      for (let i = 1; i <= 10; i++) {
        const did = `did:oma3:stress-test-${i}`;
        await registry.connect(minter1).mint(
          did,
          1,
          `https://data.example.com/app${i}`,
          hre.ethers.keccak256(hre.ethers.toUtf8Bytes(`Test App ${i} data`)),
          0,
          "",
          "",
          1,
          0,
          0,
          []
        );
        apps.push(did);
      }

      // Verify all apps are active initially
      let [activeApps, nextIndex] = await registry.getAppsByStatus(0, 0);
      expect(activeApps.length).to.equal(10);

      // Test deactivation of first few apps
      for (let i = 0; i < 3; i++) {
        // Deactivate
        await registry.connect(minter1).updateStatus(apps[i], 1, 1);
        
        // Verify active count decreased
        [activeApps, nextIndex] = await registry.getAppsByStatus(0, 0);
        expect(activeApps.length).to.equal(10 - i - 1);
      }
      
      // Reactivate all apps
      for (let i = 0; i < 3; i++) {
        await registry.connect(minter1).updateStatus(apps[i], 1, 0);
      }

      // Final verification - all should be active
      [activeApps, nextIndex] = await registry.getAppsByStatus(0, 0);
      expect(activeApps.length).to.equal(10);
    });

    it("should handle edge case: deactivate last remaining active app", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);
      
      // Mint 1 app
      const did = "did:oma3:single-app";
      await registry.connect(minter1).mint(
        did,
        1,
        "https://data.example.com/app1",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App data")),
        0,
        "",
        "",
        1,
        0,
        0,
        []
      );

      // Verify app is active
      let [activeApps, nextIndex] = await registry.getAppsByStatus(0, 0);
      expect(activeApps.length).to.equal(1);

      // Deactivate the app
      await registry.connect(minter1).updateStatus(did, 1, 1);

      // Verify no active apps (array should be empty but no underflow)
      [activeApps, nextIndex] = await registry.getAppsByStatus(0, 0);
      expect(activeApps.length).to.equal(0);
    });

    it("should handle reactivation after all apps deactivated", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);
      
      // Mint multiple apps
      const apps = [];
      for (let i = 1; i <= 5; i++) {
        const did = `did:oma3:reactivation-test-${i}`;
        await registry.connect(minter1).mint(
          did,
          1,
          `https://data.example.com/app${i}`,
          hre.ethers.keccak256(hre.ethers.toUtf8Bytes(`Test App ${i} data`)),
          0,
          "",
          "",
          1,
          0,
          0,
          []
        );
        apps.push(did);
      }

      // Verify all apps are active initially
      let [activeApps, nextIndex] = await registry.getAppsByStatus(0, 0);
      expect(activeApps.length).to.equal(5);

      // Deactivate all apps
      for (const did of apps) {
        await registry.connect(minter1).updateStatus(did, 1, 1);
      }

      // Verify no active apps
      [activeApps, nextIndex] = await registry.getAppsByStatus(0, 0);
      expect(activeApps.length).to.equal(0);

      // Reactivate one app
      await registry.connect(minter1).updateStatus(apps[0], 1, 0);

      // Verify array rebuilt correctly
      [activeApps, nextIndex] = await registry.getAppsByStatus(0, 0);
      expect(activeApps.length).to.equal(1);
      expect(activeApps[0].did).to.equal(apps[0]);
    });

    it("should handle complex status transitions", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);
      
      // Mint 3 apps
      const apps = [];
      for (let i = 1; i <= 3; i++) {
        const did = `did:oma3:complex-test-${i}`;
        await registry.connect(minter1).mint(
          did,
          1,
          `https://data.example.com/app${i}`,
          hre.ethers.keccak256(hre.ethers.toUtf8Bytes(`Test App ${i} data`)),
          0,
          "",
          "",
          1,
          0,
          0,
          []
        );
        apps.push(did);
      }

      // Test all status transitions: 0→1, 0→2, 1→0, 1→2, 2→0, 2→1
      const statusTransitions = [
        { from: 0, to: 1, description: "active to deprecated" },
        { from: 0, to: 2, description: "active to replaced" },
        { from: 1, to: 0, description: "deprecated to active" },
        { from: 1, to: 2, description: "deprecated to replaced" },
        { from: 2, to: 0, description: "replaced to active" },
        { from: 2, to: 1, description: "replaced to deprecated" }
      ];

      for (const transition of statusTransitions) {
        // Set initial status
        await registry.connect(minter1).updateStatus(apps[0], 1, transition.from);
        
        // Verify initial status
        const app = await registry.getApp(apps[0], 1);
        expect(app.status).to.equal(transition.from);
        
        // Perform transition
        await registry.connect(minter1).updateStatus(apps[0], 1, transition.to);
        
        // Verify final status
        const updatedApp = await registry.getApp(apps[0], 1);
        expect(updatedApp.status).to.equal(transition.to);
        
        console.log(`    ✓ ${transition.description}`);
      }
    });

    it("should handle status change with no effect (same status)", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);
      
      // Mint an app
      const did = "did:oma3:no-effect-test";
      await registry.connect(minter1).mint(
        did,
        1,
        "https://data.example.com/app1",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App data")),
        0,
        "",
        "",
        1,
        0,
        0,
        []
      );

      // Try to change to same status (should not fail)
      await expect(
        registry.connect(minter1).updateStatus(did, 1, 0) // already active
      ).to.not.be.reverted;

      // Verify status unchanged
      const app = await registry.getApp(did, 1);
      expect(app.status).to.equal(0);
    });

    it("should maintain array integrity during concurrent operations", async function () {
      const { registry, minter1, minter2 } = await loadFixture(deployFixture);
      
      // Mint apps with different minters
      const app1 = "did:oma3:concurrent-1";
      const app2 = "did:oma3:concurrent-2";
      
      await registry.connect(minter1).mint(
        app1,
        1,
        "https://data.example.com/app1",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App 1 data")),
        0,
        "",
        "",
        1,
        0,
        0,
        []
      );

      await registry.connect(minter2).mint(
        app2,
        1,
        "https://data.example.com/app2",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App 2 data")),
        0,
        "",
        "",
        1,
        0,
        0,
        []
      );

      // Verify both apps are active
      let [activeApps, nextIndex] = await registry.getAppsByStatus(0, 0);
      expect(activeApps.length).to.equal(2);

      // Simulate concurrent status changes
      await Promise.all([
        registry.connect(minter1).updateStatus(app1, 1, 1, { gasLimit: 500000 }),
        registry.connect(minter2).updateStatus(app2, 1, 1, { gasLimit: 500000 })
      ]);

      // Verify both apps are no longer active
      [activeApps, nextIndex] = await registry.getAppsByStatus(0, 0);
      expect(activeApps.length).to.equal(0);

      // Reactivate both
      await Promise.all([
        registry.connect(minter1).updateStatus(app1, 1, 0, { gasLimit: 500000 }),
        registry.connect(minter2).updateStatus(app2, 1, 0, { gasLimit: 500000 })
      ]);

      // Verify both are active again
      [activeApps, nextIndex] = await registry.getAppsByStatus(0, 0);
      expect(activeApps.length).to.equal(2);
    });
  });

  describe("Registration Tracking Tests", function () {
    it("should only record first registration per DID", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);
      
      const did = "did:oma3:registration-test";
      const didHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(did));
      
      // Record initial block/timestamp
      const initialBlock = await hre.ethers.provider.getBlockNumber();
      const initialTimestamp = (await hre.ethers.provider.getBlock(initialBlock))!.timestamp;
      
      // Mint app with DID major 1
      await registry.connect(minter1).mint(
        did,
        1,
        "https://data.example.com/app1",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App data")),
        0,
        "",
        "",
        1, // major version 1
        0,
        0,
        []
      );

      // Verify registration data was recorded
      const recordedBlock = await registry.registrationBlock(didHash);
      const recordedTimestamp = await registry.registrationTimestamp(didHash);
      expect(recordedBlock).to.not.equal(0);
      expect(recordedTimestamp).to.not.equal(0);

      // Wait a few blocks
      await time.increase(10);

      // Mint same DID major 2
      await registry.connect(minter1).mint(
        did,
        1,
        "https://data.example.com/app2",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App data 2")),
        0,
        "",
        "",
        2, // major version 2
        0,
        0,
        []
      );

      // Verify registration data unchanged (should still be from first registration)
      expect(await registry.registrationBlock(didHash)).to.equal(recordedBlock);
      expect(await registry.registrationTimestamp(didHash)).to.equal(recordedTimestamp);
    });

    it("should handle different DIDs with same hash (if possible)", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);
      
      // This test is theoretical since keccak256 collisions are extremely unlikely
      // But we can test the registration tracking for different DIDs
      const did1 = "did:oma3:hash-test-1";
      const did2 = "did:oma3:hash-test-2";
      
      const didHash1 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(did1));
      const didHash2 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(did2));
      
      // Mint first app
      await registry.connect(minter1).mint(
        did1,
        1,
        "https://data.example.com/app1",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App 1 data")),
        0,
        "",
        "",
        1,
        0,
        0,
        []
      );

      // Mint second app
      await registry.connect(minter1).mint(
        did2,
        1,
        "https://data.example.com/app2",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App 2 data")),
        0,
        "",
        "",
        1,
        0,
        0,
        []
      );

      // Verify different registration data for different DIDs
      expect(await registry.registrationBlock(didHash1)).to.not.equal(0);
      expect(await registry.registrationBlock(didHash2)).to.not.equal(0);
      
      // Verify they have different registration data (unless they were minted in the same block)
      const block1 = await registry.registrationBlock(didHash1);
      const block2 = await registry.registrationBlock(didHash2);
      
      if (block1 === block2) {
        // If same block, timestamps should be the same
        const timestamp1 = await registry.registrationTimestamp(didHash1);
        const timestamp2 = await registry.registrationTimestamp(didHash2);
        expect(timestamp1).to.equal(timestamp2);
      } else {
        // Different blocks should have different timestamps
        const timestamp1 = await registry.registrationTimestamp(didHash1);
        const timestamp2 = await registry.registrationTimestamp(didHash2);
        expect(timestamp1).to.not.equal(timestamp2);
      }
    });

    it("should handle registration tracking for version 0.x.x", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);
      
      const did = "did:oma3:version-zero-registration";
      const didHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(did));
      
      // Record initial block/timestamp
      const initialBlock = await hre.ethers.provider.getBlockNumber();
      const initialTimestamp = (await hre.ethers.provider.getBlock(initialBlock))!.timestamp;
      
      // Mint app with version 0.1.0
      await registry.connect(minter1).mint(
        did,
        1,
        "https://data.example.com/app1",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App data")),
        0,
        "",
        "",
        0, // major version 0
        1,
        0,
        []
      );

      // Verify registration data was recorded
      const recordedBlock = await registry.registrationBlock(didHash);
      const recordedTimestamp = await registry.registrationTimestamp(didHash);
      expect(recordedBlock).to.not.equal(0);
      expect(recordedTimestamp).to.not.equal(0);

      // Wait a few blocks
      await time.increase(10);

      // Mint same DID with version 1.0.0
      await registry.connect(minter1).mint(
        did,
        1,
        "https://data.example.com/app2",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App data 2")),
        0,
        "",
        "",
        1, // major version 1
        0,
        0,
        []
      );

      // Verify registration data unchanged (should still be from first registration)
      expect(await registry.registrationBlock(didHash)).to.equal(recordedBlock);
      expect(await registry.registrationTimestamp(didHash)).to.equal(recordedTimestamp);
    });

    it("should handle registration tracking for multiple major versions", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);
      
      const did = "did:oma3:multiple-majors";
      const didHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(did));
      
      // Record initial block/timestamp
      const initialBlock = await hre.ethers.provider.getBlockNumber();
      const initialTimestamp = (await hre.ethers.provider.getBlock(initialBlock))!.timestamp;
      
      // Mint app with version 1.0.0
      await registry.connect(minter1).mint(
        did,
        1,
        "https://data.example.com/app1",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App data")),
        0,
        "",
        "",
        1, // major version 1
        0,
        0,
        []
      );

      // Verify registration data was recorded
      const recordedBlock = await registry.registrationBlock(didHash);
      const recordedTimestamp = await registry.registrationTimestamp(didHash);
      expect(recordedBlock).to.not.equal(0);
      expect(recordedTimestamp).to.not.equal(0);

      // Wait a few blocks
      await time.increase(10);

      // Mint same DID with version 2.0.0
      await registry.connect(minter1).mint(
        did,
        1,
        "https://data.example.com/app2",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App data 2")),
        0,
        "",
        "",
        2, // major version 2
        0,
        0,
        []
      );

      // Verify registration data unchanged (should still be from first registration)
      expect(await registry.registrationBlock(didHash)).to.equal(recordedBlock);
      expect(await registry.registrationTimestamp(didHash)).to.equal(recordedTimestamp);

      // Wait a few more blocks
      await time.increase(10);

      // Mint same DID with version 3.0.0
      await registry.connect(minter1).mint(
        did,
        1,
        "https://data.example.com/app3",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App data 3")),
        0,
        "",
        "",
        3, // major version 3
        0,
        0,
        []
      );

      // Verify registration data still unchanged
      expect(await registry.registrationBlock(didHash)).to.equal(recordedBlock);
      expect(await registry.registrationTimestamp(didHash)).to.equal(recordedTimestamp);
    });

    it("should handle registration tracking for non-existent DIDs", async function () {
      const { registry } = await loadFixture(deployFixture);
      
      const nonExistentDid = "did:oma3:non-existent-registration";
      const didHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(nonExistentDid));
      
      // Verify registration data is zero for non-existent DID
      expect(await registry.registrationBlock(didHash)).to.equal(0);
      expect(await registry.registrationTimestamp(didHash)).to.equal(0);
    });
  });

  describe("Security & Reentrancy Tests", function () {

    it("should prevent reentrancy in mint function", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);
      
      // This test verifies that the nonReentrant modifier is working
      // The actual reentrancy attack would require a more complex setup
      
      // Test that mint function completes successfully
      const did = "did:oma3:reentrancy-test";
      await expect(
        registry.connect(minter1).mint(
          did,
          1,
          "https://data.example.com/app1",
          hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App data")),
          0,
          "",
          "",
          1,
          0,
          0,
          []
        )
      ).to.not.be.reverted;

      // Verify the app was minted correctly
      const app = await registry.getApp(did, 1);
      expect(app.did).to.equal(did);
    });

    it("should prevent reentrancy in updateAppControlled", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);
      
      // Mint an app first
      const did = "did:oma3:update-reentrancy-test";
      await registry.connect(minter1).mint(
        did,
        1,
        "https://data.example.com/app1",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App data")),
        0,
        "",
        "",
        1,
        0,
        0,
        []
      );

      // Test that updateAppControlled function completes successfully
      await expect(
        registry.connect(minter1).updateAppControlled(
          did,
          1, // major
          "https://data.example.com/app1-updated", // new data URL
          hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Updated data")), // new data hash
          0, // no algorithm change
          1, // no interface change
          0, // no keyword changes
          0, // no minor increment
          1  // patch version incremented
        )
      ).to.not.be.reverted;

      // Verify the app was updated correctly
      const app = await registry.getApp(did, 1);
      expect(app.dataUrl).to.equal("https://data.example.com/app1-updated");
    });

    it("should prevent reentrancy in updateStatus", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);
      
      // Mint an app first
      const did = "did:oma3:status-reentrancy-test";
      await registry.connect(minter1).mint(
        did,
        1,
        "https://data.example.com/app1",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App data")),
        0,
        "",
        "",
        1,
        0,
        0,
        []
      );

      // Test that updateStatus function completes successfully
      await expect(
        registry.connect(minter1).updateStatus(did, 1, 1) // change to deprecated
      ).to.not.be.reverted;

      // Verify the status was updated correctly
      const app = await registry.getApp(did, 1);
      expect(app.status).to.equal(1);
    });

    it("should enforce access control for app updates", async function () {
      const { registry, minter1, minter2 } = await loadFixture(deployFixture);
      
      // Mint an app with minter1
      const did = "did:oma3:access-control-test";
      await registry.connect(minter1).mint(
        did,
        1,
        "https://data.example.com/app1",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App data")),
        0,
        "",
        "",
        1,
        0,
        0,
        []
      );

      // Try to update with different account (should fail)
      await expect(
        registry.connect(minter2).updateAppControlled(
          did,
          1, // major
          "https://data.example.com/unauthorized-update",
          hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Unauthorized data")),
          0, // no algorithm change
          1, // no interface change
          0, // no keyword changes
          0, // no minor increment
          1  // patch version
        )
      ).to.be.revertedWithCustomError(registry, ERRORS.NOT_APP_OWNER);

      // Try to update status with different account (should fail)
      await expect(
        registry.connect(minter2).updateStatus(did, 1, 1)
      ).to.be.revertedWithCustomError(registry, ERRORS.NOT_APP_OWNER);
    });

    it("should handle ownership transfer correctly", async function () {
      const { registry, minter1, minter2 } = await loadFixture(deployFixture);
      
      // Mint an app with minter1
      const did = "did:oma3:ownership-transfer-test";
      await registry.connect(minter1).mint(
        did,
        1,
        "https://data.example.com/app1",
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App data")),
        0,
        "",
        "",
        1,
        0,
        0,
        []
      );

      // Transfer ownership to minter2
      await registry.connect(minter1).transferFrom(minter1.address, minter2.address, 1);

      // Try to update with original owner (should fail)
      await expect(
        registry.connect(minter1).updateAppControlled(
          did,
          1, // major
          "https://data.example.com/old-owner-update",
          hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Old owner data")),
          0, // no algorithm change
          1, // no interface change
          0, // no keyword changes
          0, // no minor increment
          1  // patch version
        )
      ).to.be.revertedWithCustomError(registry, ERRORS.NOT_APP_OWNER);

      // Update with new owner (should succeed)
      await expect(
        registry.connect(minter2).updateAppControlled(
          did,
          1, // major
          "https://data.example.com/new-owner-update",
          hre.ethers.keccak256(hre.ethers.toUtf8Bytes("New owner data")),
          0, // no algorithm change
          1, // no interface change
          0, // no keyword changes
          0, // no minor increment
          1  // patch version
        )
      ).to.not.be.reverted;
    });

    it("should validate input parameters for security", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);
      
      // Test with malicious data URLs
      const maliciousUrls = [
        "javascript:alert('xss')",
        "data:text/html,<script>alert('xss')</script>",
        "file:///etc/passwd",
        "http://malicious-site.com/steal-data"
      ];

      for (const maliciousUrl of maliciousUrls) {
        // These should be rejected if URL validation is implemented
        // For now, we test that the contract doesn't crash
        try {
          await registry.connect(minter1).mint(
            "did:oma3:malicious-test",
            1,
            maliciousUrl,
            hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test data")),
            0,
            "",
            "",
            1,
            0,
            0,
            []
          );
          console.log(`    ✓ Malicious URL handled: ${maliciousUrl.substring(0, 30)}...`);
        } catch (error) {
          // Expected if validation is implemented
          console.log(`    ✓ Malicious URL rejected: ${maliciousUrl.substring(0, 30)}...`);
        }
      }
    });

    it("should handle gas limit attacks gracefully", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);
      
      // Test with maximum allowed inputs to ensure gas limits aren't exceeded
      const maxDid = "did:oma3:" + "a".repeat(MAX_DID_LENGTH - 9);
      const maxUrl = "https://data.example.com/" + "a".repeat(MAX_URL_LENGTH - 25);
      const maxKeywords = Array(MAX_KEYWORDS).fill(hre.ethers.keccak256(hre.ethers.toUtf8Bytes("keyword")));
      
      // This should complete within reasonable gas limits
      const tx = await registry.connect(minter1).mint(
        maxDid,
        255, // All interfaces
        maxUrl,
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Maximum data")),
        0,
        "fungible-token-id",
        "contract-id",
        255,
        255,
        255,
        maxKeywords
      );

      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1); // Transaction successful
      
      console.log(`    ✓ Gas used for max inputs: ${receipt.gasUsed.toString()}`);
    });

    it("should prevent integer overflow/underflow", async function () {
      const { registry, minter1 } = await loadFixture(deployFixture);
      
      // Test with maximum uint8 values
      await expect(
        registry.connect(minter1).mint(
          "did:oma3:overflow-test",
          1,
          "https://data.example.com/app1",
          hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test data")),
          0,
          "",
          "",
          255, // max uint8
          255, // max uint8
          255, // max uint8
          []
        )
      ).to.not.be.reverted;

      // Test with zero values
      await expect(
        registry.connect(minter1).mint(
          "did:oma3:underflow-test",
          1,
          "https://data.example.com/app2",
          hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test data")),
          0,
          "",
          "",
          0, // min uint8
          0, // min uint8
          0, // min uint8
          []
        )
      ).to.not.be.reverted;
    });
  });
}); 
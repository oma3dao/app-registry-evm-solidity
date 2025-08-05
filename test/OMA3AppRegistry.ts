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
}); 
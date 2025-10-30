import { expect } from "chai";
import { ethers } from "hardhat";
import { OMA3AppRegistry, OMA3ResolverWithStore, OMA3AppMetadata } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("ERC-8004 Integration", function () {
  let registry: OMA3AppRegistry;
  let resolver: OMA3ResolverWithStore;
  let metadata: OMA3AppMetadata;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    // Deploy contracts
    const ResolverFactory = await ethers.getContractFactory("OMA3ResolverWithStore");
    resolver = await ResolverFactory.deploy();
    await resolver.waitForDeployment();

    const MetadataFactory = await ethers.getContractFactory("OMA3AppMetadata");
    metadata = await MetadataFactory.deploy();
    await metadata.waitForDeployment();

    const RegistryFactory = await ethers.getContractFactory("OMA3AppRegistry");
    registry = await RegistryFactory.deploy();
    await registry.waitForDeployment();

    // Link contracts
    await registry.setMetadataContract(await metadata.getAddress());
    await registry.setOwnershipResolver(await resolver.getAddress());
    await registry.setDataUrlResolver(await resolver.getAddress());
    await registry.setRegistrationResolver(await resolver.getAddress());
    await metadata.setAuthorizedRegistry(await registry.getAddress());

    // Configure resolver
    await resolver.addAuthorizedIssuer(owner.address);
    await resolver.setMaturation(0); // No maturation for testing
  });

  describe("ERC-8004 register(string) - tokenURI only with resolver", function () {
    it("should register an app using resolver pre-commit", async function () {
      const did = "did:web:example.com";
      const didHash = ethers.keccak256(ethers.toUtf8Bytes(did));
      const dataUrl = "https://example.com/app.json";
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test data"));

      // Step 1: Attest DID ownership
      const userAddress32 = ethers.zeroPadValue(user.address, 32);
      await resolver.upsertDirect(didHash, userAddress32, 0);

      // Step 2: Prepare registration parameters (now includes tokenURI)
      await resolver.connect(user).prepareRegister(
        did,
        1, // interfaces (human)
        dataUrl, // tokenURI
        dataHash,
        0, // keccak256
        "", // fungibleTokenId
        "", // contractId
        1, // major
        0, // minor
        0, // patch
        [], // traitHashes
        "", // metadataJson
        0  // no expiry
      );

      // Step 3: Register using tokenURI only
      const tx = await registry.connect(user)["register(string)"](dataUrl);
      const receipt = await tx.wait();

      // Verify Registered event was emitted
      const event = receipt?.logs.find(
        (log: any) => {
          try {
            const parsed = registry.interface.parseLog(log);
            return parsed?.name === "Registered";
          } catch {
            return false;
          }
        }
      );
      expect(event).to.not.be.undefined;

      // Verify token was minted
      const tokenId = 1n;
      expect(await registry.ownerOf(tokenId)).to.equal(user.address);
      expect(await registry.tokenURI(tokenId)).to.equal(dataUrl);

      // Verify app data
      const app = await registry.getApp(did, 1);
      expect(app.did).to.equal(did);
      expect(app.dataHash).to.equal(dataHash);
      expect(app.interfaces).to.equal(1);
    });

    it("should fail if no stored params exist", async function () {
      await expect(
        registry.connect(user)["register(string)"]("https://example.com/app.json")
      ).to.be.revertedWith("NO_STORED_PARAMS");
    });

    it("should fail if tokenURI doesn't match stored params", async function () {
      const did = "did:web:example.com";
      const didHash = ethers.keccak256(ethers.toUtf8Bytes(did));
      const dataUrl = "https://example.com/app.json";
      const wrongUrl = "https://wrong.com/app.json";
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test data"));

      // Attest DID ownership
      const userAddress32 = ethers.zeroPadValue(user.address, 32);
      await resolver.upsertDirect(didHash, userAddress32, 0);

      // Prepare with one tokenURI
      await resolver.connect(user).prepareRegister(
        did,
        1,
        dataUrl, // Prepare with this URL
        dataHash,
        0,
        "", "",
        1, 0, 0,
        [],
        "",
        0
      );

      // Try to register with different tokenURI
      await expect(
        registry.connect(user)["register(string)"](wrongUrl)
      ).to.be.revertedWith("TOKEN_URI_MISMATCH");
    });
  });

  describe("ERC-8004 register(string, MetadataEntry[]) - with metadata", function () {
    it("should register an app using metadata entries", async function () {
      const did = "did:web:example.com";
      const didHash = ethers.keccak256(ethers.toUtf8Bytes(did));
      const dataUrl = "https://example.com/app.json";
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test data"));

      // Attest DID ownership
      const userAddress32 = ethers.zeroPadValue(user.address, 32);
      await resolver.upsertDirect(didHash, userAddress32, 0);

      // Prepare metadata entries
      const metadata = [
        {
          key: "omat.did",
          value: ethers.AbiCoder.defaultAbiCoder().encode(["string"], [did])
        },
        {
          key: "omat.dataHash",
          value: ethers.AbiCoder.defaultAbiCoder().encode(["bytes32"], [dataHash])
        },
        {
          key: "omat.dataHashAlgorithm",
          value: ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [0])
        },
        {
          key: "omat.interfaces",
          value: ethers.AbiCoder.defaultAbiCoder().encode(["uint16"], [1])
        },
        {
          key: "omat.versionMajor",
          value: ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [1])
        },
        {
          key: "omat.versionMinor",
          value: ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [0])
        },
        {
          key: "omat.versionPatch",
          value: ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [0])
        }
      ];

      // Register with metadata (explicitly call the overload with metadata)
      const tx = await registry.connect(user)["register(string,(string,bytes)[])"](dataUrl, metadata);
      const receipt = await tx.wait();

      // Verify Registered event
      const event = receipt?.logs.find(
        (log: any) => {
          try {
            const parsed = registry.interface.parseLog(log);
            return parsed?.name === "Registered";
          } catch {
            return false;
          }
        }
      );
      expect(event).to.not.be.undefined;

      // Verify token was minted
      const tokenId = 1n;
      expect(await registry.ownerOf(tokenId)).to.equal(user.address);

      // Verify app data
      const app = await registry.getApp(did, 1);
      expect(app.did).to.equal(did);
      expect(app.dataHash).to.equal(dataHash);
    });

    it("should use default values for missing optional metadata", async function () {
      const did = "did:web:example.com";
      const didHash = ethers.keccak256(ethers.toUtf8Bytes(did));
      const dataUrl = "https://example.com/app.json";
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test data"));

      // Attest DID ownership
      const userAddress32 = ethers.zeroPadValue(user.address, 32);
      await resolver.upsertDirect(didHash, userAddress32, 0);

      // Minimal metadata (only required fields)
      const metadata = [
        {
          key: "omat.did",
          value: ethers.AbiCoder.defaultAbiCoder().encode(["string"], [did])
        },
        {
          key: "omat.dataHash",
          value: ethers.AbiCoder.defaultAbiCoder().encode(["bytes32"], [dataHash])
        }
      ];

      // Should succeed with defaults for optional fields
      const tx = await registry.connect(user)["register(string,(string,bytes)[])"](dataUrl, metadata);
      await tx.wait();

      const tokenId = 1n;
      const app = await registry.getApp(did, 1);
      expect(app.interfaces).to.equal(1); // Default to human interface
      expect(app.versionMajor).to.equal(1); // Default version
    });
  });

  describe("Backward compatibility", function () {
    it("should still support the original mint() function", async function () {
      const did = "did:web:example.com";
      const didHash = ethers.keccak256(ethers.toUtf8Bytes(did));
      const dataUrl = "https://example.com/app.json";
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test data"));

      // Attest DID ownership
      const userAddress32 = ethers.zeroPadValue(user.address, 32);
      await resolver.upsertDirect(didHash, userAddress32, 0);

      // Use original mint function
      const tx = await registry.connect(user).mint(
        did,
        1, // interfaces
        dataUrl,
        dataHash,
        0, // algorithm
        "", // fungibleTokenId
        "", // contractId
        1, 0, 0, // version
        [], // traits
        "" // metadataJson
      );

      await tx.wait();

      // Verify it still works
      const tokenId = 1n;
      expect(await registry.ownerOf(tokenId)).to.equal(user.address);
    });
  });
});

import { expect } from "chai";
import { ethers } from "hardhat";
import hre from "hardhat";
import { NETWORK_CONTRACTS } from "../hardhat.config";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

/**
 * Simplified test suite for Hardhat tasks
 * Tests core functionality without complex attestation requirements
 */
describe("Hardhat Tasks - Simplified", function () {
  this.timeout(120000);

  let deployer: any;
  let user: any;
  let registryAddress: string;
  let metadataAddress: string;
  let resolverAddress: string;
  let testDID: string;
  let testTokenId: number;

  before(async function () {
    [deployer, user] = await ethers.getSigners();
    
    console.log("\nSetting up test environment...");
    console.log("Deployer:", deployer.address);
    console.log("User:", user.address);

    // Setup SSH key for deploy-system task
    const sshKeyPath = path.join(os.homedir(), '.ssh', 'test-evm-deployment-key');
    const issuerKeyPath = path.join(os.homedir(), '.ssh', 'local-attestation-key');
    const sshDir = path.join(os.homedir(), '.ssh');
    
    if (!fs.existsSync(sshDir)) {
      fs.mkdirSync(sshDir, { mode: 0o700 });
    }

    const testPrivateKey = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
    
    if (!fs.existsSync(sshKeyPath)) {
      fs.writeFileSync(sshKeyPath, testPrivateKey, { mode: 0o600 });
    }
    if (!fs.existsSync(issuerKeyPath)) {
      fs.writeFileSync(issuerKeyPath, testPrivateKey, { mode: 0o600 });
    }

    const keyContent = fs.readFileSync(sshKeyPath, 'utf8').trim();
    process.env.PRIVATE_KEY = keyContent.startsWith('0x') ? keyContent : `0x${keyContent}`;
  });

  describe("1. Deployment Tasks", function () {
    it("should deploy full system", async function () {
      await hre.run("deploy-system", {
        noLink: false,
        noTest: false,
        confirmations: "1"
      });
    });

    it("should deploy contracts for testing", async function () {
      const Registry = await ethers.getContractFactory("OMA3AppRegistry", deployer);
      const registry = await Registry.deploy();
      await registry.waitForDeployment();
      registryAddress = await registry.getAddress();

      const Metadata = await ethers.getContractFactory("OMA3AppMetadata", deployer);
      const metadata = await Metadata.deploy();
      await metadata.waitForDeployment();
      metadataAddress = await metadata.getAddress();

      const Resolver = await ethers.getContractFactory("OMA3ResolverWithStore", deployer);
      const resolver = await Resolver.deploy();
      await resolver.waitForDeployment();
      resolverAddress = await resolver.getAddress();

      NETWORK_CONTRACTS.hardhat.registry = registryAddress;
      NETWORK_CONTRACTS.hardhat.metadata = metadataAddress;
      NETWORK_CONTRACTS.hardhat.resolver = resolverAddress;

      const registryContract = await ethers.getContractAt("OMA3AppRegistry", registryAddress, deployer);
      const metadataContract = await ethers.getContractAt("OMA3AppMetadata", metadataAddress, deployer);
      
      await registryContract.setMetadataContract(metadataAddress);
      await metadataContract.setAuthorizedRegistry(registryAddress);

      expect(registryAddress).to.be.properAddress;
      expect(metadataAddress).to.be.properAddress;
      expect(resolverAddress).to.be.properAddress;
    });
  });

  describe("2. Registry - Minting", function () {
    it("should mint app", async function () {
      testDID = "did:oma3:test-" + Date.now();
      const registryContract = await ethers.getContractAt("OMA3AppRegistry", registryAddress, deployer);
      
      const tx = await registryContract.mint(
        testDID,
        1, // human interface
        "https://example.com/metadata.json",
        ethers.keccak256(ethers.toUtf8Bytes("test-data")),
        0,
        "",
        "",
        1, 0, 0,
        [],
        ""
      );
      
      const receipt = await tx.wait();
      const event = receipt?.logs?.find((log: any) => {
        try {
          return registryContract.interface.parseLog(log)?.name === "AppMinted";
        } catch {
          return false;
        }
      });
      
      const parsedEvent = registryContract.interface.parseLog(event!);
      testTokenId = Number(parsedEvent?.args?.tokenId);
      
      expect(testTokenId).to.be.greaterThan(0);
    });
  });

  describe("3. Registry - Querying", function () {
    it("should get app", async function () {
      const registryContract = await ethers.getContractAt("OMA3AppRegistry", registryAddress);
      const app = await registryContract.getApp(testDID, 1);
      
      expect(app.did).to.equal(testDID);
      expect(app.versionMajor).to.equal(1);
    });

    it("should get total supply", async function () {
      const registryContract = await ethers.getContractAt("OMA3AppRegistry", registryAddress);
      const totalSupply = await registryContract.totalSupply();
      
      expect(totalSupply).to.be.greaterThan(0);
    });

    it("should get apps", async function () {
      const registryContract = await ethers.getContractAt("OMA3AppRegistry", registryAddress);
      const result = await registryContract.getApps(0);
      const apps = result.apps || result[0];
      
      expect(apps.length).to.be.greaterThan(0);
    });

    it("should get apps by owner", async function () {
      const registryContract = await ethers.getContractAt("OMA3AppRegistry", registryAddress);
      const result = await registryContract.getAppsByOwner(deployer.address, 0);
      const apps = result.apps || result[0];
      
      expect(apps.length).to.be.greaterThan(0);
    });

    it("should get DID hash", async function () {
      const registryContract = await ethers.getContractAt("OMA3AppRegistry", registryAddress);
      const didHash = await registryContract.getDidHash(testDID);
      
      expect(didHash).to.equal(ethers.keccak256(ethers.toUtf8Bytes(testDID)));
    });
  });

  describe("4. Registry - Updates", function () {
    it("should update status", async function () {
      const registryContract = await ethers.getContractAt("OMA3AppRegistry", registryAddress, deployer);
      
      await registryContract.updateStatus(testDID, 1, 1); // deprecated
      let app = await registryContract.getApp(testDID, 1);
      expect(app.status).to.equal(1);
      
      await registryContract.updateStatus(testDID, 1, 0); // active
      app = await registryContract.getApp(testDID, 1);
      expect(app.status).to.equal(0);
    });
  });

  describe("5. Metadata Tasks", function () {
    it("should set and get metadata JSON", async function () {
      const registryContract = await ethers.getContractAt("OMA3AppRegistry", registryAddress, deployer);
      const metadataContract = await ethers.getContractAt("OMA3AppMetadata", metadataAddress);
      
      const testMetadata = JSON.stringify({ name: "Test App", version: "1.0.0" });
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes(testMetadata));
      
      await registryContract.setMetadataJson(testDID, 1, 0, 0, testMetadata, dataHash, 0);
      
      const retrievedMetadata = await metadataContract.getMetadataJson(testDID);
      expect(retrievedMetadata).to.equal(testMetadata);
    });
  });

  describe("6. Admin Tasks", function () {
    it("should verify metadata contract set", async function () {
      const registryContract = await ethers.getContractAt("OMA3AppRegistry", registryAddress);
      const currentMetadata = await registryContract.metadataContract();
      
      expect(currentMetadata.toLowerCase()).to.equal(metadataAddress.toLowerCase());
    });

    it("should set resolvers", async function () {
      const registryContract = await ethers.getContractAt("OMA3AppRegistry", registryAddress, deployer);
      
      await registryContract.setOwnershipResolver(resolverAddress);
      await registryContract.setDataUrlResolver(resolverAddress);
      
      expect(await registryContract.ownershipResolver()).to.equal(resolverAddress);
      expect(await registryContract.dataUrlResolver()).to.equal(resolverAddress);
    });

    it("should manage resolver issuers", async function () {
      const resolverContract = await ethers.getContractAt("OMA3ResolverWithStore", resolverAddress, deployer);
      
      await resolverContract.addAuthorizedIssuer(deployer.address);
      expect(await resolverContract.isIssuer(deployer.address)).to.be.true;
      
      await resolverContract.addAuthorizedIssuer(user.address);
      expect(await resolverContract.isIssuer(user.address)).to.be.true;
      
      await resolverContract.removeAuthorizedIssuer(user.address);
      expect(await resolverContract.isIssuer(user.address)).to.be.false;
    });

    it("should set resolver parameters", async function () {
      const resolverContract = await ethers.getContractAt("OMA3ResolverWithStore", resolverAddress, deployer);
      
      await resolverContract.setMaturation(3600);
      expect(await resolverContract.maturationSeconds()).to.equal(3600);
      
      await resolverContract.setMaxTTL(86400);
      expect(await resolverContract.maxTTLSeconds()).to.equal(86400);
    });
  });

  describe("7. Resolver Tasks", function () {
    it("should attest and verify data hash", async function () {
      const resolverContract = await ethers.getContractAt("OMA3ResolverWithStore", resolverAddress, deployer);
      
      const testResolverDID = "did:oma3:resolver-test-" + Date.now();
      const didHash = ethers.keccak256(ethers.toUtf8Bytes(testResolverDID));
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test-data"));
      
      await resolverContract.attestDataHash(didHash, dataHash, 0);
      
      const isAttested = await resolverContract.checkDataHashAttestation(didHash, dataHash);
      expect(isAttested).to.be.true;
    });
  });

  describe("8. ERC721 Tasks", function () {
    it("should get owner", async function () {
      const registryContract = await ethers.getContractAt("OMA3AppRegistry", registryAddress);
      const owner = await registryContract.ownerOf(testTokenId);
      
      expect(owner.toLowerCase()).to.equal(deployer.address.toLowerCase());
    });

    it("should get balance", async function () {
      const registryContract = await ethers.getContractAt("OMA3AppRegistry", registryAddress);
      const balance = await registryContract.balanceOf(deployer.address);
      
      expect(balance).to.be.greaterThan(0);
    });

    it("should approve and transfer", async function () {
      const registryContract = await ethers.getContractAt("OMA3AppRegistry", registryAddress, deployer);
      
      await registryContract.approve(user.address, testTokenId);
      expect(await registryContract.getApproved(testTokenId)).to.equal(user.address);
      
      await registryContract.transferFrom(deployer.address, user.address, testTokenId);
      expect(await registryContract.ownerOf(testTokenId)).to.equal(user.address);
      
      const registryAsUser = await ethers.getContractAt("OMA3AppRegistry", registryAddress, user);
      await registryAsUser.transferFrom(user.address, deployer.address, testTokenId);
      expect(await registryContract.ownerOf(testTokenId)).to.equal(deployer.address);
    });
  });

  describe("9. Ownable Tasks", function () {
    it("should get owner", async function () {
      const registryContract = await ethers.getContractAt("OMA3AppRegistry", registryAddress);
      expect(await registryContract.owner()).to.equal(deployer.address);
    });

    it("should transfer ownership", async function () {
      const registryContract = await ethers.getContractAt("OMA3AppRegistry", registryAddress, deployer);
      
      await registryContract.transferOwnership(user.address);
      expect(await registryContract.owner()).to.equal(user.address);
      
      const registryAsUser = await ethers.getContractAt("OMA3AppRegistry", registryAddress, user);
      await registryAsUser.transferOwnership(deployer.address);
      expect(await registryContract.owner()).to.equal(deployer.address);
    });
  });

  describe("10. Advanced Registry Operations", function () {
    let advancedDID: string;

    before(async function () {
      advancedDID = "did:oma3:advanced-" + Date.now();
      const registryContract = await ethers.getContractAt("OMA3AppRegistry", registryAddress, deployer);
      const resolverContract = await ethers.getContractAt("OMA3ResolverWithStore", resolverAddress, deployer);
      
      // Set up ownership attestation for minting
      const didHash = ethers.keccak256(ethers.toUtf8Bytes(advancedDID));
      const controllerBytes32 = ethers.zeroPadValue(deployer.address, 32);
      await resolverContract.upsertDirect(didHash, controllerBytes32, 0);
      
      // Mint app with traits for advanced testing
      const trait1 = ethers.keccak256(ethers.toUtf8Bytes("gaming"));
      const trait2 = ethers.keccak256(ethers.toUtf8Bytes("vr"));
      
      await registryContract.mint(
        advancedDID,
        1, // human interface
        "https://example.com/advanced.json",
        ethers.keccak256(ethers.toUtf8Bytes("advanced-data")),
        0,
        "",
        "",
        1, 0, 0,
        [trait1, trait2],
        ""
      );
    });

    it("should update app with updateAppControlled", async function () {
      const registryContract = await ethers.getContractAt("OMA3AppRegistry", registryAddress, deployer);
      
      // Update with new interface, traits, and version
      const newTrait = ethers.keccak256(ethers.toUtf8Bytes("metaverse"));
      
      await registryContract.updateAppControlled(
        advancedDID,
        1,
        "https://example.com/advanced-v2.json",
        ethers.keccak256(ethers.toUtf8Bytes("advanced-data-v2")),
        0,
        3, // human (1) + api (2) = 3
        [newTrait],
        1, // minor version increment
        0  // patch
      );
      
      const app = await registryContract.getApp(advancedDID, 1);
      expect(app.dataUrl).to.equal("https://example.com/advanced-v2.json");
      expect(app.interfaces).to.equal(3);
      
      // Version is stored in versionHistory array - check the latest version
      const versionHistory = app.versionHistory;
      expect(versionHistory.length).to.be.greaterThan(0);
      const latestVersion = versionHistory[versionHistory.length - 1];
      expect(latestVersion.minor).to.equal(1);
    });

    it("should check traits comprehensively", async function () {
      const registryContract = await ethers.getContractAt("OMA3AppRegistry", registryAddress);
      
      const metaverseTrait = ethers.keccak256(ethers.toUtf8Bytes("metaverse"));
      const nonExistentTrait = ethers.keccak256(ethers.toUtf8Bytes("nonexistent"));
      
      // Has the new trait (using hasAnyTraits)
      expect(await registryContract.hasAnyTraits(advancedDID, 1, [metaverseTrait])).to.be.true;
      
      // Doesn't have non-existent trait
      expect(await registryContract.hasAnyTraits(advancedDID, 1, [nonExistentTrait])).to.be.false;
      
      // Check multiple traits - hasAllTraits requires ALL traits to be present
      const gamingTrait = ethers.keccak256(ethers.toUtf8Bytes("gaming"));
      expect(await registryContract.hasAllTraits(advancedDID, 1, [metaverseTrait, gamingTrait])).to.be.false; // gaming was replaced
      
      // Check that hasAllTraits works when all traits are present
      expect(await registryContract.hasAllTraits(advancedDID, 1, [metaverseTrait])).to.be.true;
    });

    it("should get apps by different statuses", async function () {
      const registryContract = await ethers.getContractAt("OMA3AppRegistry", registryAddress, deployer);
      const resolverContract = await ethers.getContractAt("OMA3ResolverWithStore", resolverAddress, deployer);
      
      // Create deprecated app
      const deprecatedDID = "did:oma3:deprecated-" + Date.now();
      const deprecatedDidHash = ethers.keccak256(ethers.toUtf8Bytes(deprecatedDID));
      const controllerBytes32 = ethers.zeroPadValue(deployer.address, 32);
      await resolverContract.upsertDirect(deprecatedDidHash, controllerBytes32, 0);
      
      await registryContract.mint(deprecatedDID, 1, "https://example.com/deprecated.json", ethers.keccak256(ethers.toUtf8Bytes("deprecated")), 0, "", "", 1, 0, 0, [], "");
      await registryContract.updateStatus(deprecatedDID, 1, 1); // Set to deprecated
      
      // Get active apps
      const activeResult = await registryContract.getAppsByStatus(0, 0);
      const activeApps = activeResult.apps || activeResult[0];
      expect(activeApps.length).to.be.greaterThan(0);
      
      // Get deprecated apps
      const deprecatedResult = await registryContract.getAppsByStatus(1, 0);
      const deprecatedApps = deprecatedResult.apps || deprecatedResult[0];
      expect(deprecatedApps.length).to.be.greaterThan(0);
      expect(deprecatedApps.some((app: any) => app.did === deprecatedDID)).to.be.true;
    });
  });

  describe("11. Resolver View Operations", function () {
    it("should view data hash attestations", async function () {
      const resolverContract = await ethers.getContractAt("OMA3ResolverWithStore", resolverAddress, deployer);
      
      // Create attestation
      const viewDID = "did:oma3:view-test-" + Date.now();
      const didHash = ethers.keccak256(ethers.toUtf8Bytes(viewDID));
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("view-test-data"));
      const expires = Math.floor(Date.now() / 1000) + 86400;
      
      await resolverContract.attestDataHash(didHash, dataHash, expires);
      
      // View the attestation via getDataEntry
      const entry = await resolverContract.getDataEntry(deployer.address, didHash, dataHash);
      
      expect(entry.active).to.be.true;
      expect(entry.expiresAt).to.equal(expires);
    });

    it("should view ownership attestations", async function () {
      const resolverContract = await ethers.getContractAt("OMA3ResolverWithStore", resolverAddress, deployer);
      
      // Create ownership attestation
      const ownerDID = "did:oma3:owner-test-" + Date.now();
      const didHash = ethers.keccak256(ethers.toUtf8Bytes(ownerDID));
      const controllerBytes32 = ethers.zeroPadValue(deployer.address, 32);
      
      await resolverContract.upsertDirect(didHash, controllerBytes32, 0);
      
      // View ownership attestation
      const entry = await resolverContract.get(deployer.address, didHash);
      expect(entry.active).to.be.true;
      expect(entry.controllerAddress).to.equal(controllerBytes32);
    });
  });

  describe("12. Destructive Operations", function () {
    it("should renounce ownership (with caution)", async function () {
      // Deploy a temporary contract to test renounce without affecting main contracts
      const TempRegistry = await ethers.getContractFactory("OMA3AppRegistry", deployer);
      const tempRegistry = await TempRegistry.deploy();
      await tempRegistry.waitForDeployment();
      
      const tempAddress = await tempRegistry.getAddress();
      const tempContract = await ethers.getContractAt("OMA3AppRegistry", tempAddress, deployer);
      
      // Verify initial owner
      expect(await tempContract.owner()).to.equal(deployer.address);
      
      // Renounce ownership
      await tempContract.renounceOwnership();
      
      // Verify ownership was renounced (owner is now zero address)
      expect(await tempContract.owner()).to.equal(ethers.ZeroAddress);
      
      // Verify no one can perform owner operations anymore
      await expect(
        tempContract.setMetadataContract(metadataAddress)
      ).to.be.revertedWithCustomError(tempContract, "OwnableUnauthorizedAccount");
    });
  });

  describe("13. Error Handling", function () {
    it("should reject non-owner operations", async function () {
      const registryAsUser = await ethers.getContractAt("OMA3AppRegistry", registryAddress, user);
      
      await expect(
        registryAsUser.setMetadataContract(metadataAddress)
      ).to.be.revertedWithCustomError(registryAsUser, "OwnableUnauthorizedAccount");
    });

    it("should reject non-existent app", async function () {
      const registryContract = await ethers.getContractAt("OMA3AppRegistry", registryAddress);
      
      await expect(
        registryContract.getApp("did:oma3:nonexistent", 1)
      ).to.be.revertedWithCustomError(registryContract, "AppNotFound");
    });

    it("should reject invalid inputs", async function () {
      const registryContract = await ethers.getContractAt("OMA3AppRegistry", registryAddress, deployer);
      
      await expect(
        registryContract.mint("", 1, "https://example.com", ethers.keccak256(ethers.toUtf8Bytes("test")), 0, "", "", 1, 0, 0, [], "")
      ).to.be.revertedWithCustomError(registryContract, "DIDCannotBeEmpty");
      
      await expect(
        registryContract.mint("did:oma3:test", 0, "https://example.com", ethers.keccak256(ethers.toUtf8Bytes("test")), 0, "", "", 1, 0, 0, [], "")
      ).to.be.revertedWithCustomError(registryContract, "InterfacesCannotBeEmpty");
    });
  });

  after(async function () {
    console.log("\n✅ All simplified task tests completed");
    if (registryAddress) {
      const registry = await ethers.getContractAt("OMA3AppRegistry", registryAddress);
      console.log("Total apps minted:", (await registry.totalSupply()).toString());
    }
  });
});


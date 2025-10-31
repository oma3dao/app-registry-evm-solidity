import { expect } from "chai";
import { ethers } from "hardhat";
import { OMA3SystemFactory, OMA3AppRegistry, OMA3AppMetadata } from "../typechain-types";

describe("OMA3SystemFactory", function () {
  let factory: OMA3SystemFactory;
  let owner: any;
  let deployer: any;

  beforeEach(async function () {
    [owner, deployer] = await ethers.getSigners();
    
    // Deploy the factory
    const Factory = await ethers.getContractFactory("OMA3SystemFactory");
    factory = await Factory.deploy();
    await factory.waitForDeployment();
  });

  describe("Address Prediction", function () {
    it("Should predict addresses correctly", async function () {
      const salt = ethers.ZeroHash;
      const [predictedRegistry, predictedMetadata] = await factory.predictAddresses(deployer.address, salt);
      
      expect(predictedRegistry).to.not.equal(ethers.ZeroAddress);
      expect(predictedMetadata).to.not.equal(ethers.ZeroAddress);
      expect(predictedRegistry).to.not.equal(predictedMetadata);
    });
  });

  describe("System Deployment", function () {
    it("Should deploy complete system with proper linking", async function () {
      const salt = ethers.ZeroHash;
      
      // Predict addresses
      const [predictedRegistry, predictedMetadata] = await factory.predictAddresses(deployer.address, salt);
      
      // Deploy system and get addresses from return value
      const tx = await factory.connect(deployer).deploySystem(salt);
      const receipt = await tx.wait();
      
      // Parse the SystemDeployed event to get addresses
      const factoryInterface = factory.interface;
      const deployedEvent = receipt?.logs
        ?.map(log => {
          try {
            return factoryInterface.parseLog(log);
          } catch {
            return null;
          }
        })
        ?.find(event => event?.name === "SystemDeployed");
      
      expect(deployedEvent).to.not.be.null;
      const registryAddress = deployedEvent!.args[1];
      const metadataAddress = deployedEvent!.args[2];
      
      // Verify addresses match predictions
      expect(registryAddress).to.equal(predictedRegistry);
      expect(metadataAddress).to.equal(predictedMetadata);
      
      // Get contract instances
      const registry = await ethers.getContractAt("OMA3AppRegistry", registryAddress);
      const metadata = await ethers.getContractAt("OMA3AppMetadata", metadataAddress);
      
      // Verify contracts are properly linked
      expect(await registry.metadataContract()).to.equal(metadataAddress);
      expect(await metadata.authorizedRegistry()).to.equal(registryAddress);
      
      // Verify ownership was transferred
      expect(await registry.owner()).to.equal(deployer.address);
      expect(await metadata.owner()).to.equal(deployer.address);
    });

    it("Should prevent multiple deployments", async function () {
      const salt = ethers.ZeroHash;
      
      // First deployment should succeed
      await factory.connect(deployer).deploySystem(salt);
      
      // Second deployment should fail
      await expect(factory.connect(deployer).deploySystem(salt))
        .to.be.revertedWith("Factory already used");
    });

    it("Should work with different salts", async function () {
      const salt1 = ethers.ZeroHash;
      const salt2 = ethers.keccak256(ethers.toUtf8Bytes("different"));
      
      const [registry1, metadata1] = await factory.predictAddresses(deployer.address, salt1);
      const [registry2, metadata2] = await factory.predictAddresses(deployer.address, salt2);
      
      // Different salts should produce different addresses
      expect(registry1).to.not.equal(registry2);
      expect(metadata1).to.not.equal(metadata2);
    });
  });

  describe("Factory Info", function () {
    it("Should track deployment status", async function () {
      let [isUsed, factoryAddress] = await factory.getInfo();
      expect(isUsed).to.be.false;
      expect(factoryAddress).to.equal(await factory.getAddress());
      
      // Deploy system
      await factory.connect(deployer).deploySystem(ethers.ZeroHash);
      
      [isUsed, factoryAddress] = await factory.getInfo();
      expect(isUsed).to.be.true;
    });
  });
});

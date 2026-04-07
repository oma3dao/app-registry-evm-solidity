import { expect } from "chai";
import { ethers } from "hardhat";

describe("EAS Deployment", function () {
  let schemaRegistry: any;
  let eas: any;
  let deployer: any;

  beforeEach(async function () {
    [deployer] = await ethers.getSigners();
  });

  it("Should deploy SchemaRegistry", async function () {
    const SchemaRegistry = await ethers.getContractFactory("contracts/eas/SchemaRegistry.sol:SchemaRegistry");
    schemaRegistry = await SchemaRegistry.deploy();
    await schemaRegistry.waitForDeployment();

    const address = await schemaRegistry.getAddress();
    expect(address).to.properAddress;

    // Check version
    const version = await schemaRegistry.version();
    expect(version).to.equal("1.4.0");
  });

  it("Should deploy EAS with SchemaRegistry", async function () {
    // Deploy SchemaRegistry first
    const SchemaRegistry = await ethers.getContractFactory("contracts/eas/SchemaRegistry.sol:SchemaRegistry");
    schemaRegistry = await SchemaRegistry.deploy();
    await schemaRegistry.waitForDeployment();
    const registryAddress = await schemaRegistry.getAddress();

    // Deploy EAS
    const EAS = await ethers.getContractFactory("contracts/eas/EAS.sol:EAS");
    eas = await EAS.deploy(registryAddress);
    await eas.waitForDeployment();

    const easAddress = await eas.getAddress();
    expect(easAddress).to.properAddress;

    // Check version
    const version = await eas.version();
    expect(version).to.equal("1.4.0");

    // Check it references the correct registry
    const linkedRegistry = await eas.getSchemaRegistry();
    expect(linkedRegistry).to.equal(registryAddress);
  });

  it("Should register a schema and create an attestation", async function () {
    // Deploy both contracts
    const SchemaRegistry = await ethers.getContractFactory("contracts/eas/SchemaRegistry.sol:SchemaRegistry");
    schemaRegistry = await SchemaRegistry.deploy();
    await schemaRegistry.waitForDeployment();
    const registryAddress = await schemaRegistry.getAddress();

    const EAS = await ethers.getContractFactory("contracts/eas/EAS.sol:EAS");
    eas = await EAS.deploy(registryAddress);
    await eas.waitForDeployment();

    // Register a simple schema
    const schema = "string name,uint8 score";
    const tx = await schemaRegistry.register(
      schema,
      ethers.ZeroAddress, // No resolver
      true // Revocable
    );
    const receipt = await tx.wait();

    // Get schema UID from event
    const event = receipt?.logs.find((log: any) => {
      try {
        return schemaRegistry.interface.parseLog(log)?.name === "Registered";
      } catch {
        return false;
      }
    });

    expect(event).to.not.be.undefined;
    const parsedEvent = schemaRegistry.interface.parseLog(event!);
    const schemaUID = parsedEvent?.args.uid;
    expect(schemaUID).to.not.equal(ethers.ZeroHash);

    // Cross-reference: verify event UID matches on-chain schema record
    const registeredSchema = await schemaRegistry.getSchema(schemaUID);
    expect(registeredSchema.uid).to.equal(schemaUID);
    expect(registeredSchema.schema).to.equal(schema);
    expect(registeredSchema.revocable).to.be.true;
    expect(registeredSchema.resolver).to.equal(ethers.ZeroAddress);

    // Create an attestation
    const attestationData = ethers.AbiCoder.defaultAbiCoder().encode(
      ["string", "uint8"],
      ["Alice", 95]
    );

    const attestTx = await eas.attest({
      schema: schemaUID,
      data: {
        recipient: deployer.address,
        expirationTime: 0, // No expiration
        revocable: true,
        refUID: ethers.ZeroHash,
        data: attestationData,
        value: 0
      }
    });

    const attestReceipt = await attestTx.wait();
    expect(attestReceipt?.status).to.equal(1);

    // Get attestation UID from event
    const attestEvent = attestReceipt?.logs.find((log: any) => {
      try {
        return eas.interface.parseLog(log)?.name === "Attested";
      } catch {
        return false;
      }
    });

    expect(attestEvent).to.not.be.undefined;
    const parsedAttestEvent = eas.interface.parseLog(attestEvent!);
    const attestationUID = parsedAttestEvent?.args.uid;
    expect(attestationUID).to.not.equal(ethers.ZeroHash);

    // Verify event args match what we submitted
    expect(parsedAttestEvent?.args.recipient).to.equal(deployer.address);
    expect(parsedAttestEvent?.args.schemaUID).to.equal(schemaUID);

    // Verify attestation exists on-chain and cross-reference against event data
    const attestation = await eas.getAttestation(attestationUID);
    expect(attestation.uid).to.equal(attestationUID);
    expect(attestation.recipient).to.equal(deployer.address);
    expect(attestation.attester).to.equal(deployer.address);
    expect(attestation.schema).to.equal(schemaUID);

    console.log("\n✅ Full EAS flow test passed!");
    console.log(`   Schema UID: ${schemaUID}`);
    console.log(`   Attestation UID: ${attestationUID}`);
  });
});

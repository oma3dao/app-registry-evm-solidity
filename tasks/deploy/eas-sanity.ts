import { task } from "hardhat/config";
import { NETWORK_CONTRACTS } from "../../hardhat.config";

/**
 * Simple EAS deployment sanity test
 * Tests: Schema registration → Schema retrieval → Attestation creation → Attestation retrieval
 */
task("eas-sanity", "Run EAS deployment sanity test")
  .setAction(async (_, hre) => {
    const networkName = hre.network.name as keyof typeof NETWORK_CONTRACTS;
    const schemaRegistryAddress = NETWORK_CONTRACTS[networkName]?.easSchemaRegistry;
    const easAddress = NETWORK_CONTRACTS[networkName]?.easContract;

    console.log("\n========================================");
    console.log("EAS Deployment Sanity Test");
    console.log(`Network: ${networkName}`);
    console.log("========================================\n");

    if (!schemaRegistryAddress || schemaRegistryAddress === "0x") {
      throw new Error(`SchemaRegistry not configured for network ${networkName}`);
    }

    if (!easAddress || easAddress === "0x") {
      throw new Error(`EAS contract not configured for network ${networkName}`);
    }

    const [signer] = await hre.ethers.getSigners();
    const signerAddress = await signer.getAddress();

    console.log(`Signer: ${signerAddress}`);
    console.log(`SchemaRegistry: ${schemaRegistryAddress}`);
    console.log(`EAS: ${easAddress}\n`);

    // Step 1: Register a test schema
    console.log("Step 1: Registering test schema...");
    const schemaRegistry = await hre.ethers.getContractAt(
      "deps/eas/SchemaRegistry.sol:SchemaRegistry",
      schemaRegistryAddress,
      signer
    );

    const schema = "string testName,uint8 testScore";
    const tx1 = await schemaRegistry.register(schema, hre.ethers.ZeroAddress, true);
    const receipt1 = await tx1.wait();

    const event1 = receipt1?.logs.find((log: any) => {
      try {
        return schemaRegistry.interface.parseLog(log)?.name === "Registered";
      } catch {
        return false;
      }
    });

    if (!event1) {
      throw new Error("Failed to find Registered event");
    }

    const parsedEvent1 = schemaRegistry.interface.parseLog(event1);
    const schemaUID = parsedEvent1?.args.uid;
    console.log(`✅ Schema registered: ${schemaUID}\n`);

    // Step 2: Get schema details
    console.log("Step 2: Retrieving schema details...");
    const schemaRecord = await schemaRegistry.getSchema(schemaUID);
    console.log(`   Schema: ${schemaRecord.schema}`);
    console.log(`   Resolver: ${schemaRecord.resolver}`);
    console.log(`   Revocable: ${schemaRecord.revocable}`);
    console.log(`✅ Schema retrieved successfully\n`);

    // Step 3: Create an attestation
    console.log("Step 3: Creating test attestation...");
    const eas = await hre.ethers.getContractAt(
      "deps/eas/EAS.sol:EAS",
      easAddress,
      signer
    );

    const attestationData = hre.ethers.AbiCoder.defaultAbiCoder().encode(
      ["string", "uint8"],
      ["SanityTest", 100]
    );

    const tx2 = await eas.attest({
      schema: schemaUID,
      data: {
        recipient: signerAddress,
        expirationTime: 0,
        revocable: true,
        refUID: hre.ethers.ZeroHash,
        data: attestationData,
        value: 0
      }
    });

    const receipt2 = await tx2.wait();

    const event2 = receipt2?.logs.find((log: any) => {
      try {
        return eas.interface.parseLog(log)?.name === "Attested";
      } catch {
        return false;
      }
    });

    if (!event2) {
      throw new Error("Failed to find Attested event");
    }

    const parsedEvent2 = eas.interface.parseLog(event2);
    const attestationUID = parsedEvent2?.args.uid;
    console.log(`✅ Attestation created: ${attestationUID}\n`);

    // Step 4: Get attestation details
    console.log("Step 4: Retrieving attestation details...");
    const attestation = await eas.getAttestation(attestationUID);
    console.log(`   UID: ${attestation.uid}`);
    console.log(`   Schema: ${attestation.schema}`);
    console.log(`   Attester: ${attestation.attester}`);
    console.log(`   Recipient: ${attestation.recipient}`);
    console.log(`   Revocable: ${attestation.revocable}`);
    console.log(`   Revoked: ${attestation.revocationTime !== 0n}`);
    
    // Decode the data
    const decoded = hre.ethers.AbiCoder.defaultAbiCoder().decode(
      ["string", "uint8"],
      attestation.data
    );
    console.log(`   Data: testName="${decoded[0]}", testScore=${decoded[1]}`);
    console.log(`✅ Attestation retrieved successfully\n`);

    // Summary
    console.log("========================================");
    console.log("✅ ALL TESTS PASSED!");
    console.log("========================================");
    console.log(`Schema UID:      ${schemaUID}`);
    console.log(`Attestation UID: ${attestationUID}`);
    console.log("========================================\n");

    console.log(`✅ Your EAS deployment on ${networkName} is working correctly!`);
  });
